// Whop -> Supabase: activates / ends a plan when a membership changes. Needs supabase/payments.sql.
//
// Deploy:   supabase functions deploy whop-webhook --no-verify-jwt
// Secrets:  supabase secrets set WHOP_WEBHOOK_SECRET=ws_...  WHOP_PLAN_MAP='{"plan_AAA":"m1","plan_BBB":"m3","plan_CCC":"y1"}'
// In Whop:  Developer -> Webhooks -> https://<project>.supabase.co/functions/v1/whop-webhook
//           events: membership.activated, membership.deactivated, payment.succeeded
//           permissions: member:basic:read and member:email:read (without the second one, Whop sends user.email = null)
//
// Signature (checked against @whop/sdk's unwrapWebhook): HMAC-SHA256 of "{webhook-id}.{webhook-timestamp}.{raw body}",
// keyed with the literal bytes of the ws_ secret, sent as "v1,<base64>" in the webhook-signature header.
//
// Every event is written to whop_events with what happened to it, so nothing is lost:
// applied / pending (no account yet: applied at sign-up or claimed from the profile) / unmatched (no e-mail) / ignored.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SECRET = Deno.env.get('WHOP_WEBHOOK_SECRET') ?? '';
const PLAN_MAP: Record<string, string> = JSON.parse(Deno.env.get('WHOP_PLAN_MAP') ?? '{}');
const MONTHS: Record<string, number> = { m1: 1, m3: 3, y1: 12 };
const GRACE = 2 * 864e5; // renewals can land a little after the period end: keep access meanwhile
const ACTIVATE = new Set(['membership.activated', 'membership.went_valid', 'payment.succeeded']);
const DEACTIVATE = new Set(['membership.deactivated', 'membership.went_invalid']);
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const pick = (o: any, ...paths: string[]) => {
  for (const p of paths) { const v = p.split('.').reduce((x, k) => (x == null ? x : x[k]), o); if (v != null && v !== '') return v; }
  return null;
};
const email = (v: unknown) => (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? v.trim().toLowerCase() : null);

async function validSignature(req: Request, body: string): Promise<boolean> {
  const id = req.headers.get('webhook-id'), ts = req.headers.get('webhook-timestamp'), sig = req.headers.get('webhook-signature');
  if (!SECRET || !id || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay window: 5 minutes
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sig.split(' ').some((part) => part.replace(/^v1,/, '') === expected);
}

/** the account for this buyer: the Whop user id already linked, else the same e-mail */
async function findProfile(whopUserId: string | null, mail: string | null): Promise<{ id: string; whop_membership_id?: string | null } | null> {
  // select('*'): still works before payments.sql adds the whop_* columns
  if (whopUserId) {
    const { data } = await admin.from('profiles').select('*').eq('whop_user_id', whopUserId).limit(1).maybeSingle();
    if (data) return data;
  }
  if (mail) {
    const { data } = await admin.from('profiles').select('*').ilike('email', mail.replace(/[\\%_]/g, '\\$&')).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const body = await req.text();
  if (!(await validSignature(req, body))) { console.warn('whop-webhook: bad signature'); return new Response('bad signature', { status: 401 }); }

  const event = JSON.parse(body);
  const webhookId = req.headers.get('webhook-id');
  const type: string = event.type ?? event.action ?? '';
  const data = event.data ?? {};
  const isPayment = type.startsWith('payment.');
  const membership = isPayment ? (data.membership ?? {}) : data;

  const mail = email(pick(data, 'user.email', 'member.email', 'email', 'customer_email', 'user_email', 'billing_address.email'));
  const whopUserId = pick(data, 'user.id', 'user_id', 'member.user.id');
  const membershipId = isPayment ? pick(data, 'membership.id', 'membership_id') : pick(data, 'id');
  const whopPlan = pick(data, 'plan.id', 'plan_id', 'membership.plan.id');
  const plan = whopPlan ? PLAN_MAP[String(whopPlan)] ?? null : null;
  const end = pick(membership, 'renewal_period_end', 'expires_at', 'valid_until');
  const manageUrl = pick(membership, 'manage_url');
  const until = plan ? new Date((end ? new Date(typeof end === 'number' ? end * 1000 : end).getTime() : Date.now() + MONTHS[plan] * 31 * 864e5) + GRACE) : null;

  // log first (dedup on the webhook id: a retry of an event already handled stops here)
  const { data: row, error: logErr } = await admin.from('whop_events').insert({
    webhook_id: webhookId, type, email: mail, whop_user_id: whopUserId, membership_id: membershipId, whop_plan: whopPlan, plan,
    plan_until: until?.toISOString() ?? null, manage_url: manageUrl, payload: event,
  }).select('id').single();
  if (logErr) {
    if (logErr.code === '23505') return new Response('duplicate', { status: 200 });
    console.error('whop-webhook: log failed (did you run supabase/payments.sql?)', logErr);
  }
  const eventId: number | null = row?.id ?? null;
  const mark = async (status: string, note: string | null = null, appliedTo: string | null = null) => {
    if (eventId) await admin.from('whop_events').update({ status, note, applied_to: appliedTo }).eq('id', eventId);
    console.log('whop-webhook', type, status, note ?? '', mail ?? '(no e-mail)', whopPlan ?? '');
  };

  try {
    if (ACTIVATE.has(type)) {
      if (!plan) { await mark('ignored', `plan Whop inconnu : ${whopPlan ?? 'aucun'} (vérifie WHOP_PLAN_MAP)`); return new Response('ok'); }
      const profile = await findProfile(whopUserId, mail);
      if (!profile) {
        await mark(mail ? 'pending' : 'unmatched', mail ? 'aucun compte avec cet e-mail : appliqué à l’inscription ou depuis le profil' : 'Whop n’a pas envoyé d’e-mail (permission member:email:read ?)');
        return new Response('ok');
      }
      let { error } = await admin.from('profiles').update({
        plan, plan_until: until!.toISOString(), whop_user_id: whopUserId, whop_membership_id: membershipId, ...(manageUrl ? { whop_manage_url: manageUrl } : {}),
      }).eq('id', profile.id);
      if (error?.code === '42703') ({ error } = await admin.from('profiles').update({ plan, plan_until: until!.toISOString() }).eq('id', profile.id)); // payments.sql not run yet
      if (error) { await mark('error', error.message); return new Response('db error', { status: 500 }); }
      await mark('applied', null, profile.id);
    } else if (DEACTIVATE.has(type)) {
      const profile = await findProfile(whopUserId, mail);
      if (!profile) { await mark('unmatched', 'fin d’abonnement pour un compte introuvable'); return new Response('ok'); }
      // an upgrade creates a new membership, then ends the old one: only end the plan if it is this membership
      if (profile.whop_membership_id && membershipId && profile.whop_membership_id !== membershipId) { await mark('ignored', 'ancien abonnement remplacé'); return new Response('ok'); }
      const { error } = await admin.from('profiles').update({ plan: 'free', plan_until: null }).eq('id', profile.id);
      if (error) { await mark('error', error.message); return new Response('db error', { status: 500 }); }
      await mark('applied', 'abonnement terminé', profile.id);
    } else {
      await mark('ignored', 'événement non utilisé');
    }
  } catch (e) {
    await mark('error', String(e));
    return new Response('error', { status: 500 });
  }
  return new Response('ok', { status: 200 });
});
