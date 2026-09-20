// demo.html bootstrap: URL hash -> sanitised model -> one of the four families -> DOM.
// Order matters for the "site en 1 seconde" beat: render first (sync), then fonts, then the lazy map.
import { decodePayload } from '../core/payload.mjs';
import { TRADES } from '../core/leads.mjs';
import { cleanText, cleanFirstName, cleanPhone, cleanEmail, cleanSocial, cleanCoords, cleanDomain } from './safe.mjs';
import { parseOpeningHours, statusNow } from './hours.mjs';
import { FAMILY_COPY, SAMPLES, SAMPLE_BY_FAMILY, copyFor, cuisineLabel, monogram } from './content.mjs';
import { kitFor, pickVariant, PALETTE_VARS } from './trade-kit.mjs';
import { TRADE_COPY } from './content.mjs';
import { renderFamily } from './templates.mjs';

const FONTS = {
  salon: 'family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Jost:wght@300;400;500',
  table: 'family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..700,0..100,0..1;1,9..144,300..700,0..100,0..1&family=Instrument+Sans:wght@400;500;600',
  fournil: 'family=Caprasimo&family=Karla:ital,wght@0,400;0,500;0,700;1,400',
  atelier: 'family=Big+Shoulders+Display:wght@700;800;900&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500',
};
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl';
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

const root = document.documentElement;
const app = document.getElementById('app');
const ribbon = document.getElementById('ribbon-text');
let model = null;
let mapCleanup = null;

// ---- payload -> model ----------------------------------------------------------------------------

function samplePayload() {
  const q = new URLSearchParams(location.search).get('sample') || '';
  const trade = Object.hasOwn(SAMPLE_BY_FAMILY, q) ? SAMPLE_BY_FAMILY[q] : Object.hasOwn(SAMPLES, q) ? q : 'coiffeur';
  return { ...SAMPLES[trade], t: trade };
}

