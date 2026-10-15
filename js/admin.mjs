// Admin dashboard. The page itself is public (static hosting): what protects the data is that every admin_* database
// function checks profiles.is_admin for the signed-in user and raises 'forbidden' otherwise.
// Uses supabase/admin_v2.sql when it has been run; falls back to the older admin_overview / admin_users otherwise.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.mjs';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
};
const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

const PLAN = { free: 'Découverte', m1: 'Essentiel', m3: 'Pro', y1: 'Illimité' };
const PRICE = { m1: 19.9, m3: 29.9 / 3, y1: 79 / 12 }; // per month
const STATUS = { todo: 'À contacter', contacted: 'Contacté', meeting: 'RDV', won: 'Signé', lost: 'Non' };
const PAY = { applied: 'Appliqué', pending: 'En attente', unmatched: 'Sans e-mail', ignored: 'Ignoré', error: 'Erreur', received: 'Reçu' };
const fr = (n, d = 0) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });
const eur = (n) => fr(n, n % 1 ? 2 : 0) + ' €';
const day = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
function ago(d) {
  if (!d) return '—';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'à l’instant'; if (s < 3600) return `il y a ${Math.floor(s / 60)} min`; if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `il y a ${Math.floor(s / 86400)} j`; return day(d);
}
let toastT = 0;
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3000); };

const st = { dash: null, users: [], filter: 'all', range: 30, v2: true };
const demo = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('demo'); // local preview with fake data

// ───────────────────────── data ─────────────────────────
async function rpc(name, args) { const { data, error } = await sb.rpc(name, args); if (error) throw error; return data; }

async function loadDashboard() {
  if (demo) return (st.dash = fakeDash());
  try { st.dash = await rpc('admin_dashboard'); st.v2 = true; }
  catch {
    st.v2 = false;
    const o = await rpc('admin_overview');
    st.dash = { users: o.users, users_today: o.users_today, users_7d: o.users_7d, paying: o.paying, paying_by_plan: Object.fromEntries(Object.entries(o.by_plan || {}).filter(([k]) => k !== 'free')),
      signups_by_day: o.signups_by_day, pipeline: o.pipeline, waitlist: o.waitlist, reports: o.reports, feed: [], top_cities: [], expiring: [], funnel: null };
    st.dash.mrr = Object.entries(st.dash.paying_by_plan).reduce((s, [k, n]) => s + (PRICE[k] || 0) * n, 0);
  }
  return st.dash;
}

