// "Mon plan": the goal of the month, today's contacts, the next step, a tip, the roadmap and the journal de bord.
// Everything is computed from what the app already keeps (quiz answers, pipeline, mock-ups built) plus what the user
// writes here. Synced to the account through js/coach.mjs when signed in.
import * as store from './store.mjs';
import * as supa from './supa.mjs';
import { syncCoach, pushSoon } from './coach.mjs';
import { TIPS } from './tips.mjs';

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
const eur = (n) => fr(n) + ' €';
const track = (name, data) => { try { window.va?.('event', { name, data }); } catch { /* analytics off */ } };
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3000); }

const MOOD = { hard: 'Dure', ok: 'Correcte', top: 'Au top' };
const STATUS_LOG = { contacted: 'Contacté :', meeting: 'RDV obtenu avec', won: 'Site vendu à', lost: 'Refus de' };

// ───────────────────────── derived numbers ─────────────────────────
function numbers() {
  const mp = store.getMyPlan();
  const pipe = Object.values(store.getPipeline());
  const built = Object.values(store.getBuilt());
  const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const count = (st) => pipe.filter((x) => x.status === st).length;
  const reached = pipe.filter((x) => ['contacted', 'meeting', 'won', 'lost'].includes(x.status)).length;
  const wonMonth = pipe.filter((x) => x.status === 'won' && x.ts >= monthStart).length;
  const price = mp.price || 400;
  const log = store.getDayLog();
  const contactsLogged = Object.values(log).reduce((s, n) => s + n, 0);
  return {
    mp, price, built: built.length, reached: Math.max(reached, contactsLogged), meeting: count('meeting'), won: count('won'), wonMonth,
    earned: wonMonth * price, goal: mp.goal || 1000, perDay: Math.max(1, mp.perDay || 3), log,
    rate: reached ? Math.round((count('won') / reached) * 100) : 0,
  };
}

