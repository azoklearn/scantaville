// City search (geo.api.gouv.fr) and city loading:
//   1. pre-computed static JSON (data/cities/{insee}.json): what 95 % of TikTok traffic hits, costs nothing;
//   2. live fallback: the visitor's own browser asks Overpass once (their IP, their quota), result cached.
// Production replaces (2) with a weekly pre-compute of every commune from a Geofabrik extract.
import { buildOverpassQuery, elementsToLeads, summarize } from './core/leads.mjs';
import { cacheCity, cachedCity } from './store.mjs';
import * as supa from './supa.mjs';

const GEO = 'https://geo.api.gouv.fr';
const PHOTON = 'https://photon.komoot.io/api/'; // open geocoder on OpenStreetMap data: free, keyless, CORS-open

// France uses the official commune API (population, contour, INSEE code). Elsewhere cities come from OpenStreetMap.
// The interface, the sales scripts and the legal kit are in French: the list sticks to French-speaking neighbours.
export const COUNTRIES = [
  { code: 'FR', name: 'France', flag: '🇫🇷', tld: 'fr' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪', tld: 'be' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭', tld: 'ch' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', tld: 'lu' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', tld: 'ca' },
];
export const countryOf = (code) => COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

let indexPromise = null;
export function loadIndex() {
  indexPromise ??= fetch('data/index.json').then((r) => (r.ok ? r.json() : { cities: [] })).catch(() => ({ cities: [] }));
  return indexPromise;
}

let searchCtl = null;
export async function searchCities(q, country = 'FR') {
  searchCtl?.abort(); searchCtl = new AbortController();
  if (country !== 'FR') return searchAbroad(q, country, searchCtl.signal);
  const url = `${GEO}/communes?nom=${encodeURIComponent(q)}&fields=nom,code,codeDepartement,population,centre&boost=population&limit=7`;
  try {
    const r = await fetch(url, { signal: searchCtl.signal });
    if (!r.ok) return [];
    return (await r.json()).filter((c) => c.centre).map((c) => ({
      insee: c.code, name: c.nom, dept: c.codeDepartement, population: c.population || 0, center: c.centre.coordinates, country: 'FR',
    }));
  } catch { return []; }
}

// We need the city's boundary RELATION (that is what Overpass turns into a search area), not a place node.
const fromPhoton = (f) => {
  const p = f.properties || {};
  if (p.osm_type !== 'R' || !p.osm_id || !f.geometry?.coordinates) return null;
  return { insee: `osm-${p.osm_id}`, name: p.name, dept: p.state || p.county || p.country || '', population: 0, center: f.geometry.coordinates, country: String(p.countrycode || '').toUpperCase() };
};

async function searchAbroad(q, country, signal) {
  try {
    const r = await fetch(`${PHOTON}?q=${encodeURIComponent(q)}&limit=15&lang=fr&layer=city`, { signal });
    if (!r.ok) return [];
    return (await r.json()).features.map(fromPhoton).filter((c) => c && c.name && c.country === country).slice(0, 7);
  } catch { return []; }
}

export async function cityByInsee(insee) {
  if (/^osm-\d{1,12}$/.test(insee)) return cityByRelation(insee.slice(4));
  if (!/^\d[\dAB]\d{3}$/.test(insee)) return null;
  try {
    const r = await fetch(`${GEO}/communes/${insee}?fields=nom,code,codeDepartement,population,centre`);
    if (!r.ok) return null;
    const c = await r.json();
    return c.centre ? { insee: c.code, name: c.nom, dept: c.codeDepartement, population: c.population || 0, center: c.centre.coordinates } : null;
  } catch { return null; }
}

/** deep link to a foreign city (?v=osm-58274): one lookup on Nominatim, which its usage policy allows */
async function cityByRelation(id) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/lookup?osm_ids=R${id}&format=jsonv2&accept-language=fr`);
    const f = r.ok ? (await r.json())[0] : null;
    if (!f) return null;
    return { insee: `osm-${id}`, name: f.name || String(f.display_name || '').split(',')[0], dept: f.address?.state || '', population: 0, center: [Number(f.lon), Number(f.lat)], country: String(f.address?.country_code || '').toUpperCase() };
  } catch { return null; }
}

export async function communeContour(insee) {
  if (!/^\d[\dAB]\d{3}$/.test(insee)) return null; // contours come from the French commune API only
  try {
    const r = await fetch(`${GEO}/communes/${insee}?fields=contour&format=geojson&geometry=contour`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

function bboxOf(leads, center) {
  let b = [center[0], center[1], center[0], center[1]];
  for (const l of leads) b = [Math.min(b[0], l.lon), Math.min(b[1], l.lat), Math.max(b[2], l.lon), Math.max(b[3], l.lat)];
  return b;
}

/** @returns city object in the data/cities/*.json shape, plus { live: boolean } */
export async function loadCity(city, { onStatus } = {}) {
  // Accounts on: the shops come from the database, which already hides what the plan has not unlocked.
  if (supa.enabled) {
    const leads = await supa.cityLeads(city.insee);
    if (leads) {
      const gold = leads.filter((l) => l.tier === 'gold').length, social = leads.filter((l) => l.tier === 'social').length;
      return { v: 1, insee: city.insee, name: city.name, slug: city.slug, dept: city.dept, population: city.population, center: city.center,
        source: '© OpenStreetMap contributors (ODbL)', live: false, serverLocks: true, country: city.country || 'FR',
        stats: { leads: gold + social, gold, social, silver: 0, byTrade: {} }, leads };
    }
  }
  try {
    const r = await fetch(`data/cities/${city.insee}.json`);
    if (r.ok) { const data = await r.json(); return { ...data, live: false }; }
  } catch { /* fall through to live */ }

  const cached = cachedCity(city.insee);
  if (cached) return cached;

  onStatus?.('Lecture en direct d\'OpenStreetMap… (10 à 20 s)');
  const body = 'data=' + encodeURIComponent(buildOverpassQuery(city.insee));
  let json = null, lastErr = null;
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      json = await r.json(); break;
    } catch (e) { lastErr = e; }
  }
  if (!json) throw new Error('OpenStreetMap est saturé pour le moment. Réessaie dans une minute, ou choisis une ville pré-scannée.', { cause: lastErr });

  onStatus?.('Tri des commerces…');
  const { leads, stats } = elementsToLeads(json.elements || []);
  // live mode: the domain check runs lazily when a pin is opened, so 'pending' counts as gold for now
  const s = summarize(leads);
  const data = {
    v: 1, insee: city.insee, name: city.name, dept: city.dept, population: city.population, center: city.center, country: city.country || 'FR',
    bbox: bboxOf(leads, city.center), generatedAt: new Date().toISOString().slice(0, 10),
    source: '© OpenStreetMap contributors (ODbL)', live: true,
    stats: { ...stats, leads: s.leads, gold: s.gold + s.pending, social: s.social, silver: s.silver, byTrade: s.byTrade },
    leads,
  };
  cacheCity(city.insee, data);
  return data;
}

/** rank of a city (pre-computed or live) among the pre-scanned ones, by leads per 10 000 inhabitants */
export function rankOf(index, data) {
  const per10k = data.population ? +(data.stats.leads / data.population * 10000).toFixed(1) : null;
  const others = (index.cities || []).filter((c) => c.insee !== data.insee);
  if (per10k == null) return { per10k: null, rank: null, total: others.length + 1 };
  const rank = 1 + others.filter((c) => c.per10k > per10k).length;
  return { per10k, rank, total: others.length + 1 };
}