// ───────────────────────── overview ─────────────────────────
function renderOverview() {
  const d = st.dash; if (!d) return;
  const h = new Date().getHours();
  $('#hello').textContent = h < 6 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
  $('#updated').textContent = 'Mis à jour ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  $('#banner').hidden = st.v2; $('#banner').textContent = 'Version simplifiée : lance supabase/admin_v2.sql dans Supabase (SQL Editor) pour l’activité, l’entonnoir, les villes et le détail des utilisateurs.';

  const series = fill(d.signups_by_day, 30);
  const delta = (d.users_prev_7d != null) ? d.users_7d - d.users_prev_7d : null;
  const conv = d.users ? (d.paying / Math.max(1, d.users - (d.admins || 0))) * 100 : 0;
  const kpi = (label, value, sub, opts = {}) => {
    const k = el('div', { class: 'kpi' + (opts.hero ? ' hero' : '') }, el('span', { text: label }), el('b', { text: value }), sub ? el('small', { class: opts.cls || '', text: sub }) : null);
    if (opts.spark) k.append(spark(opts.spark));
    return k;
  };
  $('#kpis').replaceChildren(
    kpi('Revenu mensuel', eur(d.mrr || 0), `${fr(d.paying)} abonné${d.paying > 1 ? 's' : ''} actif${d.paying > 1 ? 's' : ''}`, { hero: true }),
    kpi('Inscrits', fr(d.users), `+${fr(d.users_7d)} en 7 j` + (delta != null ? ` (${delta >= 0 ? '+' : ''}${delta} vs 7 j avant)` : ''), { cls: delta == null ? '' : delta >= 0 ? 'up' : 'down', spark: series.map((x) => x[1]) }),
    kpi('Aujourd’hui', fr(d.users_today), 'inscriptions sur 24 h'),
    kpi('Conversion', fr(conv, 1) + ' %', 'inscrits devenus payants'),
    kpi('Actifs 7 j', d.active_7d != null ? fr(d.active_7d) : '—', 'connectés cette semaine'),
    kpi('Sites en ligne', d.sites?.published != null ? fr(d.sites.published) : '—', d.sites?.published_7d != null ? `+${fr(d.sites.published_7d)} en 7 j` : 'publiés par les membres'),
  );

  drawChart(fill(d.signups_by_day, st.range));

  // revenue by plan
  const byPlan = d.paying_by_plan || {}, total = Object.entries(byPlan).reduce((s, [k, n]) => s + (PRICE[k] || 0) * n, 0) || 1;
  $('#mrr').textContent = eur(d.mrr || 0);
  $('#mrr-tag').textContent = `≈ ${eur(Math.round((d.mrr || 0) * 12))} / an`;
  $('#plans').replaceChildren(...['m1', 'm3', 'y1'].map((k) => {
    const n = byPlan[k] || 0, rev = (PRICE[k] || 0) * n;
    return el('div', { class: 'plan-row' }, el('b', { text: PLAN[k] }), el('div', { class: 'meter' }, el('i', { style: `width:${(rev / total) * 100}%` })), el('small', { text: `${n} · ${eur(Math.round(rev * 100) / 100)}` }));
  }));

  // funnel
  const f = d.funnel;
  if (f) {
    const steps = [['Inscrits', f.signed_up], ['Ont suivi un prospect', f.tracked], ['Ont signé un site', f.won], ['Payants', f.paying]], top = Math.max(1, f.signed_up);
    $('#funnel').replaceChildren(...steps.map(([label, n], i) => el('div', { class: 'fstep' }, el('i', { style: `width:${(n / top) * 100}%` }),
      el('div', {}, el('span', { text: label }), el('span', {}, el('b', { text: fr(n) }), ' ', i ? el('small', { text: `${fr((n / top) * 100, 1)} %` }) : null)))));
  } else $('#funnel').replaceChildren(el('p', { class: 'empty', text: 'Disponible avec admin_v2.sql.' }));

  // pipeline
  const pipe = d.pipeline || {}, pmax = Math.max(1, ...Object.values(pipe));
  $('#pipe-7d').textContent = d.pipeline_7d != null ? `${fr(d.pipeline_7d)} mises à jour en 7 j` : '';
  $('#pipe').replaceChildren(...(Object.keys(pipe).length ? Object.keys(STATUS).filter((k) => pipe[k]).map((k) => el('div', { class: 'hbar' }, el('span', { text: STATUS[k] }), el('div', { class: 'meter' }, el('i', { style: `width:${(pipe[k] / pmax) * 100}%;${k === 'won' ? 'background:var(--ok)' : k === 'lost' ? 'background:var(--line-2)' : ''}` })), el('span', { text: fr(pipe[k]) })))
    : [el('p', { class: 'empty', text: 'Aucun prospect suivi pour l’instant.' })]));

  // cities
  $('#cities').replaceChildren(...(d.top_cities?.length ? d.top_cities.map((c) => el('li', {}, el('span', { text: c.city }), el('small', { text: `${fr(c.n)} suivis · ${fr(c.won)} signés` })))
    : [el('li', { class: 'empty', text: st.v2 ? 'Pas encore de données.' : 'Disponible avec admin_v2.sql.' })]));

  // feed
  const ICON = { signup: '＋', payment: '€', churn: '↓', won: '★' };
  const LABEL = { signup: 'Inscription', payment: 'Paiement', churn: 'Fin d’abonnement', won: 'Site signé' };
  const feed = [...(d.feed || []), ...(d.feed_whop || [])].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 25);
  $('#feed').replaceChildren(...(feed.length ? feed.map((x) => el('li', {}, el('span', { class: 'ico ' + x.kind, text: ICON[x.kind] || '•' }),
    el('div', {}, el('b', { text: x.who || '—' }), el('div', { class: 'muted small', text: [LABEL[x.kind], x.kind === 'signup' ? null : (PLAN[x.detail] || x.detail), x.status && x.status !== 'applied' ? PAY[x.status] : null].filter(Boolean).join(' · ') })),
    el('time', { text: ago(x.at), title: new Date(x.at).toLocaleString('fr-FR') })))
    : [el('li', { class: 'empty', text: st.v2 ? 'Rien pour l’instant.' : 'Disponible avec admin_v2.sql.' })]));

  // expiring
  $('#exp-n').textContent = String(d.expiring?.length || 0);
  $('#expiring').replaceChildren(...(d.expiring?.length ? d.expiring.map((x) => el('li', {}, el('span', { text: x.email }), el('small', { class: 'muted', text: `${PLAN[x.plan]} · ${day(x.until)}` })))
    : [el('li', { class: 'empty', text: 'Aucun.' })]));

  // usage
  const u = (v, label) => el('div', {}, el('b', { text: v }), el('span', { text: label }));
  $('#usage').replaceChildren(
    u(d.coach?.users != null ? fr(d.coach.users) : '—', 'plans « Mon plan »'),
    u(d.coach?.avg_goal != null ? eur(d.coach.avg_goal) : '—', 'objectif moyen / mois'),
    u(d.coach?.journal_notes != null ? fr(d.coach.journal_notes) : '—', 'notes de journal'),
    u(fr(d.waitlist || 0), 'liste d’attente'),
  );

  // payments to fix
  const fix = d.whop?.to_fix || 0;
  $('#pay-dot').hidden = !fix;
  if (fix) { const b = $('#banner'); b.hidden = false; b.className = 'banner bad'; b.replaceChildren(`${fix} paiement${fix > 1 ? 's' : ''} Whop à rattacher à un compte. `, el('a', { text: 'Voir les paiements →', onclick: () => go('payments') })); }
  else $('#banner').className = 'banner';
}

