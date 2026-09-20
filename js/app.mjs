import { TRADES, verifyLead, reverseAddress } from './core/leads.mjs';
import { encodePayload, leadToPayload } from './core/payload.mjs';
import { FogLayer } from './fog.mjs';
import { loadIndex, searchCities, loadCity, communeContour, cityByInsee, rankOf } from './city.mjs';
import { drawCard, cardBlob } from './card.mjs';
import * as sound from './sound.mjs';
import * as store from './store.mjs';
import { BRAND, applyBrand } from './brand.mjs';

applyBrand();

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
const input = $('#city'), suggest = $('#suggest');
let results = [], active = -1, debounce = 0;

function renderSuggest() {
  suggest.replaceChildren();
  suggest.hidden = !results.length;
  results.forEach((c, i) => {
    const pre = state.index.cities?.some((x) => x.insee === c.insee);
    suggest.append(el('li', { role: 'option', 'aria-selected': String(i === active), onmousedown: (e) => { e.preventDefault(); choose(c); } },
      el('b', { text: c.name }), el('small', {}, `${c.dept} · ${fr(c.population)} hab.`, pre ? el('span', { class: 'pre', text: ' · pré-scannée' }) : null)));
  });
}
function choose(c) { input.value = c.name; results = []; renderSuggest(); scan(c); }

