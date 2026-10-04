// "Mon profil": account, subscription (Whop), prospects with their status, sites built / online, password.
// The plan shown comes from the `profiles` table (set by the Whop webhook), never from the browser.
import * as store from './store.mjs';
import * as supa from './supa.mjs';
import { PLANS, FREE, MANAGE_URL, planById, priceLabel, perMonthLabel, savingPct } from './plans.mjs';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
};
const fr = (n) => Math.round(n).toLocaleString('fr-FR');
const date = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const track = (name, data) => { try { window.va?.('event', { name, data }); } catch { /* analytics off */ } };
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3000); }

const ui = { filter: 'all', q: '', profile: null, sites: [] };

// ───────────────────────── subscription ─────────────────────────
function renderSub() {
  const p = ui.profile, plan = planById(p.plan), level = plan?.level || 0;
  $('#pf-plan').replaceChildren(el('b', { text: plan ? plan.name : FREE.name }), plan ? el('span', { text: ` · ${priceLabel(plan)} ${plan.cycle}` }) : el('span', { text: ' · gratuit' }));
  $('#pf-badge').textContent = plan ? 'Actif' : p.expired ? 'Expiré' : 'Sans abonnement';
  $('#pf-badge').className = 'pl-pill' + (plan ? ' ok' : '');
  $('#pf-until').textContent = plan
    ? (p.plan_until ? `Renouvellement ou fin le ${date(p.plan_until)}.` : 'Sans date de fin.')
    : p.expired ? `Ton abonnement a pris fin le ${date(p.plan_until)}.` : 'Tu vois combien de commerces n’ont pas de site, mais pas lesquels. Choisis une formule pour les débloquer.';
  $('#pf-perks').replaceChildren(...(plan ? plan.perks : FREE.perks.map((t) => ({ text: t }))).map((x) => el('li', { text: x.text })));
  const acts = [];
  if (plan) acts.push(el('a', { class: 'ghost', href: p.manage_url || MANAGE_URL, target: '_blank', rel: 'noopener', text: 'Gérer ou résilier ↗', onclick: () => track('manage_sub', { plan: p.plan }) }));
  acts.push(el('a', { class: 'cta', href: '#pf-plans-card', text: plan ? (level < 3 ? 'Passer au-dessus' : 'Voir les formules') : 'Choisir une formule' }));
  $('#pf-sub-acts').replaceChildren(...acts);
  $('#pf-help').open = !plan && new URLSearchParams(location.search).has('paid'); // back from Whop without a plan: show the fix right away

  $('#pf-plans-title').textContent = plan ? 'Changer de formule' : 'Choisis ta formule';
  $('#pf-plans').replaceChildren(...PLANS.map((x) => {
    const current = x.id === p.plan, save = savingPct(x);
    return el('article', { class: 'pf-planc' + (current ? ' current' : '') + (x.popular ? ' popular' : '') },
      x.popular ? el('span', { class: 'pf-tag', text: 'Le plus choisi' }) : null,
      el('h3', { text: x.name }), el('p', { class: 'pf-price' }, priceLabel(x), el('small', { text: ' ' + x.cycle })),
      el('p', { class: 'pl-hint', text: x.months > 1 ? `soit ${perMonthLabel(x)} / mois${save ? ` · −${save} %` : ''}` : x.pitch }),
      current ? el('span', { class: 'ghost pf-cur', text: 'Ta formule actuelle' })
        : el('a', { class: x.level > level ? 'cta' : 'ghost', href: x.checkoutUrl, text: x.level > level ? `Passer à ${x.name}` : `Choisir ${x.name}`, onclick: () => track('checkout_click', { plan: x.id, from: 'profil' }) }));
  }));
}

