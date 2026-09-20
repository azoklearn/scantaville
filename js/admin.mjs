// Admin dashboard. The page itself is public (static hosting): what protects the data is that every admin_* database
// function checks profiles.is_admin for the signed-in user and raises 'forbidden' otherwise.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.mjs';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);
const PLAN = { free: 'Découverte', m1: 'Essentiel', m3: 'Pro', y1: 'Illimité' };
const STATUS = { todo: 'À contacter', contacted: 'Contacté', meeting: 'RDV', won: 'Signé', lost: 'Non' };
const day = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const cell = (text, cls) => { const td = document.createElement('td'); if (cls) { const s = document.createElement('span'); s.className = cls; s.textContent = text; td.append(s); } else td.textContent = text; return td; };
const row = (...cells) => { const tr = document.createElement('tr'); tr.append(...cells); return tr; };
let users = [];

async function show(session) {
  $('#login').hidden = !!session; $('#out').hidden = !session; $('#who').textContent = session?.user?.email || '';
  if (!session) { $('#app').hidden = true; return; }
  const { data: ok } = await sb.rpc('is_admin');
  if (!ok) { $('#app').hidden = true; $('#login').hidden = false; $('#login-msg').className = 'msg err'; $('#login-msg').textContent = 'Ce compte n’est pas administrateur.'; return; }
  $('#app').hidden = false;
  await Promise.all([overview(), loadUsers(''), waitlist()]);
}

async function overview() {
  const { data: o, error } = await sb.rpc('admin_overview');
  if (error || !o) return;
  const kpi = (n, label) => { const d = document.createElement('div'); d.className = 'kpi'; const b = document.createElement('b'); b.textContent = Number(n).toLocaleString('fr-FR'); const s = document.createElement('span'); s.textContent = label; d.append(b, s); return d; };
  const rate = o.users ? Math.round((o.paying / o.users) * 1000) / 10 : 0;
  $('#kpis').replaceChildren(kpi(o.users, 'inscrits'), kpi(o.users_today, 'dernières 24 h'), kpi(o.users_7d, '7 derniers jours'), kpi(o.paying, 'abonnés actifs'), kpi(rate, '% convertis'), kpi(o.waitlist, 'liste d’attente'), kpi(o.reports, 'signalements'));
  const pills = (box, obj, names) => box.replaceChildren(...Object.entries(obj || {}).map(([k, n]) => { const p = document.createElement('span'); p.className = 'pill'; p.textContent = names[k] || k; const b = document.createElement('b'); b.textContent = n; p.append(b); return p; }));
  pills($('#plans'), o.by_plan, PLAN); pills($('#pipe'), o.pipeline, STATUS);
  // 30 bars, one per day, zero-filled
  const byDay = Object.fromEntries((o.signups_by_day || []).map((x) => [x.day, x.n])), days = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push([d, byDay[d] || 0]); }
  const max = Math.max(1, ...days.map((d) => d[1]));
  $('#bars').replaceChildren(...days.map(([d, n]) => { const i = document.createElement('i'); i.style.height = Math.max(2, (n / max) * 100) + '%'; i.title = `${day(d)} : ${n}`; if (!n) i.style.opacity = '.18'; return i; }));
  $('#bars-x').replaceChildren(...[days[0][0], days[29][0]].map((d) => { const s = document.createElement('span'); s.textContent = day(d); return s; }));
}

async function loadUsers(q) {
  const { data, error } = await sb.rpc('admin_users', { p_search: q, p_limit: 500 });
  if (error) return;
  users = data || [];
  $('#users').replaceChildren(...users.map((u) => row(cell(u.email || '—'), cell(PLAN[u.plan] || u.plan, 'tag' + (u.plan !== 'free' ? ' paid' : '')), cell(day(u.plan_until)), cell(day(u.created_at)), cell(day(u.last_sign_in_at)), cell(String(u.tracked)), cell(String(u.won)))));
}

async function waitlist() {
  const { data } = await sb.rpc('admin_waitlist', { p_limit: 500 });
  $('#wait').replaceChildren(...(data || []).map((w) => row(cell(w.email), cell(PLAN[w.plan] || w.plan || '—'), cell(day(w.created_at)))));
}

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  f.password.value = '';
  if (error) { $('#login-msg').className = 'msg err'; $('#login-msg').textContent = 'E-mail ou mot de passe incorrect.'; }
});
$('#out').addEventListener('click', () => sb.auth.signOut());
let t = 0;
$('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => loadUsers(e.target.value.trim()), 250); });
$('#csv').addEventListener('click', () => {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [['email', 'formule', 'jusqu_au', 'inscrit_le', 'derniere_connexion', 'prospects_suivis', 'signes'].join(';'),
    ...users.map((u) => [u.email, u.plan, u.plan_until, u.created_at, u.last_sign_in_at, u.tracked, u.won].map(esc).join(';'))];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'scantaville-inscrits.csv'; a.click();
});
$('#grant').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, until = f.until.value ? new Date(f.until.value + 'T23:59:59').toISOString() : null;
  const { error } = await sb.rpc('admin_set_plan', { p_email: f.email.value.trim(), p_plan: f.plan.value, p_until: f.plan.value === 'free' ? null : until });
  $('#grant-msg').className = error ? 'msg err' : 'msg'; $('#grant-msg').textContent = error ? 'Échec : ' + error.message : `Formule ${PLAN[f.plan.value]} appliquée à ${f.email.value.trim()} (si ce compte existe).`;
  if (!error) { overview(); loadUsers($('#q').value.trim()); }
});

const { data } = await sb.auth.getSession();
show(data.session);
sb.auth.onAuthStateChange((_e, session) => setTimeout(() => show(session), 0));
