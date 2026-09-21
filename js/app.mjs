import { TRADES, verifyLead, reverseAddress } from './core/leads.mjs';
import { encodePayload, leadToPayload } from './core/payload.mjs';
import { FogLayer } from './fog.mjs';
import { loadIndex, searchCities, loadCity, communeContour, cityByInsee, rankOf, COUNTRIES, countryOf } from './city.mjs';
import { drawCard, cardBlob } from './card.mjs';
import * as sound from './sound.mjs';
import * as store from './store.mjs';
import { BRAND, applyBrand } from './brand.mjs';
import { initDocs, openDocs } from './docs-ui.mjs';
import * as supa from './supa.mjs';
import { shopPhoto, paintPhoto } from './photos.mjs';
import { PLANS, FREE, FEATURES, SCRIPT_LEVEL, limitFor, priceLabel, perMonthLabel, savingPct, planById, planForFeature, planForLevel } from './plans.mjs';

applyBrand();

/** Vercel Analytics custom event (no-op on localhost and if blocked). Never send names, e-mails or anything personal. */
const track = (name, data) => { try { window.va?.('event', { name, data }); } catch { /* analytics must never break the app */ } };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fr = (n) => Number(n).toLocaleString('fr-FR');
const isDesktop = () => matchMedia('(min-width: 900px)').matches;
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
};

const FRANCE = { center: [2.45, 46.6], zoom: () => (isDesktop() ? 5.2 : 4.35) };
const TIER_LABEL = { gold: 'Aucun site détecté', social: 'Insta / Facebook seulement', pending: 'À vérifier', silver: 'À vérifier : un domaine existe' };
const CHANNELS = [
  { key: 'walkin', label: 'En boutique', free: true },
  { key: 'dm', label: 'DM Insta' },
  { key: 'email', label: 'E-mail' },
  { key: 'call', label: 'Appel' },
  { key: 'objections', label: 'Objections' },
];

const state = {
  index: { cities: [] }, city: null, data: null, rank: null,
  trade: 'all', tiers: { gold: true, social: true }, lead: null, channel: 'walkin',
  rec: true, listLimit: 200, content: null, demoUrl: '',
};

// ───────────────────────── Map + fog ─────────────────────────
const map = new maplibregl.Map({
  container: 'map', style: 'https://tiles.openfreemap.org/styles/positron',
  center: FRANCE.center, zoom: FRANCE.zoom(), attributionControl: false,
  dragRotate: false, pitchWithRotate: false, touchPitch: false, maxZoom: 18, minZoom: 3.5, fadeDuration: 0,
});
map.touchZoomRotate.disableRotation();
map.keyboard.disableRotation();
const mapReady = new Promise((res) => map.once('load', res));
const fog = new FogLayer(map, $('#fog'), $('#pins'));
if (location.hostname === 'localhost') window.__stv = { map, fog, state: () => state };

/** Pulls the light basemap into the brand palette: pale blue land, soft blue water, white roads, navy labels. */
function tintMap() {
  const paint = (id, prop, value) => { try { map.setPaintProperty(id, prop, value); } catch { /* layer has no such property */ } };
  for (const layer of map.getStyle().layers) {
    const id = layer.id, n = id.toLowerCase();
    if (layer.type === 'background') paint(id, 'background-color', '#f3f7ff');
    else if (layer.type === 'fill') {
      if (/water|ocean|sea|lake|river/.test(n)) paint(id, 'fill-color', '#cfe0ff');
      else if (/building/.test(n)) { paint(id, 'fill-color', '#e2eaf8'); paint(id, 'fill-outline-color', '#d5dff2'); }
      else if (/park|green|wood|forest|grass|landcover|landuse|wetland/.test(n)) paint(id, 'fill-color', '#e8f0fd');
    } else if (layer.type === 'line') {
      if (/water|river|stream/.test(n)) paint(id, 'line-color', '#cfe0ff');
      else if (/rail/.test(n)) paint(id, 'line-color', '#d3dcef');
      else if (/casing/.test(n)) paint(id, 'line-color', '#d9e2f3');
      else if (/road|highway|street|transport|bridge|tunnel|motorway|trunk|path/.test(n)) paint(id, 'line-color', '#ffffff');
      else if (/boundary|admin/.test(n)) paint(id, 'line-color', '#c3d0ea');
    } else if (layer.type === 'symbol') {
      paint(id, 'text-color', /water/.test(n) ? '#6f95e6' : '#5a6b8f');
      paint(id, 'text-halo-color', 'rgba(255,255,255,.9)');
    }
  }
}

mapReady.then(() => {
  tintMap();
  map.addSource('contour', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'contour-glow', type: 'line', source: 'contour', paint: { 'line-color': '#1d5bff', 'line-width': 7, 'line-opacity': .1, 'line-blur': 6 } });
  map.addLayer({ id: 'contour', type: 'line', source: 'contour', paint: { 'line-color': '#1d5bff', 'line-width': 1.4, 'line-opacity': .6, 'line-dasharray': [2, 2] } });
});

map.on('click', (e) => {
  if (document.body.dataset.state !== 'scan') return;
  const lead = fog.pick(e.point, matchMedia('(pointer: coarse)').matches ? 26 : 18);
  if (lead) openLead(lead);
});
map.on('mousemove', (e) => {
  if (document.body.dataset.state !== 'scan') return;
  map.getCanvas().style.cursor = fog.pick(e.point) ? 'pointer' : '';
});

// ───────────────────────── Landing ─────────────────────────
loadIndex().then((index) => {
  state.index = index;
  const cities = index.cities || [];
  if (!cities.length) return;
  $('#p-cities').textContent = fr(cities.length);
  $('#p-leads').textContent = fr(cities.reduce((s, c) => s + (c.leads || 0), 0));
  const max = Math.max(...cities.map((c) => c.leads || 1));
  fog.setGlints(cities.filter((c) => c.center).map((c) => ({ center: c.center, weight: (c.leads || 1) / max })));
  const quick = $('#quick');
  for (const c of [...cities].sort((a, b) => b.leads - a.leads).slice(0, 8)) {
    quick.append(el('button', { type: 'button', onclick: () => scan(c) }, c.name, el('small', { text: fr(c.leads) })));
  }
});

