// Thin Supabase layer. Every export is safe to call when Supabase is not configured: it just does nothing.
// supabase-js is fetched from the CDN only when needed, so the landing page stays light.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.mjs';

export const enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;

let clientPromise = null;
function client() {
  if (!enabled) return Promise.resolve(null);
  clientPromise ??= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } }))
    .catch(() => null);
  return clientPromise;
}

/** cb({ user, plan }) now and on every sign-in / sign-out. plan = 'free' | 'm1' | 'm3' | 'y1', already checked for expiry. */
export async function onAuth(cb) {
  const sb = await client();
  if (!sb) return cb({ user: null, plan: null });
  const emit = async (session) => cb({ user: session?.user || null, plan: session?.user ? await fetchPlan(sb, session.user.id) : null });
  const { data } = await sb.auth.getSession();
  await emit(data.session);
  sb.auth.onAuthStateChange((_event, session) => { setTimeout(() => emit(session), 0); }); // never await inside the callback
}

async function fetchPlan(sb, userId) {
  const { data, error } = await sb.from('profiles').select('plan, plan_until').eq('id', userId).maybeSingle();
  if (error || !data) return 'free';
  if (data.plan_until && new Date(data.plan_until) < new Date()) return 'free';
  return data.plan || 'free';
}

/**
 * E-mail + password. No confirmation e-mail: this needs "Confirm email" switched OFF in the Supabase dashboard
 * (Authentication -> Sign In / Providers -> Email). If it is still on, sign-up returns no session and we say so.
 */
export async function signUp(email, password) {
  const sb = await client();
  if (!sb) return { error: 'Les comptes ne sont pas encore activés.' };
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return { error: /registered|exists/i.test(error.message) ? 'Un compte existe déjà avec cet e-mail. Connecte-toi.' : /password/i.test(error.message) ? 'Mot de passe trop court : 6 caractères minimum.' : 'Création impossible pour le moment. Réessaie dans une minute.' };
  if (!data.session) return { error: 'Compte créé, mais la vérification par e-mail est encore activée côté Supabase.' };
  return { error: null };
}
export async function signIn(email, password) {
  const sb = await client();
  if (!sb) return { error: 'Les comptes ne sont pas encore activés.' };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return { error: error ? 'E-mail ou mot de passe incorrect.' : null };
}
export async function signOut() { const sb = await client(); if (sb) await sb.auth.signOut(); }

/** Every pin of the city, details only for the shops the caller's plan unlocks. null = not available (fall back to the JSON). */
export async function cityLeads(insee) {
  const sb = await client();
  if (!sb) return null;
  const { data, error } = await sb.rpc('city_leads', { p_insee: insee });
  if (error || !Array.isArray(data) || !data.length) return null;
  return data.map((r) => ({
    id: r.id, trade: r.trade, tier: r.tier, lat: r.lat, lon: r.lon, _locked: !!r.locked,
    name: r.name || '', addr: r.addr, phone: r.phone, hours: r.hours, email: r.email,
    social: r.social || {}, cuisine: r.cuisine, siret: r.siret, domain: r.domain,
  }));
}

export async function joinWaitlist(email, plan) {
  const sb = await client();
  if (!sb) return false;
  const { error } = await sb.from('waitlist').insert({ email, plan });
  return !error;
}

async function userId(sb) { const { data } = await sb.auth.getSession(); return data.session?.user?.id || null; }

export async function pullPipeline() {
  const sb = await client(); if (!sb) return null;
  const uid = await userId(sb); if (!uid) return null;
  const { data, error } = await sb.from('pipeline').select('lead_id, city, name, status, updated_at');
  if (error) return null;
  return Object.fromEntries(data.map((r) => [r.lead_id, { status: r.status, name: r.name, city: r.city, ts: Date.parse(r.updated_at) }]));
}

export async function pushStatus(lead, city, insee, status) {
  const sb = await client(); if (!sb) return;
  const uid = await userId(sb); if (!uid) return;
  if (!status) { await sb.from('pipeline').delete().eq('user_id', uid).eq('lead_id', lead.id); return; }
  await sb.from('pipeline').upsert({ user_id: uid, lead_id: lead.id, city_insee: insee, city, name: lead.name, status, updated_at: new Date().toISOString() });
}

export async function reportHasSite(leadId, insee) {
  const sb = await client(); if (!sb) return;
  const uid = await userId(sb); if (!uid) return;
  await sb.from('reports').upsert({ user_id: uid, city_insee: insee, lead_id: leadId, kind: 'has_site' }, { onConflict: 'user_id,city_insee,lead_id', ignoreDuplicates: true });
}