function streak(log, perDay) {
  // consecutive days with at least one contact, today included if already started, else counted up to yesterday
  let n = 0; const d = new Date();
  if (!log[store.dayKey(d)]) d.setDate(d.getDate() - 1);
  while (log[store.dayKey(d)] > 0) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ───────────────────────── render ─────────────────────────
function render() {
  const mp = store.getMyPlan();
  $('#pl-empty').hidden = !!mp; $('#pl-app').hidden = !mp;
  if (!mp) return;
  const k = numbers();
  if (mp.insee) $('#open-map').href = `/?v=${encodeURIComponent(mp.insee)}`;

  // 1. goal
  $('#pl-month').textContent = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  countUp($('#pl-earned'), k.earned);
  $('#pl-goal').textContent = eur(k.goal);
  const pct = Math.min(100, Math.round((k.earned / k.goal) * 100));
  $('#pl-pct').textContent = pct + ' %';
  $('#pl-bar').style.width = Math.max(2, pct) + '%';
  const C = 2 * Math.PI * 52; const ring = $('#pl-ring'); ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C * (1 - pct / 100);
  const sitesLeft = Math.max(0, Math.ceil((k.goal - k.earned) / k.price));
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  $('#pl-hero-sub').textContent = sitesLeft
    ? `Encore ${sitesLeft} site${sitesLeft > 1 ? 's' : ''} à ${eur(k.price)} pour atteindre ton objectif${daysLeft ? `, il reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} ce mois-ci` : ''}. ${mp.city ? 'Ta ville : ' + mp.city + '.' : ''}`
    : 'Objectif du mois atteint. Remonte la barre dans tes réglages.';

  // 2. today
  const today = k.log[store.dayKey()] || 0;
  $('#pl-today-n').textContent = today; $('#pl-today-t').textContent = k.perDay;
  $('#pl-dots').replaceChildren(...Array.from({ length: Math.max(k.perDay, today) }, (_, i) => el('i', { class: i < today ? 'on' : '' })));
  const s = streak(k.log, k.perDay);
  $('#pl-streak').textContent = s ? `${s} jour${s > 1 ? 's' : ''} d'affilée` : 'Lance ta série';
  $('#pl-streak').classList.toggle('hot', s >= 3);
  const week = []; const d = new Date(); d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) { const key = store.dayKey(d); week.push([key, k.log[key] || 0, d.toLocaleDateString('fr-FR', { weekday: 'narrow' })]); d.setDate(d.getDate() + 1); }
  const max = Math.max(k.perDay, ...week.map((w) => w[1]));
  $('#pl-week').replaceChildren(...week.map(([key, n, lab], i) => el('div', { class: 'pl-wd' + (i === 6 ? ' today' : '') + (n >= k.perDay ? ' ok' : ''), title: `${key} : ${n}` },
    el('span', { class: 'pl-wbar' }, el('i', { style: `height:${Math.max(4, (n / max) * 100)}%` })), el('small', { text: lab }))));

  // 3. next step
  const road = roadmap(k);
  const next = road.find((r) => !r.done) || { title: 'Tout est coché', tip: 'Tu as bouclé ta feuille de route. Monte ton objectif ou attaque la ville voisine.', cta: ['Monter mon objectif', '#pl-settings'] };
  $('#pl-next-t').textContent = next.title; $('#pl-next-p').textContent = next.tip;
  const a = $('#pl-next-a'); a.textContent = next.cta[0]; a.href = next.cta[1];

  // 4. stats
  const stat = (n, label) => el('div', { class: 'pl-stat' }, el('b', { text: n }), el('span', { text: label }));
  $('#pl-stats').replaceChildren(stat(fr(k.built), 'maquettes'), stat(fr(k.reached), 'contactés'), stat(fr(k.meeting), 'RDV en cours'), stat(fr(k.won), 'sites vendus'), stat(k.rate + ' %', 'taux de oui'));

  // 5. roadmap
  $('#pl-road-n').textContent = `${road.filter((r) => r.done).length} / ${road.length}`;
  $('#pl-road').replaceChildren(...road.map((r, i) => {
    const li = el('li', { class: (r.done ? 'done' : '') + (r === next ? ' current' : '') },
      el('span', { class: 'pl-check', 'aria-hidden': 'true', text: r.done ? '✓' : String(i + 1) }),
      el('div', {}, el('b', { text: r.title }), el('p', { text: r.tip })));
    if (r.manual) {
      const b = el('button', { class: 'ghost small', type: 'button', text: r.done ? 'Décocher' : 'C’est fait' });
      b.addEventListener('click', () => { const m = store.getRoadmap(); if (m[r.key]) delete m[r.key]; else m[r.key] = Date.now(); store.setRoadmap(m); pushSoon(); if (!r.done) celebrate(); render(); });
      li.append(b);
    }
    return li;
  }));

  // 6. journal
  renderJournal();

  // 7. settings
  const f = $('#pl-settings').elements;
  if (document.activeElement?.form !== $('#pl-settings')) { f.goal.value = k.goal; f.price.value = k.price; f.perDay.value = k.perDay; }
}