// deep link: ?v=37261 (what a "commente ta ville" reply video links to)
loadIndex().then(async (index) => {
  const v = new URLSearchParams(location.search).get('v');
  if (!v) return;
  const c = (index.cities || []).find((x) => x.insee === v || x.slug === v.toLowerCase()) || await cityByInsee(v);
  if (c) scan(c);
});

// search box
const input = $('#city'), suggest = $('#suggest'), countrySel = $('#country');
countrySel.replaceChildren(...COUNTRIES.map((c) => el('option', { value: c.code, text: `${c.flag} ${c.code}`, title: c.name })));
try { countrySel.value = localStorage.getItem('scantaville.country') || 'FR'; } catch { /* private mode */ }
if (!countrySel.value) countrySel.value = 'FR';
countrySel.addEventListener('change', () => { try { localStorage.setItem('scantaville.country', countrySel.value); } catch { /* ignore */ } results = []; renderSuggest(); input.value = ''; input.placeholder = countrySel.value === 'FR' ? 'Tape ta ville…' : `Ta ville en ${countryOf(countrySel.value).name}…`; input.focus(); });
let results = [], active = -1, debounce = 0;

function renderSuggest() {
  suggest.replaceChildren();
  suggest.hidden = !results.length;
  results.forEach((c, i) => {
    const pre = state.index.cities?.some((x) => x.insee === c.insee);
    suggest.append(el('li', { role: 'option', 'aria-selected': String(i === active), onmousedown: (e) => { e.preventDefault(); choose(c); } },
      el('b', { text: c.name }), el('small', {}, c.population ? `${c.dept} · ${fr(c.population)} hab.` : c.dept, pre ? el('span', { class: 'pre', text: ' · pré-scannée' }) : null)));
  });
}
function choose(c) { input.value = c.name; results = []; renderSuggest(); scan(c); }