// ───────────────────────── prospects ─────────────────────────
function renderStats() {
  const rows = Object.values(store.getPipeline()), built = Object.keys(store.getBuilt()).length, price = store.getMyPlan()?.price || 400;
  const n = (st) => rows.filter((r) => r.status === st).length, reached = rows.filter((r) => r.status !== 'todo').length;
  const stat = (v, l) => el('div', { class: 'pl-stat' }, el('b', { text: v }), el('span', { text: l }));
  $('#pf-stats').replaceChildren(stat(fr(reached), 'contactés'), stat(fr(n('meeting')), 'RDV'), stat(fr(n('won')), 'signés'), stat(fr(n('won') * price) + ' €', 'encaissés'), stat(fr(built), 'maquettes'));
}

function renderProspects() {
  const pipe = store.getPipeline();
  const rows = Object.entries(pipe).map(([id, p]) => ({ id, ...p })).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const counts = {}; for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  const chip = (key, label, count) => el('button', { class: 'chip', type: 'button', 'aria-pressed': String(ui.filter === key), onclick: () => { ui.filter = key; renderProspects(); } }, label, el('small', { text: String(count) }));
  $('#pf-filters').replaceChildren(chip('all', 'Tous', rows.length), ...store.STATUSES.filter((s) => counts[s.key]).map((s) => chip(s.key, s.label, counts[s.key])));
  const q = ui.q.toLowerCase();
  const shown = rows.filter((r) => (ui.filter === 'all' || r.status === ui.filter) && (!q || `${r.name} ${r.city}`.toLowerCase().includes(q)));
  if (!rows.length) { $('#pf-prospects').replaceChildren(el('li', { class: 'empty' }, 'Aucun prospect pour l’instant. Ouvre un commerce sur la carte et marque-le « Contacté ». ', el('a', { href: '/', text: 'Ouvrir la carte' }))); return; }
  $('#pf-prospects').replaceChildren(...(shown.length ? shown.map((r) => {
    const sel = el('select', { class: 'st-select st-' + r.status, 'aria-label': `Statut de ${r.name}` }, ...store.STATUSES.map((s) => { const o = el('option', { value: s.key, text: s.label }); if (s.key === r.status) o.selected = true; return o; }));
    sel.addEventListener('change', () => {
      const lead = { id: r.id, name: r.name };
      store.setStatus(lead, r.city, sel.value); supa.pushStatus(lead, r.city, null, sel.value);
      toast(sel.value === 'won' ? `Bravo pour ${r.name} !` : 'Statut mis à jour.'); renderProspects(); renderStats();
    });
    return el('li', {}, el('div', { class: 'pf-li-tx' }, el('b', { text: r.name || 'Commerce' }), el('small', { text: [r.city, r.ts ? new Date(r.ts).toLocaleDateString('fr-FR') : ''].filter(Boolean).join(' · ') })), sel);
  }) : [el('li', { class: 'empty', text: 'Aucun résultat.' })]));
}

// ───────────────────────── sites ─────────────────────────
function renderSites() {
  const built = store.getBuilt();
  const pub = new Map(ui.sites.map((s) => [`${s.name}|${s.city}`, s]));
  const items = Object.entries(built).sort((a, b) => b[1].ts - a[1].ts).map(([id, b]) => ({ id, ...b, live: pub.get(`${b.name}|${b.city}`) }));
  for (const s of ui.sites) if (!items.some((i) => i.live === s)) items.push({ id: null, name: s.name, city: s.city, ts: Date.parse(s.created_at), live: s });
  const online = items.filter((i) => i.live).length;
  $('#pf-sites-n').textContent = `${items.length} maquette${items.length > 1 ? 's' : ''} · ${online} en ligne`;
  $('#pf-sites').replaceChildren(...(items.length ? items.map((it) => el('li', {},
    el('div', { class: 'pf-li-tx' }, el('b', { text: it.name }), el('small', { text: [it.city, it.ts ? new Date(it.ts).toLocaleDateString('fr-FR') : ''].filter(Boolean).join(' · ') })),
    el('div', { class: 'pf-acts' },
      el('span', { class: 'pf-state' + (it.live ? ' on' : ''), text: it.live ? 'En ligne' : 'Maquette' }),
      it.live ? el('a', { class: 'ghost small', href: `/site/${encodeURIComponent(it.live.slug)}`, target: '_blank', rel: 'noopener', text: 'Voir ↗' }) : null,
      it.insee ? el('a', { class: 'ghost small', href: `/?v=${encodeURIComponent(it.insee)}`, text: 'Ouvrir' }) : null)))
    : [el('li', { class: 'empty', text: 'Aucun site généré pour l’instant.' })]));
}