function fill(rows, days) {
  const by = Object.fromEntries((rows || []).map((x) => [String(x.day).slice(0, 10), x.n]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) { const dt = new Date(Date.now() - i * 864e5); const k = dt.toISOString().slice(0, 10); out.push([k, by[k] || 0]); }
  return out;
}
function spark(vals) {
  const s = svg('svg', { viewBox: '0 0 80 28', preserveAspectRatio: 'none', 'aria-hidden': 'true' }), max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * 80},${26 - (v / max) * 22}`).join(' ');
  s.append(svg('polyline', { points: pts, fill: 'none', stroke: '#1d5bff', 'stroke-width': '1.6', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  return s;
}
function drawChart(series) {
  const box = $('#chart'), W = 600, H = 200, padL = 26, padB = 22, max = Math.max(4, ...series.map((x) => x[1]));
  const step = Math.ceil(max / 4), top = step * 4;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Inscriptions par jour' });
  for (let i = 0; i <= 4; i++) {
    const y = (H - padB) - ((H - padB - 8) * i) / 4;
    s.append(svg('line', { x1: padL, x2: W, y1: y, y2: y, class: 'grid-l' }));
    const t = svg('text', { x: 0, y: y + 3 }); t.textContent = String(step * i); s.append(t);
  }
  const bw = (W - padL) / series.length, tip = el('div', { class: 'tip' });
  series.forEach(([k, n], i) => {
    const h = n ? Math.max(3, ((H - padB - 8) * n) / top) : 2;
    const r = svg('rect', { x: padL + i * bw + bw * 0.18, y: (H - padB) - h, width: bw * 0.64, height: h, rx: Math.min(4, bw * 0.2), class: 'col' + (n ? '' : ' zero') });
    r.addEventListener('mouseenter', () => { tip.textContent = `${new Date(k + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${n} inscrit${n > 1 ? 's' : ''}`; tip.style.left = ((padL + (i + 0.5) * bw) / W) * 100 + '%'; tip.style.top = (((H - padB) - h) / H) * 100 + '%'; tip.classList.add('on'); });
    r.addEventListener('mouseleave', () => tip.classList.remove('on'));
    s.append(r);
    if (i === 0 || i === series.length - 1 || (series.length > 10 && i % 7 === 0)) {
      const t = svg('text', { x: padL + (i + 0.5) * bw, y: H - 4, 'text-anchor': 'middle' }); t.textContent = new Date(k + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); s.append(t);
    }
  });
  box.replaceChildren(s, tip);
}

// ───────────────────────── users ─────────────────────────
async function loadUsers() {
  const q = $('#q').value.trim();
  if (demo) st.users = fakeUsers().filter((u) => !q || u.email.includes(q));
  else if (st.v2) { try { st.users = await rpc('admin_users_v2', { p_search: q, p_filter: st.filter, p_limit: 500 }) || []; } catch { st.v2 = false; } }
  if (!st.v2 && !demo) {
    const rows = await rpc('admin_users', { p_search: q, p_limit: 500 }).catch(() => []);
    st.users = (rows || []).map((u) => ({ ...u, contacted: u.tracked, active: u.plan !== 'free' && (!u.plan_until || new Date(u.plan_until) > new Date()) }))
      .filter((u) => st.filter === 'all' || (st.filter === 'paying' ? u.active : st.filter === 'free' ? !u.active : st.filter === 'expired' ? u.plan !== 'free' && !u.active : new Date(u.last_sign_in_at) > Date.now() - 7 * 864e5));
  }
  renderUsers();
}
function planBadge(u) {
  const expired = u.plan !== 'free' && u.plan_until && new Date(u.plan_until) < new Date();
  return el('span', {}, el('span', { class: 'badge ' + (expired ? 'exp' : u.plan), text: expired ? `${PLAN[u.plan]} expiré` : PLAN[u.plan] || u.plan }), u.is_admin ? el('span', { class: 'badge adm', style: 'margin-left:4px', text: 'admin' }) : null);
}
function renderUsers() {
  $('#users').replaceChildren(...st.users.map((u) => {
    const tr = el('tr', { class: st.v2 || demo ? 'click' : '' },
      el('td', {}, el('div', { class: 'user' }, el('span', { class: 'av', text: (u.email || '?')[0].toUpperCase() }), el('span', { text: u.email || '—' }))),
      el('td', {}, planBadge(u)), el('td', { text: u.plan === 'free' ? '—' : u.plan_until ? day(u.plan_until) : 'sans fin' }),
      el('td', { text: day(u.created_at) }), el('td', { text: ago(u.last_sign_in_at) }),
      el('td', { class: 'r', text: fr(u.contacted) }), el('td', { class: 'r', text: fr(u.won) }), el('td', { class: 'r', text: u.sites != null ? fr(u.sites) : '—' }),
      el('td', { class: 'r', text: u.goal ? eur(Number(u.goal)) : '—' }));
    if (st.v2 || demo) tr.addEventListener('click', () => openUser(u));
    return tr;
  }));
  $('#users-n').textContent = `${fr(st.users.length)} utilisateur${st.users.length > 1 ? 's' : ''}` + (st.v2 || demo ? ' · clique sur une ligne pour le détail' : '');
}

async function openUser(u) {
  $('#drawer').hidden = false;
  const body = $('#d-body');
  body.replaceChildren(el('div', { class: 'skel', style: 'height:46px' }));
  const d = demo ? fakeDetail(u) : await rpc('admin_user_detail', { p_id: u.id }).catch(() => null);
  if (!d) { body.replaceChildren(el('p', { class: 'empty', text: 'Détail indisponible.' })); return; }
  const p = d.profile || u;
  const kv = (label, v) => el('div', {}, el('span', { text: label }), el('b', { text: v }));
  const sec = (title, ...kids) => el('div', { class: 'd-sec' }, el('h4', { text: title }), ...kids);
  const list = (items, empty) => items.length ? el('ul', { class: 'd-list' }, ...items) : el('p', { class: 'empty', text: empty });
  const grant = el('form', { class: 'toolbar' },
    el('select', { name: 'plan' }, ...['m1', 'm3', 'y1', 'free'].map((k) => { const o = el('option', { value: k, text: k === 'free' ? 'Découverte (retirer)' : PLAN[k] }); if (k === p.plan) o.selected = true; return o; })),
    el('input', { name: 'until', type: 'date', title: 'Fin (vide = sans fin)' }), el('button', { class: 'btn', type: 'submit', text: 'Appliquer' }));
  grant.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = grant.elements, until = f.until.value ? new Date(f.until.value + 'T23:59:59').toISOString() : null;
    if (demo) return toast('Mode démo : rien n’est écrit.');
    const { error } = await sb.rpc('admin_set_plan', { p_email: p.email, p_plan: f.plan.value, p_until: f.plan.value === 'free' ? null : until });
    toast(error ? 'Échec : ' + error.message : `Formule ${PLAN[f.plan.value]} appliquée.`);
    if (!error) { $('#drawer').hidden = true; refresh(); }
  });
  const coach = d.coach?.plan;
  body.replaceChildren(
    el('div', { class: 'd-head' }, el('span', { class: 'av', text: (p.email || '?')[0].toUpperCase() }), el('div', {}, el('h3', { id: 'd-email', text: p.email }), planBadge({ ...u, ...p }))),
    el('div', { class: 'd-grid' }, kv('Inscrit le', day(p.created_at)), kv('Dernière connexion', ago(p.last_sign_in_at)), kv('Formule jusqu’au', p.plan === 'free' ? '—' : p.plan_until ? day(p.plan_until) : 'sans fin'),
      kv('Objectif', coach?.goal ? `${eur(coach.goal)} / mois` : '—'), kv('Ville', coach?.city || '—'), kv('Notes de journal', fr(d.coach?.notes || 0))),
    sec('Donner une formule', grant),
    sec(`Prospects (${(d.pipeline || []).length})`, list((d.pipeline || []).slice(0, 40).map((x) => el('li', {}, el('span', { text: `${x.name || '—'}${x.city ? ' · ' + x.city : ''}` }), el('span', { class: 'badge' + (x.status === 'won' ? ' applied' : ''), text: STATUS[x.status] || x.status }))), 'Aucun prospect suivi.')),
    sec(`Sites en ligne (${(d.sites || []).length})`, list((d.sites || []).map((s) => el('li', {}, el('a', { href: `/site/${encodeURIComponent(s.slug)}`, target: '_blank', rel: 'noopener', text: s.name || s.slug }), el('span', { class: 'muted', text: day(s.at) }))), 'Aucun site publié.')),
    d.payments ? sec('Paiements Whop', list(d.payments.map((x) => el('li', {}, el('span', { text: `${x.type.replace('membership.', '')} · ${PLAN[x.plan] || '—'}` }), el('span', { class: 'badge ' + x.status, text: PAY[x.status] || x.status }))), 'Aucun événement.')) : null,
  );
}
for (const n of $$('#drawer [data-close]')) n.addEventListener('click', () => { $('#drawer').hidden = true; });
addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#drawer').hidden = true; });

// ───────────────────────── payments & waitlist ─────────────────────────
async function payments() {
  let data = [];
  if (demo) data = [{ id: 1, created_at: new Date().toISOString(), type: 'membership.activated', email: 'lea@exemple.fr', plan: 'm3', status: 'pending', note: 'aucun compte' }];
  else { try { data = await rpc('admin_whop_events', { p_limit: 200 }); } catch { $('#pay-msg').textContent = 'Journal indisponible : lance supabase/payments.sql dans Supabase.'; return; } }
  $('#pay-msg').textContent = data?.length ? '' : 'Aucun événement reçu pour l’instant.';
  $('#pay').replaceChildren(...(data || []).map((w) => {
    const act = el('td');
    if (w.plan && ['pending', 'unmatched'].includes(w.status)) {
      const f = el('form', { class: 'assign' }, el('input', { type: 'email', required: '', placeholder: 'e-mail du compte', value: w.email || '' }), el('button', { type: 'submit', text: 'Attribuer' }));
      f.addEventListener('submit', async (e) => {
        e.preventDefault(); const mail = f.querySelector('input').value.trim();
        if (demo) return toast('Mode démo : rien n’est écrit.');
        const { error } = await sb.rpc('admin_assign_whop_event', { p_event: w.id, p_email: mail });
        toast(error ? (/no account/.test(error.message) ? 'Aucun compte avec cet e-mail.' : 'Échec : ' + error.message) : `Formule ${PLAN[w.plan]} attribuée à ${mail}.`);
        if (!error) refresh();
      });
      act.append(f);
    }
    const status = el('td', {}, el('span', { class: 'badge ' + w.status, text: PAY[w.status] || w.status, title: w.note || '' }));
    return el('tr', {}, el('td', { text: new Date(w.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }), el('td', { text: w.type }),
      el('td', { text: w.email || '—' }), el('td', { text: PLAN[w.plan] || w.plan || '—' }), status, el('td', { text: w.applied_email || '—' }), act);
  }));
}
async function waitlist() {
  const data = demo ? [] : await rpc('admin_waitlist', { p_limit: 500 }).catch(() => []);
  $('#wait').replaceChildren(...(data?.length ? data.map((w) => el('tr', {}, el('td', { text: w.email }), el('td', { text: PLAN[w.plan] || w.plan || '—' }), el('td', { text: day(w.created_at) })))
    : [el('tr', {}, el('td', { colspan: '3', class: 'muted', text: 'Liste vide.' }))]));
}

// ───────────────────────── navigation, auth ─────────────────────────
function go(tab) {
  $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('.tab').forEach((s) => { s.hidden = s.id !== 'tab-' + tab; });
  history.replaceState(null, '', '#' + tab);
}
$$('#tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
$$('#range button').forEach((b) => b.addEventListener('click', () => { st.range = Number(b.dataset.d); $$('#range button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawChart(fill(st.dash?.signups_by_day, st.range)); }));
$$('#ufilter button').forEach((b) => b.addEventListener('click', () => { st.filter = b.dataset.f; $$('#ufilter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); loadUsers(); }));
let qt = 0;
$('#q').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(loadUsers, 250); });
$('#csv').addEventListener('click', () => {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cols = ['email', 'plan', 'plan_until', 'created_at', 'last_sign_in_at', 'contacted', 'won', 'sites', 'goal'];
  const lines = [cols.join(';'), ...st.users.map((u) => cols.map((c) => esc(u[c])).join(';'))];
  const a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })), download: 'scantaville-utilisateurs.csv' }); a.click();
});
$('#grant').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, until = f.until.value ? new Date(f.until.value + 'T23:59:59').toISOString() : null;
  const { error } = await sb.rpc('admin_set_plan', { p_email: f.email.value.trim(), p_plan: f.plan.value, p_until: f.plan.value === 'free' ? null : until });
  $('#grant-msg').textContent = error ? 'Échec : ' + error.message : `Formule ${PLAN[f.plan.value]} appliquée à ${f.email.value.trim()} (si ce compte existe).`;
  if (!error) refresh();
});
async function refresh() {
  $('#refresh').classList.add('spin'); setTimeout(() => $('#refresh').classList.remove('spin'), 450);
  await loadDashboard().catch(() => null); renderOverview();
  await Promise.all([loadUsers(), payments(), waitlist()]);
}
$('#refresh').addEventListener('click', refresh);

async function show(session) {
  const on = demo || !!session;
  $('#login').hidden = on; $('#out').hidden = !on; $('#refresh').hidden = !on; $('#who').textContent = demo ? 'démo locale' : session?.user?.email || '';
  if (!on) { $('#app').hidden = true; $('#tabs').hidden = true; return; }
  if (!demo) {
    const { data: ok } = await sb.rpc('is_admin');
    if (!ok) { $('#app').hidden = true; $('#tabs').hidden = true; $('#login').hidden = false; $('#login-msg').textContent = 'Ce compte n’est pas administrateur.'; return; }
  }
  $('#app').hidden = false; $('#tabs').hidden = false;
  go(['overview', 'users', 'payments', 'waitlist'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview');
  await refresh();
}
$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  f.password.value = '';
  if (error) $('#login-msg').textContent = 'E-mail ou mot de passe incorrect.';
});
$('#out').addEventListener('click', () => sb.auth.signOut());

// ───────────────────────── local demo data (localhost + ?demo only) ─────────────────────────
function fakeDash() {
  const days = Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10), n: Math.max(0, Math.round(3 + Math.sin(i / 3) * 3 + i / 5)) }));
  return { users: 184, users_today: 6, users_7d: 31, users_prev_7d: 24, active_7d: 52, admins: 3, paying: 14, paying_by_plan: { m1: 5, m3: 7, y1: 2 }, mrr: 5 * 19.9 + 7 * 29.9 / 3 + 2 * 79 / 12,
    expiring: [{ email: 'lea@exemple.fr', plan: 'm1', until: new Date(Date.now() + 2 * 864e5).toISOString() }], signups_by_day: days,
    funnel: { signed_up: 181, tracked: 64, won: 9, paying: 14 }, pipeline: { todo: 40, contacted: 210, meeting: 22, won: 11, lost: 63 }, pipeline_7d: 48,
    top_cities: [{ city: 'Tours', n: 88, won: 4 }, { city: 'Lyon', n: 61, won: 2 }, { city: 'Nancy', n: 30, won: 1 }], waitlist: 12, reports: 7,
    sites: { published: 9, published_7d: 3 }, coach: { users: 71, avg_goal: 1850, journal_notes: 133 }, whop: { to_fix: 1 },
    feed: [{ at: new Date(Date.now() - 4e5).toISOString(), kind: 'signup', who: 'max@exemple.fr', detail: 'free' }, { at: new Date(Date.now() - 36e5).toISOString(), kind: 'won', who: 'lea@exemple.fr', detail: 'Boulangerie Martin · Tours' }],
    feed_whop: [{ at: new Date(Date.now() - 9e5).toISOString(), kind: 'payment', who: 'tom@exemple.fr', detail: 'm3', status: 'applied' }] };
}
function fakeUsers() {
  return [{ id: 1, email: 'lea@exemple.fr', plan: 'm1', plan_until: new Date(Date.now() + 2 * 864e5).toISOString(), created_at: '2026-09-21', last_sign_in_at: new Date(Date.now() - 3e6).toISOString(), contacted: 34, won: 2, sites: 1, goal: 2000 },
    { id: 2, email: 'tom@exemple.fr', plan: 'm3', plan_until: null, created_at: '2026-10-01', last_sign_in_at: new Date(Date.now() - 9e7).toISOString(), contacted: 12, won: 0, sites: 0, goal: 1000 },
    { id: 3, email: 'noannono@icloud.com', plan: 'y1', is_admin: true, created_at: '2026-09-10', last_sign_in_at: new Date().toISOString(), contacted: 0, won: 0, sites: 0, goal: null },
    { id: 4, email: 'max@exemple.fr', plan: 'free', created_at: '2026-10-14', last_sign_in_at: null, contacted: 0, won: 0, sites: 0, goal: null }];
}
function fakeDetail(u) {
  return { profile: u, coach: { plan: { goal: u.goal, city: 'Tours' }, notes: 5 }, pipeline: [{ name: 'Boulangerie Martin', city: 'Tours', status: 'won' }, { name: 'Salon Léa', city: 'Tours', status: 'meeting' }],
    sites: [{ slug: 'boulangerie-martin-tours', name: 'Boulangerie Martin', at: '2026-10-10' }], payments: [{ type: 'membership.activated', plan: u.plan, status: 'applied' }] };
}

if (demo) show(null);
else {
  const { data } = await sb.auth.getSession();
  show(data.session);
  sb.auth.onAuthStateChange((_e, session) => setTimeout(() => show(session), 0));
}