input.addEventListener('input', () => {
  clearTimeout(debounce);
  const q = input.value.trim();
  if (q.length < 2) { results = []; renderSuggest(); return; }
  debounce = setTimeout(async () => { results = await searchCities(q, countrySel.value); active = results.length ? 0 : -1; renderSuggest(); }, 160);
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitSearch(); return; } // do not rely on implicit form submission
  if (!results.length) return;
  if (e.key === 'ArrowDown') { active = (active + 1) % results.length; renderSuggest(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { active = (active - 1 + results.length) % results.length; renderSuggest(); e.preventDefault(); }
  else if (e.key === 'Escape') { results = []; renderSuggest(); }
});
input.addEventListener('blur', () => setTimeout(() => { suggest.hidden = true; }, 120));
input.addEventListener('focus', () => { if (results.length) suggest.hidden = false; });

async function submitSearch() {
  clearTimeout(debounce);
  if (results[active]) return choose(results[active]);
  const q = input.value.trim();
  if (q.length < 2) return input.focus();
  const found = await searchCities(q, countrySel.value);
  if (found[0]) choose(found[0]); else toast('Ville introuvable. Essaie avec le nom exact de la commune.');
}
$('#search').addEventListener('submit', (e) => { e.preventDefault(); submitSearch(); });

// ───────────────────────── Scan ─────────────────────────
function fitOptions() {
  return isDesktop()
    ? { padding: { top: 120, bottom: 100, left: Math.round(Math.min(300, innerWidth * .16)), right: 430 } }
    : { padding: { top: Math.round(innerHeight * .36), bottom: 110, left: 28, right: 28 } };
}

async function scan(city) {
  if (document.body.dataset.state === 'scanning') return;
  sound.unlock();
  input.blur(); suggest.hidden = true;
  window.scrollTo({ top: 0 });
  document.body.dataset.state = 'scanning';
  state.city = city; state.trade = 'all'; state.tiers = { gold: true, social: true }; state.listLimit = 200;
  $('#hud-cityname').textContent = city.name;
  $('#hud-num').textContent = '0'; $('#hud-rank').hidden = true;
  $('#hud-gold').textContent = '0'; $('#hud-social').textContent = '0';
  $$('.tier').forEach((b) => b.setAttribute('aria-pressed', 'true'));
  $('#panel').dataset.open = 'false';
  fog.reset();
  showMsg('Lecture de la carte…');

  let data;
  try {
    await mapReady;
    const dataP = loadCity(city, { onStatus: showMsg });
    dataP.catch(() => {}); // handled below; avoids an unhandled rejection while the camera flies
    const center = city.center || (data = await dataP).center;
    await new Promise((res) => { map.once('moveend', res); map.flyTo({ center, zoom: 10.5, duration: 1600, essential: true }); });
    data ??= await dataP;
  } catch (err) {
    hideMsg(); toast(err.message || 'Scan impossible pour le moment.'); backToLanding(); return;
  }

  const hidden = new Set(store.getHidden());
  for (const l of data.leads) l._hidden = hidden.has(l.id);
  state.data = data;
  state.rank = rankOf(state.index, data);
  $('#hud-live').hidden = !data.live;
  history.replaceState(null, '', `?v=${data.insee}`);

  if (!data.leads.some((l) => l.tier !== 'silver')) {
    hideMsg(); toast('OpenStreetMap est trop peu renseigné ici. Essaie la grande ville d\'à côté.'); backToLanding(); return;
  }

  communeContour(data.insee).then((gj) => { if (gj && state.data === data) map.getSource('contour')?.setData(gj); });

  fog.setCity(data.center, data.leads);
  applyFilter();
  const dLat = fog.maxD / 111320, dLon = dLat / Math.cos(data.center[1] * Math.PI / 180);
  const bounds = [[data.center[0] - dLon, data.center[1] - dLat], [data.center[0] + dLon, data.center[1] + dLat]];
  await new Promise((res) => { map.once('moveend', res); map.fitBounds(bounds, { ...fitOptions(), duration: 1100, essential: true }); });
  hideMsg();

  const numEl = $('#hud-num'), countEl = $('.hud-count');
  fog.startReveal({
    duration: 3600,
    onCount: (n) => {
      numEl.textContent = fr(n);
      if (document.body.dataset.state === 'scanning') { sound.tick(); countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump'); }
    },
    onDone: () => setTimeout(landed, 350),
  });
}

function landed() {
  const { rank } = state;
  document.body.dataset.state = 'scan';
  track('scan', { city: state.data.name, shops: state.data.stats.leads });
  sound.landed();
  renderTierCounts();
  if (rank.rank) {
    const r = $('#hud-rank');
    r.textContent = `#${rank.rank} / ${rank.total} villes · ${String(rank.per10k).replace('.', ',')} pour 10 000 hab.`;
    r.hidden = false;
  }
  applyLocks(); renderFilters(); renderList(); renderGoal();
  if (isDesktop()) $('#panel').dataset.open = 'true';
  if (updateGate()) setTimeout(askAccount, 900); // let the number land, then ask
  else if (store.planLevel() === 0) setTimeout(lockedPaywall, 1100); // no plan = nothing to open: show the offer
}

/** The reveal is free to watch; the results need a (free) account. No-op when accounts are off or the user is signed in. */
function askAccount() {
  const { data } = state;
  state.gateTitle = data ? `${fr(data.stats.leads)} commerces sans site à ${data.name}. Crée ton compte pour les voir.` : '';
  if (state.gateTitle) $('#auth-title').textContent = state.gateTitle;
  openOverlay('#auth');
}
function updateGate() {
  const on = supa.enabled && !state.user && document.body.dataset.state === 'scan';
  document.body.dataset.gate = on ? 'on' : 'off';
  $('#gate-btn').hidden = !on;
  return on;
}

function backToLanding() {
  document.body.dataset.state = 'landing'; updateGate();
  fog.reset(); state.data = null; state.lead = null;
  map.getSource('contour')?.setData({ type: 'FeatureCollection', features: [] });
  map.flyTo({ center: FRANCE.center, zoom: FRANCE.zoom(), duration: 1400 });
  history.replaceState(null, '', location.pathname);
  input.value = ''; setTimeout(() => input.focus({ preventScroll: true }), 300);
}
$('#btn-newcity').addEventListener('click', backToLanding);

function showMsg(t) { $('#scanmsg-text').textContent = t; $('#scanmsg').hidden = false; }
function hideMsg() { $('#scanmsg').hidden = true; }

// ───────────────────────── Filters + list ─────────────────────────
const tierOf = (l) => (l.tier === 'pending' ? 'gold' : l.tier);
const visible = (l) => !l._hidden && l.tier !== 'silver' && state.tiers[tierOf(l)] && (state.trade === 'all' || l.trade === state.trade);

function applyFilter() { fog.setFilter(visible); }

/**
 * How many shops of this city the plan lets the user open. The map and the counter always show them all;
 * the unlocked ones are picked round-robin across trades so that every filter keeps something to work on.
 * Prototype: the city JSON is public, so this gate is only as strong as the UI. Production must serve the
 * contact details of locked shops from an authenticated endpoint.
 */
function applyLocks() {
  if (state.data.serverLocks) { state.unlocked = state.data.leads.filter((l) => !l._locked).length; return; } // the database already decided
  const leads = state.data.leads.filter((l) => l.tier !== 'silver'), max = limitFor('leadsPerCity', store.planLevel());
  const open = new Set();
  if (max >= leads.length) leads.forEach((l) => open.add(l.id));
  else {
    const byTrade = new Map();
    for (const l of leads) { if (!byTrade.has(l.trade)) byTrade.set(l.trade, []); byTrade.get(l.trade).push(l); }
    const queues = [...byTrade.values()].sort((a, b) => b.length - a.length);
    for (let i = 0; open.size < max; i++) { let took = false; for (const q of queues) { if (q[i] && open.size < max) { open.add(q[i].id); took = true; } } if (!took) break; }
  }
  for (const l of state.data.leads) l._locked = !open.has(l.id);
  state.unlocked = open.size;
}

function renderTierCounts() {
  const leads = state.data.leads.filter((l) => !l._hidden && l.tier !== 'silver');
  $('#hud-gold').textContent = fr(leads.filter((l) => tierOf(l) === 'gold').length);
  $('#hud-social').textContent = fr(leads.filter((l) => l.tier === 'social').length);
}

$$('.tier').forEach((b) => b.addEventListener('click', () => {
  const t = b.dataset.tier, other = t === 'gold' ? 'social' : 'gold';
  state.tiers[t] = !state.tiers[t];
  if (!state.tiers[t] && !state.tiers[other]) state.tiers[other] = true; // never both off
  $$('.tier').forEach((x) => x.setAttribute('aria-pressed', String(state.tiers[x.dataset.tier])));
  applyFilter(); renderList();
}));

function renderFilters() {
  const counts = {};
  for (const l of state.data.leads) if (!l._hidden && l.tier !== 'silver') counts[l.trade] = (counts[l.trade] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const box = $('#filters'); box.replaceChildren();
  const add = (key, label, n) => box.append(el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(state.trade === key),
    onclick: () => { state.trade = key; state.listLimit = 200; renderFilters(); applyFilter(); renderList(); },
  }, label, el('small', { text: fr(n) })));
  add('all', 'Tous', total);
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => add(k, TRADES[k]?.label || k, n));
}