// ───────────────────────── events ─────────────────────────
$('#pf-q').addEventListener('input', (e) => { ui.q = e.target.value.trim(); renderProspects(); });
$('#pf-out').addEventListener('click', async () => { await supa.signOut(); location.href = '/'; });
$('#pf-pass').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, { error } = await supa.changePassword(f.password.value);
  f.password.value = ''; toast(error || 'Mot de passe changé.');
});
$('#pf-claim').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, b = e.target.querySelector('button'); b.disabled = true;
  const { plan, error } = await supa.claimPurchase(f.email.value.trim());
  b.disabled = false;
  if (error) return toast(error);
  if (!plan) return toast('Aucun paiement en attente avec cet e-mail. Vérifie l’adresse, ou écris-nous.');
  track('claim_purchase', { plan });
  toast(`Formule ${planById(plan)?.name || plan} activée. Bienvenue !`);
  ui.profile = await supa.myProfile() || ui.profile; renderSub();
});
$('#pf-forgot').addEventListener('click', async (e) => {
  const f = $('#pf-login-form').elements, mail = f.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { toast('Écris d’abord ton e-mail dans le champ au-dessus.'); return f.email.focus(); }
  const b = e.currentTarget; b.disabled = true; // currentTarget is gone after the await
  const { error } = await supa.resetPassword(mail);
  b.disabled = false;
  toast(error || 'Si un compte existe avec cet e-mail, un lien vient de partir. Regarde aussi tes spams.');
});
$('#pf-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, b = e.target.querySelector('button'); b.disabled = true;
  const { error } = await supa.signIn(f.email.value.trim(), f.password.value);
  b.disabled = false; f.password.value = '';
  if (error) toast(error);
});

// ───────────────────────── boot ─────────────────────────
async function show(user) {
  $('#pf-loading').hidden = true;
  $('#pf-login').hidden = !!user; $('#pf-app').hidden = !user;
  if (!user) return;
  if (!demo) ui.profile = await supa.myProfile() || { email: user.email, plan: 'free' };
  $('#pf-email').textContent = ui.profile.email || '';
  $('#pf-avatar').textContent = (ui.profile.email || '?')[0].toUpperCase();
  $('#pf-since').textContent = ui.profile.created_at ? `Membre depuis le ${date(ui.profile.created_at)}` : '';
  renderSub(); renderStats(); renderProspects(); renderSites();
  if (new URLSearchParams(location.search).has('reset')) { // came from the "mot de passe oublié" link
    history.replaceState(null, '', location.pathname);
    const field = $('#pf-pass').elements.password; field.scrollIntoView({ block: 'center' }); field.focus({ preventScroll: true });
    toast('Choisis ton nouveau mot de passe ci-dessous.');
  }
  const [remote, sites] = await Promise.all([supa.pullPipeline(), supa.mySites()]);
  store.mergePipeline(remote); ui.sites = sites || [];
  renderStats(); renderProspects(); renderSites();
}

const demo = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('demo'); // local preview only
if (demo) { ui.profile = { email: 'test@exemple.fr', plan: demo, plan_until: new Date(Date.now() + 40 * 864e5).toISOString(), created_at: new Date().toISOString() }; show({ email: 'test@exemple.fr' }); }
else if (!supa.enabled) { $('#pf-loading').textContent = 'Les comptes ne sont pas activés.'; }
else supa.onAuth(({ user }) => show(user));