input.addEventListener('input', () => {
  clearTimeout(debounce);
  const q = input.value.trim();
  if (q.length < 2) { results = []; renderSuggest(); return; }
  debounce = setTimeout(async () => { results = await searchCities(q); active = results.length ? 0 : -1; renderSuggest(); }, 160);
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
  const found = await searchCities(q);
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
  sound.landed();
  renderTierCounts();
  if (rank.rank) {
    const r = $('#hud-rank');
    r.textContent = `#${rank.rank} / ${rank.total} villes · ${String(rank.per10k).replace('.', ',')} pour 10 000 hab.`;
    r.hidden = false;
  }
  renderFilters(); renderList(); renderGoal();
  if (isDesktop()) $('#panel').dataset.open = 'true';
}

function backToLanding() {
  document.body.dataset.state = 'landing';
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
  const list = $('#list'), rows = state.data.leads.filter(visible), pipeline = store.getPipeline();
  list.replaceChildren();
  $('#panel-sub').textContent = `${fr(rows.length)} commerce${rows.length > 1 ? 's' : ''}`;
  { const pl = TRADES[state.trade]?.plural; $('#panel-title').textContent = state.trade === 'all' || !pl ? 'Tes prospects' : pl[0].toUpperCase() + pl.slice(1); }
  if (!rows.length) { list.append(el('li', { class: 'empty', text: 'Rien avec ces filtres.' })); return; }
  for (const l of rows.slice(0, state.listLimit)) {
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

function openLead(lead, fly = false) {
  state.lead = lead; fog.setSelected(lead.id); sound.flip();
  if (!isDesktop()) $('#panel').dataset.open = 'false';
  if (fly) map.easeTo({ center: [lead.lon, lead.lat], zoom: Math.max(map.getZoom(), 14.5), duration: 700, offset: isDesktop() ? [-160, 0] : [0, -120] });
  $$('#list li.sel').forEach((n) => n.classList.remove('sel'));
  $(`#list li[data-id="${lead.id}"]`)?.classList.add('sel');
  renderLead();
  const card = $('.leadcard'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  openOverlay('#lead');
  enrichLead(lead);
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
  $('#quota').textContent = left === Infinity ? 'Offre Pro : maquettes illimitées.' : `${left} maquette${left > 1 ? 's' : ''} gratuite${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''} aujourd'hui.`;
}

/** live mode: domain check + reverse geocoding happen when the card opens */
async function enrichLead(l) {
  const jobs = [];
  if (l.tier === 'pending' && !l._checking) {
    l._checking = true; renderLead();
    jobs.push(verifyLead(l, state.data.name).then((v) => {
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
  closeOverlays(); fog.setSelected(null); applyFilter(); renderTierCounts(); renderFilters(); renderList();
  toast('Merci, retiré de ta carte. En production, ce signalement nettoie la carte de tout le monde.');
});

// ───────────────────────── Demo site ─────────────────────────
const BUILD_STEPS = ['Nom et métier', 'Adresse et plan', 'Horaires d\'ouverture', 'Bouton d\'appel', 'Mise en page'];

$('#btn-build').addEventListener('click', async () => {
  const l = state.lead;
  store.setAuthor($('#author').value);
  if (!store.canBuild(l.id)) { $('#lead').hidden = true; return openPaywall('Tu as utilisé tes 3 maquettes du jour.'); }
  store.countBuild(l.id);
  const t0 = performance.now();
  const url = new URL('demo.html', location.href);
  url.hash = encodePayload(leadToPayload(l, state.data.name, store.getAuthor()));
  state.demoUrl = url.href;

  $('#lead').hidden = true;
  const frame = $('#demo-frame'), build = $('#build'), steps = $('#build-steps');
  frame.classList.remove('on'); build.classList.remove('off');
  steps.replaceChildren(...BUILD_STEPS.map((s) => el('li', { text: s })));
  $('#demo-name').textContent = l.name; $('#demo-ms').textContent = '…';
  $('.demo-side').dataset.expanded = 'false'; $('#demo-more').textContent = 'Script de vente et suivi'; $('#demo-more').setAttribute('aria-expanded', 'false');
  $('#demo-open').href = url.href;
  openOverlay('#demo');
  renderStatus(); renderScripts();

  // the demo page posts 'stv-demo-ready' once rendered ('load' alone could be a stale about:blank)
  const loaded = new Promise((res) => {
    const onMsg = (e) => { if (e.source === frame.contentWindow && e.data?.type === 'stv-demo-ready') done(); };
    const done = () => { removeEventListener('message', onMsg); clearTimeout(timer); res(); };
    const timer = setTimeout(done, 3500);
    addEventListener('message', onMsg);
  });
  frame.src = url.href;
  // the flourish is short on purpose: the site really is ready in well under a second
  for (const li of $$('li', steps)) { await new Promise((r) => setTimeout(r, 130)); li.classList.add('ok'); }
  await loaded;
  $('#demo-ms').textContent = ((performance.now() - t0) / 1000).toFixed(1).replace('.', ',') + ' s';
  build.classList.add('off'); frame.classList.add('on'); sound.built();
});

$('#demo-more').addEventListener('click', (e) => {
  const side = $('.demo-side'), open = side.dataset.expanded !== 'true';
  side.dataset.expanded = String(open); e.currentTarget.setAttribute('aria-expanded', String(open));
  e.currentTarget.textContent = open ? 'Revoir le site en grand' : 'Script de vente et suivi';
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
      if (!store.isPro() && s.key !== 'todo' && s.key !== 'contacted') return openPaywall('Le suivi complet fait partie de l\'offre Pro.');
      store.setStatus(state.lead, state.data.name, cur === s.key ? null : s.key); renderStatus(); renderList(); renderGoal();
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
  const tabs = $('#script-tabs'), body = $('#script-body'), pro = store.isPro();
  tabs.replaceChildren(...CHANNELS.map((c) => el('button', {
    type: 'button', role: 'tab', 'aria-selected': String(state.channel === c.key),
    onclick: () => { state.channel = c.key; renderScripts(); },
  }, c.label, !c.free && !pro ? el('span', { class: 'lock', text: '🔒' }) : null)));

  const content = await loadContent(), l = state.lead, fam = TRADES[l.trade]?.tpl || 'atelier';
  const ch = CHANNELS.find((c) => c.key === state.channel), locked = !ch.free && !pro;
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
  copy.textContent = locked ? 'Débloquer avec l\'offre Pro' : 'Copier le script';
  copy.onclick = locked
    ? () => openPaywall('Les scripts DM, e-mail, appel et objections font partie de l\'offre Pro.')
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
function openPaywall(title) { if (title) $('#pay-title').textContent = title; openOverlay('#paywall'); }
$$('[data-open-paywall]').forEach((b) => b.addEventListener('click', () => openPaywall('L\'offre Pro ouvre bientôt.')));
$('#waitlist').addEventListener('submit', (e) => {
  e.preventDefault(); store.saveWaitlist(e.target.querySelector('input').value);
  closeOverlays(); toast('C\'est noté. On te prévient à l\'ouverture.');
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
const proParam = new URLSearchParams(location.search).get('pro');
if (proParam != null) store.setPro(proParam === '1');