function renderList() {
  const all = state.data.leads.filter(visible), pipeline = store.getPipeline();
  const rows = [...all.filter((l) => !l._locked), ...all.filter((l) => l._locked)], openCount = all.filter((l) => !l._locked).length;
  const list = $('#list');
  list.replaceChildren();
  $('#panel-sub').textContent = openCount < rows.length ? `${fr(openCount)} débloqué${openCount > 1 ? 's' : ''} sur ${fr(rows.length)}` : `${fr(rows.length)} commerce${rows.length > 1 ? 's' : ''}`;
  { const pl = TRADES[state.trade]?.plural; $('#panel-title').textContent = state.trade === 'all' || !pl ? 'Tes prospects' : pl[0].toUpperCase() + pl.slice(1); }
  if (!rows.length) { list.append(el('li', { class: 'empty', text: 'Rien avec ces filtres.' })); return; }
  for (const l of rows.slice(0, state.listLimit)) {
    if (l._locked) { // the name never reaches the DOM for a locked shop
      list.append(el('li', { class: 'locked' + (l.tier === 'social' ? ' social' : ''), onclick: () => lockedPaywall() },
        el('i'), el('div', {}, el('b', { class: 'ghost-name', 'aria-hidden': 'true', text: '████████ ██████' }), el('small', { text: `${TRADES[l.trade]?.label || 'Commerce'} · à débloquer` })),
        el('span', { class: 'more', text: '🔒' })));
      continue;
    }
    const st = pipeline[l.id]?.status, stLabel = st && store.STATUSES.find((s) => s.key === st)?.label;
    list.append(el('li', { class: (l.tier === 'social' ? 'social' : '') + (state.lead?.id === l.id ? ' sel' : ''), 'data-id': l.id, onclick: () => openLead(l, true) },
      el('i'),
      el('div', {}, el('b', { text: l.name }), el('small', { text: [TRADES[l.trade]?.label, l.addr?.split(',')[0]].filter(Boolean).join(' · ') })),
      stLabel ? el('span', { class: 'st', text: stLabel }) : el('span', { class: 'more', text: '›' })));
  }
  if (rows.length > state.listLimit) {
    list.append(el('li', { class: 'empty more-rows', text: `Voir les ${fr(rows.length - state.listLimit)} suivants`, onclick: () => { state.listLimit += 300; renderList(); } }));
  }
}

$('#panel-handle').addEventListener('click', () => {
  if (isDesktop()) return;
  const p = $('#panel'), open = p.dataset.open !== 'true';
  p.dataset.open = String(open); $('#panel-handle').setAttribute('aria-expanded', String(open));
});

// ───────────────────────── Goal widget ─────────────────────────
function renderGoal() {
  const n = store.getGoal(), range = $('#goal-range');
  range.value = n; $('#goal-n').textContent = n;
  const weeks = Math.ceil(50 / n);
  $('#goal-weeks').textContent = weeks <= 1 ? '~1 semaine' : `~${weeks} semaines`;
  const won = store.wonCount(), wonEl = $('#goal-won');
  wonEl.hidden = !won;
  if (won) wonEl.textContent = `Signés : ${won} × ${store.PRICE} € = ${fr(won * store.PRICE)} €. Bien joué.`;
}
$('#goal-range').addEventListener('input', (e) => { store.setGoal(+e.target.value); renderGoal(); });

// ───────────────────────── Lead card ─────────────────────────
const HOURS_FR = [[/\bMo\b/g, 'lun'], [/\bTu\b/g, 'mar'], [/\bWe\b/g, 'mer'], [/\bTh\b/g, 'jeu'], [/\bFr\b/g, 'ven'], [/\bSa\b/g, 'sam'], [/\bSu\b/g, 'dim'], [/\bPH\b/g, 'fériés'], [/\boff\b/g, 'fermé'], [/;\s*/g, ' · ']];
const hoursFr = (h) => HOURS_FR.reduce((s, [re, v]) => s.replace(re, v), h);
const maskPhone = (p) => { const parts = p.split(' '); return parts.length >= 4 ? parts.slice(0, 2).join(' ') + ' •• •• ••' : p.slice(0, 4) + ' ••••'; };

function openOverlay(id) { $(id).hidden = false; }
function closeOverlays() { $$('.overlay').forEach((o) => { o.hidden = true; }); $('#demo-frame').src = 'about:blank'; }
document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) { const o = e.target.closest('.overlay'); o.hidden = true; if (o.id === 'demo') $('#demo-frame').src = 'about:blank'; } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlays(); });

function lockedPaywall() {
  const level = store.planLevel(), total = state.data.leads.filter((l) => l.tier !== 'silver' && !l._hidden).length;
  const max = limitFor('leadsPerCity', level);
  const title = level === 0
    ? `${fr(total)} commerces sans site à ${state.data.name}. Choisis une formule pour voir lesquels.`
    : `Tu as débloqué ${fr(Math.min(max, total))} commerces sur ${fr(total)} à ${state.data.name}.`;
  openPaywall(title, { minLevel: Math.min(3, level + 1) });
}