function readPayload() {
  const hash = location.hash.replace(/^#/, '');
  if (hash.length > 8 && hash.length < 6000) {
    const p = decodePayload(hash);
    if (p && !Array.isArray(p) && cleanText(p.n, 80).length >= 2) return p;
  }
  return samplePayload();
}

function splitAddress(full, city) {
  if (!full) return null;
  const i = full.indexOf(',');
  let line1 = i > 0 ? full.slice(0, i).trim() : full;
  let line2 = i > 0 ? full.slice(i + 1).trim() : '';
  if (!line2 && city && !line1.toLowerCase().includes(city.toLowerCase())) line2 = city;
  return { line1, line2, full: [line1, line2].filter(Boolean).join(', ') };
}

function itineraryUrl(name, addr, coords) {
  if (addr) return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(`${name}, ${addr.full}`);
  if (coords) return `https://www.openstreetmap.org/directions?to=${coords.lat.toFixed(6)}%2C${coords.lon.toFixed(6)}`;
  return null;
}

function buildModel(p) {
  const trade = typeof p.t === 'string' && Object.hasOwn(TRADES, p.t) ? p.t : 'commerce';
  const tplRaw = TRADES[trade].tpl;
  const tpl = Object.hasOwn(FAMILY_COPY, tplRaw) ? tplRaw : 'atelier';
  const name = cleanText(p.n, 80);
  const city = cleanText(p.c, 60);
  const copy = copyFor(trade, name);
  const kit = kitFor(trade);
  const coords0 = cleanCoords(p.la, p.lo);
  const vRaw = Number(p.v);
  const variant = pickVariant(trade, `${name}|${coords0 ? coords0.lat.toFixed(4) + ',' + coords0.lon.toFixed(4) : city}`, Number.isInteger(vRaw) && vRaw >= 0 && vRaw < 12 ? vRaw : 0);
  // a tagline refined from the shop's name (chocolaterie, cave...) says more than a generic alternate: keep it
  const tagline = variant.tagline && copy.tagline === TRADE_COPY[trade]?.tagline ? variant.tagline : copy.tagline;
  const coords = cleanCoords(p.la, p.lo);
  const addr = splitAddress(cleanText(p.a, 160), city);
  const hoursRaw = cleanText(p.h, 300);
  const words = name.split(/[\s-]+/).filter(Boolean);
  const len = Array.from(name).length;
  return {
    name, trade, tpl, city,
    label: copy.label, tagline, items: copy.items, kit, variant, fam: { ...FAMILY_COPY[tpl], ...(kit.ui || {}) },
    mono: monogram(name, Array.from(copy.label)[0]),
    longest: Math.max(4, ...words.map((w) => Array.from(w).length)),
    lenScale: len <= 14 ? 1 : len <= 24 ? 0.86 : len <= 38 ? 0.72 : len <= 50 ? 0.6 : 0.5,
    addr, coords, itinerary: itineraryUrl(name, addr, coords),
    phone: cleanPhone(p.p), email: cleanEmail(p.e), ig: cleanSocial(p.ig, 'ig'), fb: cleanSocial(p.fb, 'fb'),
    cuisine: cuisineLabel(p.cu), by: cleanFirstName(p.by), domain: cleanDomain(p.d),
    hoursRaw, hours: parseOpeningHours(hoursRaw),
    // Opening hours are wall-clock time at the shop. Metropolitan France -> Europe/Paris; elsewhere (DROM...) -> viewer's clock.
    timeZone: !coords || (coords.lat > 41 && coords.lat < 51.5 && coords.lon > -5.5 && coords.lon < 10) ? 'Europe/Paris' : undefined,
  };
}

// ---- render --------------------------------------------------------------------------------------

function loadFonts(tpl) {
  const id = 'demo-fonts-' + tpl;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${FONTS[tpl]}&display=swap`;
  document.head.append(link);
}

function tick() {
  if (!model || !model.hours) return;
  const st = statusNow(model.hours, new Date(), model.timeZone);
  for (const el of app.querySelectorAll('[data-pill]')) {
    el.dataset.open = String(st.open);
    el.querySelector('.pill-label').textContent = st.label;
    el.querySelector('.pill-detail').textContent = st.detail;
  }
  for (const tr of app.querySelectorAll('tr[data-day]')) {
    const today = Number(tr.dataset.day) === st.dayIdx;
    tr.classList.toggle('is-today', today);
    if (today) tr.setAttribute('aria-current', 'date'); else tr.removeAttribute('aria-current');
  }
}

function render() {
  model = buildModel(readPayload());
  if (mapCleanup) { mapCleanup(); mapCleanup = null; }
  root.dataset.tpl = model.tpl;
  root.dataset.trade = model.trade;
  root.dataset.look = model.variant.look;
  root.dataset.flip = model.variant.flip ? '1' : '0';
  for (const name of PALETTE_VARS) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(model.variant.palette)) if (PALETTE_VARS.includes(name)) root.style.setProperty(name, value);
  loadFonts(model.tpl);
  document.title = `${model.name}${model.city ? ' · ' + model.city : ''} (maquette)`;
  if (ribbon) ribbon.textContent = `Maquette non officielle${model.by ? ` proposée par ${model.by}` : ''} · ce site n’est pas en ligne`;
  app.replaceChildren(...renderFamily(model));
  tick();
  mapCleanup = lazyMap();
  window.scrollTo(0, 0);
  window.__demoReady = true;
  document.dispatchEvent(new CustomEvent('stv-demo-ready'));
  if (window.parent && window.parent !== window) {
    try { window.parent.postMessage({ type: 'stv-demo-ready' }, '*'); } catch { /* cross-origin parent gone */ }
  }
}

// ---- lazy map (MapLibre is only fetched when the section scrolls into view) -------------------------

let maplibrePromise = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (maplibrePromise) return maplibrePromise;
  maplibrePromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = MAPLIBRE + '.css';
    const js = document.createElement('script');
    js.src = MAPLIBRE + '.js'; js.async = true; js.crossOrigin = 'anonymous';
    js.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error('maplibre missing')));
    js.onerror = () => { maplibrePromise = null; reject(new Error('maplibre blocked')); };
    document.head.append(css, js);
  });
  return maplibrePromise;
}

function lazyMap() {
  const box = app.querySelector('[data-map]');
  if (!box) return null;
  let map = null, dead = false, io = null;
  const fail = () => { box.hidden = true; };           // no map is fine: the address and the itinerary link remain
  const start = async () => {
    try {
      const gl = await loadMapLibre();
      if (dead) return;
      const center = [Number(box.dataset.lon), Number(box.dataset.lat)];
      const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
      map = new gl.Map({
        container: box.querySelector('.map-canvas'), style: MAP_STYLE, center, zoom: calm ? 15.6 : 13.2,
        interactive: false, attributionControl: { compact: true }, fadeDuration: 0,
      });
      const pin = document.createElement('div');
      pin.className = 'map-pin';
      new gl.Marker({ element: pin, anchor: 'bottom' }).setLngLat(center).addTo(map);
      map.once('load', () => {
        box.classList.add('is-live');
        if (!calm) map.easeTo({ zoom: 15.6, duration: 1800 });
      });
      map.on('error', () => { if (!box.classList.contains('is-live')) fail(); });
    } catch { fail(); }
  };
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); io = null; start(); }
    }, { rootMargin: '250px 0px' });
    io.observe(box);
  } else start();
  return () => { dead = true; if (io) io.disconnect(); if (map) map.remove(); };
}

// ---- go ------------------------------------------------------------------------------------------

// The hash IS the shop: in-page anchors must scroll without ever touching location.hash.
document.addEventListener('click', (ev) => {
  const a = ev.target instanceof Element ? ev.target.closest('a[href^="#"]') : null;
  if (!a) return;
  ev.preventDefault();
  const target = document.getElementById(a.getAttribute('href').slice(1));
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (target || document.body).scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
});

render();
addEventListener('hashchange', render);
setInterval(tick, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