function roadmap(k) {
  const m = store.getRoadmap(), mp = k.mp, cityMap = mp.insee ? `/?v=${encodeURIComponent(mp.insee)}` : '/';
  return [
    { key: 'goal', done: true, title: `Fixer mon objectif : ${eur(k.goal)} par mois`, tip: 'Fait. Un objectif chiffré, c’est ce qui sépare un projet d’une envie.', cta: ['', '/'] },
    { key: 'scan', done: !!mp.city, title: `Scanner ma ville${mp.city ? ' : ' + mp.city : ''}`, tip: 'La carte te montre chaque commerce sans site. Commence par ton quartier : tu connais les rues.', cta: ['Scanner ma ville', '/?start=1'] },
    { key: 'demo', done: k.built > 0, title: 'Générer ma première maquette', tip: 'Choisis un commerce que tu croises souvent. Ouvre sa fiche, touche « Voir son site ». C’est prêt.', cta: ['Ouvrir la carte', cityMap] },
    { key: 'five', done: k.reached >= 5, title: 'Contacter mes 5 premiers commerces', tip: 'Les 5 premiers sont les plus durs. Passe en boutique entre 14 h et 16 h, quand c’est calme.', cta: ['Choisir mes 5 commerces', cityMap] },
    { key: 'meet', done: k.meeting + k.won > 0, title: 'Décrocher un premier rendez-vous', tip: 'Un « je vais réfléchir » se transforme en RDV : « Je repasse jeudi avec la version finale, 10 minutes ? »', cta: ['Voir mes prospects', cityMap] },
    { key: 'won', done: k.won > 0, title: 'Vendre mon premier site', tip: 'Demande 30 % d’acompte à la signature, avec le devis intégré. Un client qui a payé ne disparaît pas.', cta: ['Ouvrir la carte', cityMap] },
    { key: 'invoice', manual: true, done: !!m.invoice, title: 'Envoyer ma première facture', tip: 'Il te faut un statut (micro-entrepreneur, gratuit en ligne). La facture se fait depuis l’outil « Devis / facture » de la carte.', cta: ['Faire ma facture', cityMap] },
    { key: 'review', manual: true, done: !!m.review, title: 'Demander un avis et une recommandation', tip: 'Ton premier client connaît les commerçants du coin. « Vous connaissez quelqu’un à qui ça servirait ? » vaut 10 prospections.', cta: ['C’est noté', '#pl-road'] },
    { key: 'month', done: k.earned >= k.goal, title: `Atteindre ${eur(k.goal)} dans le mois`, tip: `À ${eur(k.price)} le site, il en faut ${Math.ceil(k.goal / k.price)}. Tiens ton rythme de ${k.perDay} commerces par jour.`, cta: ['Ouvrir la carte', cityMap] },
  ];
}

// ───────────────────────── journal ─────────────────────────
function journalItems() {
  const notes = store.getJournal().filter((e) => !e.deleted).map((e) => ({ ...e, kind: 'note' }));
  const auto = [
    ...Object.values(store.getBuilt()).map((b) => ({ ts: b.ts, kind: 'built', text: `Maquette générée pour ${b.name}` })),
    ...Object.values(store.getPipeline()).filter((p) => STATUS_LOG[p.status]).map((p) => ({ ts: p.ts, kind: p.status, text: `${STATUS_LOG[p.status]} ${p.name}` })),
  ].filter((x) => x.ts);
  return [...notes, ...auto].sort((a, b) => b.ts - a.ts);
}
let journalLimit = 30;
function renderJournal() {
  const items = journalItems(), notes = items.filter((i) => i.kind === 'note').length;
  $('#pl-j-n').textContent = `${notes} note${notes > 1 ? 's' : ''}`;
  const box = $('#pl-journal');
  if (!items.length) { box.replaceChildren(el('p', { class: 'pl-hint', text: 'Rien pour l’instant. Écris ta première note ce soir : ce que tu as fait, ce qui a marché, ce que tu changes demain.' })); return; }
  const groups = new Map();
  for (const it of items.slice(0, journalLimit)) { const d = store.dayKey(it.ts); if (!groups.has(d)) groups.set(d, []); groups.get(d).push(it); }
  const todayK = store.dayKey(), y = new Date(); y.setDate(y.getDate() - 1);
  const label = (d) => d === todayK ? 'Aujourd’hui' : d === store.dayKey(y) ? 'Hier' : new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const nodes = [];
  for (const [d, list] of groups) {
    nodes.push(el('h4', { text: label(d) }));
    nodes.push(el('ul', {}, ...list.map((it) => {
      const time = new Date(it.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (it.kind !== 'note') return el('li', { class: 'auto k-' + it.kind }, el('i'), el('span', { text: it.text }), el('time', { text: time }));
      const del = el('button', { class: 'pl-del', type: 'button', 'aria-label': 'Supprimer la note', text: '×' });
      del.addEventListener('click', () => { if (!confirm('Supprimer cette note ?')) return; store.setJournal(store.getJournal().map((e) => e.id === it.id ? { id: e.id, deleted: true, ts: e.ts } : e)); pushSoon(); render(); });
      return el('li', { class: 'note' }, el('span', { class: 'pl-mood m-' + (it.mood || 'ok'), text: MOOD[it.mood] || 'Note' }), el('p', { text: it.text }), el('time', { text: time }), del);
    })));
  }
  if (items.length > journalLimit) { const more = el('button', { class: 'ghost small', type: 'button', text: 'Voir plus' }); more.addEventListener('click', () => { journalLimit += 30; renderJournal(); }); nodes.push(more); }
  box.replaceChildren(...nodes);
}

$('#pl-jform').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.elements, text = f.text.value.trim();
  if (!text) return f.text.focus();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  store.setJournal([...store.getJournal(), { id, ts: Date.now(), mood: f.mood.value, text: text.slice(0, 600) }]);
  f.text.value = ''; pushSoon(); track('journal_note', { mood: f.mood.value });
  toast('Ajouté au journal. Bien joué.'); render();
});