function openLead(lead, fly = false) {
  if (updateGate()) return askAccount();
  if (lead._locked) return lockedPaywall();
  state.lead = lead; fog.setSelected(lead.id); sound.flip();
  if (!isDesktop()) $('#panel').dataset.open = 'false';
  if (fly) map.easeTo({ center: [lead.lon, lead.lat], zoom: Math.max(map.getZoom(), 14.5), duration: 700, offset: isDesktop() ? [-160, 0] : [0, -120] });
  $$('#list li.sel').forEach((n) => n.classList.remove('sel'));
  $(`#list li[data-id="${lead.id}"]`)?.classList.add('sel');
  renderLead();
  const card = $('.leadcard'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  openOverlay('#lead');
  enrichLead(lead);
  showPhoto(lead);
}

function renderLead() {
  const l = state.lead, city = state.data.name;
  const badge = $('#lead-tier'); badge.className = 'badge ' + l.tier; badge.textContent = TIER_LABEL[l.tier];
  $('#lead-name').textContent = l.name;
  $('#lead-trade').textContent = [TRADES[l.trade]?.label, l.cuisine, city].filter(Boolean).join(' · ');
  $('#row-addr').hidden = !l.addr; $('#lead-addr').textContent = l.addr || '';
  $('#row-hours').hidden = !l.hours; $('#lead-hours').textContent = l.hours ? hoursFr(l.hours) : '';
  $('#row-phone').hidden = !l.phone;
  if (l.phone) { const masked = state.rec && !l._phoneShown; $('#lead-phone').textContent = masked ? maskPhone(l.phone) : l.phone; $('#phone-reveal').hidden = !masked; }
  const soc = $('#lead-social'); soc.replaceChildren();
  for (const [k, label] of [['instagram', 'Instagram'], ['facebook', 'Facebook']]) {
    if (l.social?.[k]) soc.append(el('a', { class: 'link', href: l.social[k], target: '_blank', rel: 'noopener noreferrer', text: label + ' ↗' }), ' ');
  }
  $('#row-social').hidden = !soc.childNodes.length;
  const dom = $('#lead-domain'); dom.replaceChildren();
  if (l._checking) dom.append(el('span', { class: 'muted', text: 'Vérification des noms de domaine…' }));
  else if (l.tier === 'silver') dom.append(el('span', { text: `Un domaine à son nom existe déjà${l._taken?.[0] ? ' (' + l._taken[0] + ')' : ''}.` }), el('small', { text: 'Vérifie qu\'il n\'a pas déjà un site avant de le contacter.' }));
  else if (l.domain) dom.append(el('span', { class: 'free', text: `${l.domain} est libre ✓` }), el('small', { text: 'À réserver au nom du commerçant, jamais au tien.' }));
  $('#row-domain').hidden = !dom.childNodes.length;
  $('#lead-google').href = 'https://www.google.com/search?q=' + encodeURIComponent(`${l.name} ${city}`);
  $('#author').value = store.getAuthor();
  const left = store.demosLeft();
  $('#quota').textContent = left === Infinity ? `Formule ${planById(store.getPlanId())?.name || ''} : maquettes illimitées.` : (store.planLevel() === 0 ? 'Les maquettes commencent à la formule Essentiel.' : `${left} maquette${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''} aujourd'hui.`);
}

/** street-level photo (Panoramax, open licence), fetched when the card opens */
async function showPhoto(l) {
  const fig = $('#lead-photo'); fig.hidden = true;
  const photo = await shopPhoto(l.lat, l.lon);
  if (!photo || state.lead !== l || $('#lead').hidden) return;
  fig.hidden = false;
  paintPhoto($('#lead-photo-img'), photo);
  const credit = $('#lead-photo-credit');
  credit.href = photo.link; credit.textContent = `© ${photo.author} · Panoramax · ${photo.licence}${photo.date ? ' · ' + photo.date : ''}`;
}

/** live mode: domain check + reverse geocoding happen when the card opens */
async function enrichLead(l) {
  const jobs = [];
  if (l.tier === 'pending' && !l._checking) {
    l._checking = true; renderLead();
    jobs.push(verifyLead(l, state.data.name, { tld: countryOf(state.data.country).tld }).then((v) => {
      l._checking = false; l.tier = v.tier === 'pending' ? 'gold' : v.tier; l.domain = v.domain; l._taken = v.taken;
    }));
  }
  if (!l.addr && !l._addrTried) { l._addrTried = true; jobs.push(reverseAddress(l.lat, l.lon).then((a) => { if (a) l.addr = a; })); }
  if (!jobs.length) return;
  await Promise.all(jobs);
  if (state.lead === l) renderLead();
  renderTierCounts();
}

$('#phone-reveal').addEventListener('click', () => { state.lead._phoneShown = true; renderLead(); });
$('#author').addEventListener('change', (e) => store.setAuthor(e.target.value));
$('#fb-hassite').addEventListener('click', () => {
  const l = state.lead; store.hideLead(l.id); l._hidden = true;
  supa.reportHasSite(l.id, state.data.insee);
  closeOverlays(); fog.setSelected(null); applyFilter(); renderTierCounts(); renderFilters(); renderList();
  toast('Merci, retiré de ta carte. En production, ce signalement nettoie la carte de tout le monde.');
});

// ───────────────────────── Demo site ─────────────────────────
const BUILD_STEPS = ['Nom et métier', 'Adresse et plan', 'Horaires d\'ouverture', 'Bouton d\'appel', 'Mise en page'];

function demoUrlFor(l) {
  const url = new URL('demo.html', location.href);
  const payload = leadToPayload(l, state.data.name, store.getAuthor(), l._style || 0);
  if (!store.can('noBadge')) payload.w = 1; // below Pro, the mock-up says which tool made it
  url.hash = encodePayload(payload);
  return url.href;
}

/** resolves when the demo page says it has rendered ('load' alone could be a stale about:blank) */
function demoReady(frame) {
  return new Promise((res) => {
    const onMsg = (e) => { if (e.source === frame.contentWindow && e.data?.type === 'stv-demo-ready') done(); };
    const done = () => { removeEventListener('message', onMsg); clearTimeout(timer); res(); };
    const timer = setTimeout(done, 3500);
    addEventListener('message', onMsg);
  });
}

$('#btn-build').addEventListener('click', async () => {
  const l = state.lead;
  store.setAuthor($('#author').value);
  if (!store.canBuild(l.id)) { $('#lead').hidden = true; return openPaywall(store.planLevel() === 0 ? 'Les maquettes de sites commencent à la formule Essentiel.' : `Tu as utilisé tes ${store.demoLimit()} maquettes du jour.`, { minLevel: Math.min(3, store.planLevel() + 1) }); }
  store.countBuild(l.id);
  track('demo_generated', { trade: l.trade });
  const t0 = performance.now();
  state.demoUrl = demoUrlFor(l);

  $('#lead').hidden = true;
  const frame = $('#demo-frame'), build = $('#build'), steps = $('#build-steps');
  frame.classList.remove('on'); build.classList.remove('off');
  steps.replaceChildren(...BUILD_STEPS.map((s) => el('li', { text: s })));
  $('#demo-name').textContent = l.name; $('#demo-ms').textContent = '…';
  $('.demo-side').dataset.expanded = 'false'; $('#demo-more').textContent = 'Script et suivi'; $('#demo-more').setAttribute('aria-expanded', 'false');
  $('#demo-open').href = state.demoUrl;
  openOverlay('#demo');
  renderStatus(); renderScripts();

  const loaded = demoReady(frame);
  frame.src = state.demoUrl;
  // the flourish is short on purpose: the site really is ready in well under a second
  for (const li of $$('li', steps)) { await new Promise((r) => setTimeout(r, 130)); li.classList.add('ok'); }
  await loaded;
  $('#demo-ms').textContent = ((performance.now() - t0) / 1000).toFixed(1).replace('.', ',') + ' s';
  build.classList.add('off'); frame.classList.add('on'); sound.built();
});

// "Autre style": same shop, another palette / layout. The choice travels in the link (payload key v).
$('#demo-restyle').addEventListener('click', async () => {
  const l = state.lead, frame = $('#demo-frame');
  const next = (l._style || 0) + 1;
  const maxStyles = limitFor('styles', store.planLevel());
  if (next >= maxStyles) { l._style = 0; if (maxStyles < 6) openPaywall(`Ta formule donne ${maxStyles} styles par commerce. Les 6 sont dans la formule Pro.`, { minLevel: 2 }); }
  else l._style = next % 6;
  state.demoUrl = demoUrlFor(l);
  $('#demo-open').href = state.demoUrl;
  frame.classList.remove('on');
  const loaded = demoReady(frame);
  // only the hash changes, and the demo page re-renders on hashchange: no reload, so it is instant
  if (frame.contentWindow && frame.src.split('#')[0] === state.demoUrl.split('#')[0]) frame.contentWindow.location.replace(state.demoUrl);
  else frame.src = state.demoUrl;
  await loaded;
  frame.classList.add('on'); sound.flip();
  renderScripts();
});

$('#demo-more').addEventListener('click', (e) => {
  const side = $('.demo-side'), open = side.dataset.expanded !== 'true';
  side.dataset.expanded = String(open); e.currentTarget.setAttribute('aria-expanded', String(open));
  e.currentTarget.textContent = open ? 'Revoir le site en grand' : 'Script et suivi';
});

$('#demo-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(state.demoUrl); toast('Lien copié. Montre-le au patron, ou envoie-le en DM.'); }
  catch { prompt('Copie ce lien :', state.demoUrl); }
});