// ───────────────────────── counter, tips, settings ─────────────────────────
$('#pl-plus').addEventListener('click', () => {
  const n = store.bumpDay(1), per = numbers().perDay; pushSoon(); render();
  if (n === per) { celebrate(); toast(`Objectif du jour atteint : ${per} commerces. Respect.`); }
});
$('#pl-minus').addEventListener('click', () => { store.bumpDay(-1); pushSoon(); render(); });

let tipI = Math.floor(Date.now() / 864e5) % TIPS.length; // one tip per day, same for everyone
function showTip() { const [cat, text] = TIPS[tipI]; $('#pl-tip-cat').textContent = cat; const p = $('#pl-tip'); p.textContent = text; p.classList.remove('in'); void p.offsetWidth; p.classList.add('in'); }
$('#pl-tip-more').addEventListener('click', () => { tipI = (tipI + 1) % TIPS.length; showTip(); });

$('#pl-settings').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.elements, mp = store.getMyPlan();
  const clamp = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  store.setMyPlan({ ...mp, goal: clamp(f.goal.value, 100, 50000, mp.goal), price: clamp(f.price.value, 50, 10000, mp.price || 400), perDay: clamp(f.perDay.value, 1, 60, mp.perDay || 3) });
  pushSoon(); document.activeElement?.blur(); render(); toast('Réglages enregistrés.');
});

// ───────────────────────── small motion ─────────────────────────
function countUp(node, target) {
  const from = Number(node.dataset.v || 0);
  if (from === target || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = eur(target); node.dataset.v = target; return; }
  const t0 = performance.now(), dur = 900;
  const tick = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = eur(from + (target - from) * e); if (k < 1) requestAnimationFrame(tick); else node.dataset.v = target; };
  requestAnimationFrame(tick);
}
function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = el('div', { class: 'pl-confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 26; i++) box.append(el('i', { style: `left:${Math.random() * 100}%;animation-delay:${Math.random() * .4}s;background:${['#1d5bff', '#6aa5ff', '#0c9a6a', '#ffc53d'][i % 4]}` }));
  document.body.append(box); setTimeout(() => box.remove(), 2200);
}

// ───────────────────────── boot ─────────────────────────
render(); showTip();
if (supa.enabled) {
  supa.onAuth(async ({ user }) => {
    if (!user) { $('#pl-sync').textContent = 'Ton plan est enregistré sur cet appareil. Connecte-toi sur la carte pour le retrouver partout.'; return; }
    store.mergePipeline(await supa.pullPipeline());
    const ok = await syncCoach();
    $('#pl-sync').textContent = ok ? `Synchronisé avec ton compte (${user.email}).` : 'Enregistré sur cet appareil.';
    render();
  });
}
addEventListener('storage', (e) => { if (e.key?.startsWith('scantaville.')) render(); }); // the map open in another tab