function renderStatus() {
  const box = $('#status-chips'), cur = store.getPipeline()[state.lead.id]?.status;
  box.replaceChildren(...store.STATUSES.map((s) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(cur === s.key), text: s.label,
    onclick: () => {
      if (!store.can('fullPipeline') && s.key !== 'todo' && s.key !== 'contacted') return openPaywall('Le suivi complet (RDV, signé) commence à la formule Essentiel.', { feature: 'fullPipeline' });
      store.setStatus(state.lead, state.data.name, cur === s.key ? null : s.key); renderStatus(); renderList(); renderGoal();
      supa.pushStatus(state.lead, state.data.name, state.data.insee, cur === s.key ? null : s.key);
      if (s.key === 'won' && cur !== 'won') { $('.demo-side').dataset.expanded = 'true'; $('.after-yes').classList.add('hot'); toast('Signé, bravo. Il reste le devis, puis le vrai site à construire.'); }
    },
  })));
}

// ───────────────────────── Sales scripts ─────────────────────────
async function loadContent() {
  if (state.content) return state.content;
  try { state.content = await import('./content/pitches.mjs'); }
  catch { state.content = { PITCHES: {}, OBJECTIONS: [], fillTemplate: (s) => s }; }
  return state.content;
}

function flatten(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(flatten).join('\n');
  if (v.subject || v.objet) return `Objet : ${v.subject || v.objet}\n\n${flatten(v.body || v.corps)}`;
  return Object.values(v).map(flatten).join('\n\n');
}

async function renderScripts() {
  const tabs = $('#script-tabs'), body = $('#script-body'), level = store.planLevel();
  const lockedCh = (c) => (SCRIPT_LEVEL[c.key] ?? 2) > level;
  tabs.replaceChildren(...CHANNELS.map((c) => el('button', {
    type: 'button', role: 'tab', 'aria-selected': String(state.channel === c.key),
    onclick: () => { state.channel = c.key; renderScripts(); },
  }, c.label, lockedCh(c) ? el('span', { class: 'lock', text: '🔒' }) : null)));

  const content = await loadContent(), l = state.lead, fam = TRADES[l.trade]?.tpl || 'atelier';
  const ch = CHANNELS.find((c) => c.key === state.channel), locked = lockedCh(ch);
  const vars = {
    commerce: l.name, prenom: store.getAuthor() || 'Prénom', ville: state.data.name, lien: state.demoUrl,
    prix: String(store.PRICE), domaine: l.domain || '', metier: (TRADES[l.trade]?.label || 'commerce').toLowerCase(),
  };
  let text;
  if (ch.key === 'objections') text = (content.OBJECTIONS || []).map((o) => `« ${o.q} »\n→ ${o.a}`).join('\n\n');
  else if (content.getPitch) text = flatten(content.getPitch(l.trade, ch.key, vars)); // shops ('mode', 'commerce') get boutique copy, not garage copy
  else text = content.fillTemplate(flatten(content.PITCHES?.[fam]?.[ch.key]), vars);
  body.textContent = text || 'Script en cours d\'écriture.';
  body.classList.toggle('locked', locked);
  const copy = $('#script-copy');
  copy.textContent = locked ? 'Débloquer ce script' : 'Copier le script';
  copy.onclick = locked
    ? () => openPaywall(SCRIPT_LEVEL[ch.key] === 1 ? 'Le script DM Insta commence à la formule Essentiel.' : 'Les scripts e-mail, appel et objections sont dans la formule Pro.', { minLevel: SCRIPT_LEVEL[ch.key] ?? 2 })
    : async () => { try { await navigator.clipboard.writeText(text); toast('Script copié.'); } catch { toast('Copie impossible sur ce navigateur.'); } };
}

// ───────────────────────── Share card ─────────────────────────
$('#btn-share').addEventListener('click', async () => {
  const { data, rank } = state, canvas = $('#share-canvas');
  const leads = data.leads.filter((l) => !l._hidden && l.tier !== 'silver');
  const stats = { leads: leads.length, gold: leads.filter((l) => tierOf(l) === 'gold').length, social: leads.filter((l) => l.tier === 'social').length };
  openOverlay('#share');
  await drawCard(canvas, { city: data.name, leads, stats, rank });
  const file = async () => new File([await cardBlob(canvas)], `${BRAND.slug}-${data.slug || data.insee}.png`, { type: 'image/png' });
  $('#share-dl').onclick = async () => {
    const a = el('a', { href: URL.createObjectURL(await cardBlob(canvas)), download: `${BRAND.slug}-${data.slug || data.insee}.png` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const native = $('#share-native');
  try {
    const f = await file();
    native.hidden = !(navigator.canShare && navigator.canShare({ files: [f] }));
    native.onclick = () => navigator.share({ files: [f], text: `${data.name} : ${fr(stats.leads)} commerces sans site web référencé. Et dans ta ville ?` }).catch(() => {});
  } catch { native.hidden = true; }
});

// ───────────────────────── Paywall, toggles, toast ─────────────────────────
// ───────────────────────── Plans: pricing cards, paywall, gated tools ─────────────────────────
const perkNode = (p) => el('li', { class: /^Tout /.test(p.text) ? 'inherit' : null }, el('span', {}, p.text, p.soon ? el('span', { class: 'soon', text: 'bientôt' }) : null));

function renderPlans() {
  const box = $('#plans'), current = store.getPlanId();
  box.replaceChildren(...PLANS.map((p) => {
    const save = savingPct(p);
    return el('article', { class: 'plan' + (p.popular ? ' popular' : '') + (p.id === current ? ' current' : '') },
      p.popular ? el('p', { class: 'tag', text: 'Le plus choisi' }) : null,
      el('div', { class: 'plan-top' }, el('h3', { text: p.name }), el('span', { class: 'period', text: p.period })),
      el('p', { class: 'price' }, priceLabel(p), el('small', { text: p.cycle })),
      el('p', { class: 'permonth' }, p.months > 1 ? `soit ${perMonthLabel(p)} / mois ` : '', save ? el('b', { text: `· −${save} %` }) : null),
      el('p', { class: 'pitch', text: p.pitch }),
      el('ul', {}, ...p.perks.map(perkNode)),
      el('button', { class: 'cta', type: 'button', text: p.id === current ? 'Ta formule actuelle' : `Choisir ${p.name}`, onclick: () => openPaywall(null, { planId: p.id }) }));
  }));
  $('#free-perks').textContent = FREE.perks.join(' · ');
}

const pay = { plan: 'm3', minLevel: 1 };

/** title = why we are here · feature / minLevel = what is needed (greys out the plans that would not help) · planId = preselected */
function openPaywall(title, { feature, minLevel, planId } = {}) {
  pay.minLevel = minLevel || (feature ? FEATURES[feature] || 1 : 1);
  const wanted = planById(planId) || (pay.minLevel > 1 ? planForLevel(pay.minLevel) : null) || PLANS.find((p) => p.popular) || PLANS[0];
  pay.plan = wanted.level >= pay.minLevel ? wanted.id : planForLevel(pay.minLevel).id;
  $('#pay-title').textContent = title || 'Choisis ta formule';
  track('paywall_open', { need: pay.minLevel });
  renderPaywall();
  openOverlay('#paywall');
}

function renderPaywall() {
  const chosen = planById(pay.plan);
  $('#pay-plans').replaceChildren(...PLANS.map((p) => {
    const off = p.level < pay.minLevel, save = savingPct(p);
    return el('button', {
      class: 'pay-plan', type: 'button', role: 'radio', 'aria-checked': String(p.id === pay.plan), 'aria-disabled': off ? 'true' : null,
      title: off ? 'Cette formule ne comprend pas la fonction demandée' : null,
      onclick: () => { if (off) return; pay.plan = p.id; renderPaywall(); },
    }, save ? el('span', { class: 'pp-save', text: `−${save} %` }) : null,
      el('b', { text: p.name }), el('span', { class: 'pp-period', text: p.period }),
      el('span', { class: 'pp-price', text: priceLabel(p) }), el('span', { class: 'pp-month', text: p.months > 1 ? `${perMonthLabel(p)} / mois` : p.cycle.split(',')[0] }));
  }));
  $('#pay-perks').replaceChildren(...chosen.perks.map(perkNode));
  $('#pay-go').textContent = chosen.checkoutUrl ? `Continuer · ${chosen.name} ${priceLabel(chosen)}` : `Me prévenir · ${chosen.name} ${priceLabel(chosen)}`;
  $('#waitlist input').hidden = !!chosen.checkoutUrl; $('#waitlist input').required = !chosen.checkoutUrl;
  $('#pay-fine').textContent = chosen.checkoutUrl
    ? 'Paiement sécurisé sur la page de notre prestataire. Remboursé sous 7 jours, sans condition.'
    : 'Prototype : le paiement n\'est pas encore branché. Ton e-mail reste sur cet appareil, et on te prévient à l\'ouverture.';
}

$$('[data-open-paywall]').forEach((b) => b.addEventListener('click', () => openPaywall()));
$('#waitlist').addEventListener('submit', (e) => {
  e.preventDefault();
  const chosen = planById(pay.plan);
  if (chosen.checkoutUrl) { track('checkout_click', { plan: chosen.id }); location.href = chosen.checkoutUrl; return; }
  const email = e.target.querySelector('input').value;
  store.saveWaitlist(email, chosen.id);
  supa.joinWaitlist(email, chosen.id); // no-op until Supabase is configured
  closeOverlays(); toast(`C'est noté pour la formule ${chosen.name}. On te prévient à l'ouverture.`);
});

function refreshLocks() {
  for (const [id, feature, label] of [['#btn-csv', 'csvExport', 'Exporter en CSV'], ['#btn-kit', 'legalKit', 'Kit légal'], ['#btn-docs', 'invoicing', 'Devis / facture']]) {
    const b = $(id); b.replaceChildren(label, store.can(feature) ? '' : el('span', { class: 'lock', text: '🔒' }));
  }
}

// CSV of the prospects currently listed (filters applied). OSM data stays ODbL: the file says so.
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
$('#btn-csv').addEventListener('click', () => {
  if (!store.can('csvExport')) return openPaywall('L\'export CSV de tes prospects est dans la formule Pro.', { feature: 'csvExport' });
  const rows = state.data.leads.filter((l) => visible(l) && !l._locked), city = state.data.name;
  const head = ['Commerce', 'Métier', 'Niveau', 'Adresse', 'Téléphone', 'Horaires', 'E-mail', 'Instagram', 'Facebook', 'Domaine libre suggéré', 'Vérifier sur Google', 'Source'];
  const lines = rows.map((l) => [l.name, TRADES[l.trade]?.label, TIER_LABEL[l.tier], l.addr, l.phone, l.hours, l.email, l.social?.instagram, l.social?.facebook, l.domain,
    'https://www.google.com/search?q=' + encodeURIComponent(`${l.name} ${city}`), '© contributeurs OpenStreetMap (ODbL)'].map(csvCell).join(';'));
  const blob = new Blob(['\ufeff' + [head.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `${BRAND.slug}-${state.data.slug || state.data.insee}-prospects.csv` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(`${fr(rows.length)} prospects exportés. Pense à vérifier chaque commerce avant de le contacter.`);
});

// quotes and invoices: anyone can fill the form and see the sheet, printing it is a Pro feature
initDocs({ openPaywall });
$('#btn-docs').addEventListener('click', () => openDocs('devis', null));
$('#demo-quote').addEventListener('click', () => { $('#demo').hidden = true; $('#demo-frame').src = 'about:blank'; openDocs('devis', state.lead); });

$('#btn-kit').addEventListener('click', async () => {
  if (!store.can('legalKit')) return openPaywall('Le kit légal (statut, devis, facture, mentions) est dans la formule Pro.', { feature: 'legalKit' });
  const list = $('#kit-list');
  if (!list.childNodes.length) {
    try {
      const { STARTER } = await import('./content/starter.mjs');
      list.replaceChildren(...STARTER.map((it) => el('li', {}, el('h3', { text: it.title }), el('p', { text: it.body }),
        it.link ? el('a', { class: 'link', href: it.link, target: '_blank', rel: 'noopener noreferrer', text: (it.linkLabel || 'Source officielle') + ' ↗' }) : null)));
    } catch { list.replaceChildren(el('li', {}, el('p', { text: 'Le kit n\'a pas pu être chargé.' }))); }
  }
  openOverlay('#kit');
});

$('#btn-rec').addEventListener('click', (e) => {
  state.rec = !state.rec; e.currentTarget.setAttribute('aria-pressed', String(state.rec));
  document.body.dataset.rec = state.rec ? 'on' : 'off';
  toast(state.rec ? 'Mode tournage : numéros masqués.' : 'Numéros visibles. Pense à les masquer avant de filmer.');
  if (state.lead && !$('#lead').hidden) renderLead();
});
$('#btn-sound').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(on)); sound.setSound(on); if (on) sound.unlock();
});

let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3600); }

// dev switch for demos: ?pro=1 / ?pro=0
// ───────────────────────── Account (Supabase). Everything below is inert while js/config.mjs is empty. ─────────────────────────
if (supa.enabled) {
  const btn = $('#btn-account');
  btn.hidden = false;
  btn.addEventListener('click', () => openOverlay('#auth'));
  const form = $('#auth-form');
  const setMode = (mode) => {
    form.dataset.mode = mode;
    const up = mode === 'signup';
    if (!state.gateTitle) $('#auth-title').textContent = up ? 'Crée ton compte' : 'Connexion';
    $('#auth-sub').textContent = up ? 'Gratuit, en dix secondes. Pas d\'e-mail à confirmer.' : 'Content de te revoir.';
    $('#auth-go').textContent = up ? 'Créer mon compte' : 'Me connecter';
    $('#auth-switch').textContent = up ? 'J\'ai déjà un compte' : 'Créer un compte';
    form.elements.password.autocomplete = up ? 'new-password' : 'current-password';
  };
  $('#auth-switch').addEventListener('click', () => setMode(form.dataset.mode === 'signup' ? 'login' : 'signup'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const go = $('#auth-go'); go.disabled = true;
    const fn = form.dataset.mode === 'signup' ? supa.signUp : supa.signIn;
    const { error } = await fn(form.elements.email.value.trim(), form.elements.password.value);
    go.disabled = false;
    if (error) return toast(error);
    form.elements.password.value = '';
    track(form.dataset.mode === 'signup' ? 'signup' : 'login');
    setTimeout(() => { if (state.data && store.planLevel() === 0 && document.body.dataset.state === 'scan') lockedPaywall(); }, 1600); // account created, still no plan
    closeOverlays(); toast(form.dataset.mode === 'signup' ? 'Compte créé. Voici tes commerces.' : 'Connecté.');
  });
  $('#gate-btn').addEventListener('click', () => askAccount());
  $('#auth-out').addEventListener('click', async () => { await supa.signOut(); closeOverlays(); toast('Déconnecté.'); });

  let lastPlan;
  supa.onAuth(async ({ user, plan }) => {
    state.user = user; state.gateTitle = ''; updateGate();
    store.setServerPlan(user ? plan : null);
    btn.textContent = user ? (user.email || 'Mon compte') : 'Connexion';
    $('#auth-form').hidden = !!user; $('#auth-sub').hidden = !!user; $('#auth-me').hidden = !user;
    if (user) { $('#auth-email').textContent = user.email || ''; $('#auth-plan').textContent = planById(store.getPlanId())?.name || 'Découverte'; store.mergePipeline(await supa.pullPipeline()); }
    renderPlans(); refreshLocks();
    // the unlocked shops depend on the plan: reload the city when it changes under our feet
    if (lastPlan !== undefined && lastPlan !== store.getPlanId() && state.data && document.body.dataset.state === 'scan') {
      const fresh = await loadCity(state.city, {}).catch(() => null);
      if (fresh) { const hidden = new Set(store.getHidden()); for (const l of fresh.leads) l._hidden = hidden.has(l.id); state.data = fresh; fog.setCity(fresh.center, fresh.leads); fog.startReveal({ duration: 900, onCount: (n) => { $('#hud-num').textContent = fr(n); } }); applyLocks(); applyFilter(); renderTierCounts(); renderFilters(); renderList(); }
    } else if (state.data) renderList();
    lastPlan = store.getPlanId();
  });
}

// try a plan without paying (prototype only): ?plan=free | m1 | m3 | y1   (?pro=1 still means Essentiel)
const qs = new URLSearchParams(location.search);
if (qs.get('plan')) store.setPlanId(qs.get('plan'));
else if (qs.get('pro') != null) store.setPlanId(qs.get('pro') === '1' ? 'm1' : 'free');
renderPlans(); refreshLocks();
