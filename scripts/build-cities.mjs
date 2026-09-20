#!/usr/bin/env node
// ScanTaVille — city data pipeline (Node >= 20, ESM, zero dependency).
//
//   node scripts/build-cities.mjs                 build every city of the list below
//   node scripts/build-cities.mjs 37261 49007     build only those (index.json is still rebuilt from every file present)
//   node scripts/build-cities.mjs --refresh       ignore the cached Overpass responses (DNS / address caches are kept)
//   node scripts/build-cities.mjs --refresh-all   ignore every cache
//   node scripts/build-cities.mjs --check         no network: validate data/ and print the summary table
//
// Output: data/cities/{insee}.json + data/index.json.   Cache: scripts/.cache/
//
// Politeness rules (the public Overpass instance is a shared free service):
//   - ONE Overpass request at a time, never parallel, >= 35 s between two requests
//   - 429 / 504 / timeouts: wait 60-90 s, retry, 4 tries max, 3rd try goes to the kumi.systems mirror
//   - every raw Overpass response is cached on disk, re-runs do not hit the network again
//   - DNS-over-HTTPS and BAN reverse-geocoding calls are rate-limited, retried and cached too

import { mkdir, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TRADES, buildOverpassQuery, elementsToLeads, domainCandidates, verifyLead,
  reverseAddress, mapLimit, summarize, slugify,
} from '../js/core/leads.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CACHE_DIR = path.join(HERE, '.cache');
const DATA_DIR = path.join(ROOT, 'data');
const CITIES_DIR = path.join(DATA_DIR, 'cities');

const CITIES = [
  ['37261', 'Tours'], ['49007', 'Angers'], ['35238', 'Rennes'], ['44109', 'Nantes'],
  ['33063', 'Bordeaux'], ['31555', 'Toulouse'], ['34172', 'Montpellier'], ['59350', 'Lille'],
  ['67482', 'Strasbourg'], ['38185', 'Grenoble'], ['21231', 'Dijon'], ['74010', 'Annecy'],
  ['17300', 'La Rochelle'], ['06088', 'Nice'], ['69123', 'Lyon'], ['13055', 'Marseille'],
];

const UA = 'ScanTaVille-MVP-build/0.1 (local prototype)';
const OVERPASS_MAIN = 'https://overpass-api.de/api/interpreter';
const OVERPASS_MIRROR = 'https://overpass.kumi.systems/api/interpreter';
const OVERPASS_MIN_GAP_MS = 35_000;
const OVERPASS_MAX_TRIES = 4;
const SOURCE = '© OpenStreetMap contributors (ODbL)';
const TIERS = ['gold', 'social', 'silver'];

const argv = process.argv.slice(2);
const FLAGS = new Set(argv.filter((a) => a.startsWith('--')));
const REFRESH_ALL = FLAGS.has('--refresh-all');
const REFRESH = REFRESH_ALL || FLAGS.has('--refresh');
const CHECK_ONLY = FLAGS.has('--check');
const wanted = argv.filter((a) => !a.startsWith('--'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, text);
  await rename(tmp, file); // other agents / the dev server may be reading data/ while we write
}

// ---------------------------------------------------------------------------------------------
// Cached + rate-limited + retried network layer for the two high-volume lookups done inside
// leads.mjs (verifyLead -> Cloudflare DoH, reverseAddress -> BAN). leads.mjs only knows `fetch`,
// so the build script wraps the global fetch for these two hosts and leaves everything else alone.
// ---------------------------------------------------------------------------------------------
const realFetch = globalThis.fetch;
const DNS_CACHE_FILE = path.join(CACHE_DIR, '_dns.json');
const REV_CACHE_FILE = path.join(CACHE_DIR, '_reverse.json');
let dnsCache = {}; // domain -> DNS Status (0 = exists, 3 = NXDOMAIN, 2 = SERVFAIL confirmed twice); lookup failures are never stored
let revCache = {}; // "lat,lon" -> { label, distance } | null
const net = { dnsQueries: 0, dnsHits: 0, dnsFailed: 0, revQueries: 0, revHits: 0, revFailed: 0 };

function makeLimiter(minGapMs) {
  let next = 0;
  return async () => {
    const now = Date.now();
    const at = Math.max(now, next);
    next = at + minGapMs;
    if (at > now) await sleep(at - now);
  };
}
const dnsSlot = makeLimiter(4);  // <= ~250 DoH requests / s
const revSlot = makeLimiter(30); // <= ~33 req / s (BAN allows 50 / s / IP)

const jsonResponse = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });

async function dnsFetch(url, init) {
  const name = (new URL(url).searchParams.get('name') || '').toLowerCase();
  if (name in dnsCache) { net.dnsHits++; return jsonResponse({ Status: dnsCache[name] }); }
  for (let attempt = 1; attempt <= 3; attempt++) {
    await dnsSlot();
    try {
      net.dnsQueries++;
      const r = await realFetch(url, { headers: init?.headers, signal: AbortSignal.timeout(10_000) });
      if (r.ok) {
        const j = await r.json();
        if (j && typeof j.Status === 'number') {
          // 0 = exists, 3 = NXDOMAIN: definitive. Anything else is nearly always SERVFAIL on a registered domain
          // whose name servers refuse to answer (parked / expired hosting): confirm it once, then keep it.
          // leads.mjs reads "not 3" as "registered", which is the conservative side (lead goes silver).
          if (j.Status === 0 || j.Status === 3 || attempt >= 2) { dnsCache[name] = j.Status; return jsonResponse({ Status: j.Status }); }
        }
      } else { await r.arrayBuffer().catch(() => {}); }
    } catch { /* retry */ }
    await sleep(400 * attempt + Math.random() * 300);
  }
  net.dnsFailed++;
  return new Response('', { status: 503 }); // leads.mjs turns this into null = "lookup failed"
}

async function revFetch(url) {
  const u = new URL(url);
  const key = `${u.searchParams.get('lat')},${u.searchParams.get('lon')}`;
  if (key in revCache) { net.revHits++; const p = revCache[key]; return jsonResponse({ features: p ? [{ properties: p }] : [] }); }
  for (let attempt = 1; attempt <= 3; attempt++) {
    await revSlot();
    try {
      net.revQueries++;
      const r = await realFetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
      if (r.ok) {
        const j = await r.json();
        const p = j.features?.[0]?.properties;
        revCache[key] = p ? { label: p.label ?? null, distance: p.distance ?? null } : null;
        return jsonResponse({ features: p ? [{ properties: revCache[key] }] : [] });
      }
      await r.arrayBuffer().catch(() => {});
      if (r.status >= 400 && r.status < 500 && r.status !== 429) break; // bad request: retrying is pointless
    } catch { /* retry */ }
    await sleep(800 * attempt + Math.random() * 400);
  }
  net.revFailed++;
  return new Response('', { status: 503 });
}

globalThis.fetch = function patchedFetch(input, init) {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input));
  if (url.startsWith('https://cloudflare-dns.com/dns-query')) return dnsFetch(url, init);
  if (url.startsWith('https://api-adresse.data.gouv.fr/reverse/')) return revFetch(url);
  return realFetch(input, init);
};

async function loadCaches() {
  if (REFRESH_ALL) return;
  try { dnsCache = await readJson(DNS_CACHE_FILE); } catch { dnsCache = {}; }
  try { revCache = await readJson(REV_CACHE_FILE); } catch { revCache = {}; }
}
async function saveCaches() {
  await writeAtomic(DNS_CACHE_FILE, JSON.stringify(dnsCache));
  await writeAtomic(REV_CACHE_FILE, JSON.stringify(revCache));
}

// ---------------------------------------------------------------------------------------------
// Overpass: strictly sequential, polite, cached
// ---------------------------------------------------------------------------------------------
let lastOverpassAt = 0; // end of the previous Overpass request (any mirror)

function parseOverpass(text) {
  let j;
  try { j = JSON.parse(text); } catch { throw new Error('response is not JSON (' + text.slice(0, 80).replace(/\s+/g, ' ') + ')'); }
  if (!Array.isArray(j.elements)) throw new Error('no "elements" array');
  if (j.remark && /error|timed out|out of memory/i.test(j.remark)) throw new Error('remark: ' + j.remark);
  if (!j.elements.length) throw new Error('0 element (area not found or server-side area lag)');
  return j;
}

async function fetchOverpass(insee) {
  const cacheFile = path.join(CACHE_DIR, `${insee}.json`);
  if (!REFRESH) {
    try {
      const j = parseOverpass(await readFile(cacheFile, 'utf8'));
      return { json: j, cached: true };
    } catch { /* no usable cache: go to the network */ }
  }
  const body = 'data=' + encodeURIComponent(buildOverpassQuery(insee));
  let lastErr;
  for (let attempt = 1; attempt <= OVERPASS_MAX_TRIES; attempt++) {
    const endpoint = attempt === 3 ? OVERPASS_MIRROR : OVERPASS_MAIN;
    const wait = lastOverpassAt + OVERPASS_MIN_GAP_MS - Date.now();
    if (wait > 0) { log(`  overpass: polite wait ${Math.ceil(wait / 1000)} s`); await sleep(wait); }
    const t0 = Date.now();
    let fatal = false;
    try {
      log(`  overpass: try ${attempt}/${OVERPASS_MAX_TRIES} -> ${new URL(endpoint).host}`);
      const r = await realFetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
        body,
        signal: AbortSignal.timeout(240_000),
      });
      const text = await r.text();
      lastOverpassAt = Date.now();
      if (r.status === 400) { fatal = true; throw new Error('HTTP 400 (bad query): ' + text.slice(0, 200)); }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = parseOverpass(text);
      await writeAtomic(cacheFile, text);
      log(`  overpass: ${j.elements.length} elements, ${(text.length / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      return { json: j, cached: false };
    } catch (e) {
      lastOverpassAt = Date.now();
      lastErr = e;
      log(`  overpass: failed (${e.message})`);
      if (fatal) break;
    }
    if (attempt < OVERPASS_MAX_TRIES) {
      const back = 60_000 + Math.floor(Math.random() * 30_000);
      log(`  overpass: backing off ${Math.round(back / 1000)} s`);
      await sleep(back);
    }
  }
  throw new Error(`Overpass gave up after ${OVERPASS_MAX_TRIES} tries: ${lastErr?.message}`);
}

// ---------------------------------------------------------------------------------------------
// One city
// ---------------------------------------------------------------------------------------------
async function fetchCommune(insee) {
  const url = `https://geo.api.gouv.fr/communes/${insee}?fields=nom,code,population,centre,codeDepartement`;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await realFetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
      if (r.status === 404) throw Object.assign(new Error(`unknown INSEE code ${insee}`), { fatal: true });
      if (!r.ok) throw new Error(`geo.api.gouv.fr HTTP ${r.status}`);
      const j = await r.json();
      if (!j.nom || !Array.isArray(j.centre?.coordinates)) throw new Error('geo.api.gouv.fr: incomplete answer');
      return j;
    } catch (e) { lastErr = e; if (e.fatal) break; await sleep(2000 * attempt); }
  }
  throw lastErr;
}

const richness = (l) => (l.hours ? 1 : 0) + (l.phone ? 1 : 0) + (l.addr ? 1 : 0);
const needsRetry = (lead, v, city) =>
  v.tier === 'pending' ||
  // a social lead with no taken domain always gets a free .fr suggestion unless lookups failed
  (v.tier === 'social' && !v.domain && domainCandidates(lead.name, city, lead.trade).some((d) => d.endsWith('.fr')));

function cityJson(city) {
  // header pretty-printed, one lead per line: small on disk, still diff-able
  const { leads, ...head } = city;
  const h = JSON.stringify(head, null, 2);
  const body = leads.map((l) => '    ' + JSON.stringify(l)).join(',\n');
  return `${h.slice(0, h.lastIndexOf('}')).trimEnd()},\n  "leads": [\n${body}${leads.length ? '\n' : ''}  ]\n}\n`;
}

async function buildCity(insee) {
  const commune = await fetchCommune(insee);
  const name = commune.nom;
  log(`${name} (${insee}) — ${commune.population?.toLocaleString('fr-FR')} hab.`);

  const { json, cached } = await fetchOverpass(insee);
  if (cached) log(`  overpass: cache hit (${json.elements.length} elements)`);

  const { leads, stats } = elementsToLeads(json.elements);
  log(`  ${stats.poisTotal} POIs -> ${leads.length} candidates (${stats.withWebsite} with website, ${stats.chains} chains, ${stats.tooThin} too thin)`);

  // c. domain-guess check
  const t0 = Date.now();
  const before = { ...net };
  const apply = (lead, v) => { lead.tier = v.tier; lead.domain = v.domain; };
  let todo = leads;
  for (const concurrency of [12, 4, 2]) {
    if (!todo.length) break;
    if (todo !== leads) { log(`  verify: retrying ${todo.length} leads whose DNS lookups failed`); await sleep(3000); }
    const tierBefore = todo.map((l) => l.tier);
    const verdicts = await mapLimit(todo, concurrency, (lead) => verifyLead(lead, name));
    const again = [];
    todo.forEach((lead, i) => {
      const v = verdicts[i];
      if (needsRetry(lead, v, name)) { lead.tier = tierBefore[i]; again.push(lead); } else apply(lead, v);
    });
    todo = again;
  }
  let forcedSilver = 0;
  for (const l of leads) if (l.tier === 'pending') { l.tier = 'silver'; l.domain = null; forcedSilver++; }
  log(`  verify: ${leads.length} leads in ${((Date.now() - t0) / 1000).toFixed(0)} s — DoH ${net.dnsQueries - before.dnsQueries} queries, ${net.dnsHits - before.dnsHits} cache hits, ${net.dnsFailed - before.dnsFailed} failed; ${forcedSilver} still pending -> silver`);

  // d. missing addresses
  const noAddr = leads.filter((l) => l.addr == null);
  const t1 = Date.now();
  const labels = await mapLimit(noAddr, 8, (l) => reverseAddress(l.lat, l.lon));
  let filled = 0;
  noAddr.forEach((l, i) => { if (labels[i]) { l.addr = labels[i]; filled++; } });
  log(`  reverse: ${filled}/${noAddr.length} missing addresses filled in ${((Date.now() - t1) / 1000).toFixed(0)} s`);

  // e. sort, bbox, write
  const tierRank = { gold: 0, social: 1, silver: 2 };
  leads.sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || richness(b) - richness(a) || a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id));

  const [cLon, cLat] = commune.centre.coordinates;
  let bbox = [cLon, cLat, cLon, cLat];
  if (leads.length) {
    bbox = [Infinity, Infinity, -Infinity, -Infinity];
    for (const l of leads) {
      bbox[0] = Math.min(bbox[0], l.lon); bbox[1] = Math.min(bbox[1], l.lat);
      bbox[2] = Math.max(bbox[2], l.lon); bbox[3] = Math.max(bbox[3], l.lat);
    }
  }

  const s = summarize(leads);
  const byTrade = {};
  for (const k of Object.keys(TRADES)) if (s.byTrade[k]) byTrade[k] = s.byTrade[k]; // stable key order
  const city = {
    v: 1,
    insee: commune.code,
    name,
    slug: slugify(name),
    dept: commune.codeDepartement,
    population: commune.population ?? null,
    center: [cLon, cLat],
    bbox,
    generatedAt: today(),
    source: SOURCE,
    stats: {
      poisTotal: stats.poisTotal, withWebsite: stats.withWebsite, chains: stats.chains, tooThin: stats.tooThin,
      leads: s.gold + s.social, gold: s.gold, social: s.social, silver: s.silver, byTrade,
    },
    leads: leads.map((l) => ({
      id: l.id, name: l.name, trade: l.trade, lat: l.lat, lon: l.lon, addr: l.addr ?? null, phone: l.phone ?? null,
      hours: l.hours ?? null, email: l.email ?? null, social: l.social || {}, cuisine: l.cuisine ?? null,
      siret: l.siret ?? null, tier: l.tier, domain: l.domain ?? null,
    })),
  };
  await writeAtomic(path.join(CITIES_DIR, `${commune.code}.json`), cityJson(city));
  await saveCaches();
  log(`  -> data/cities/${commune.code}.json  leads ${city.stats.leads} (gold ${s.gold}, social ${s.social}), silver ${s.silver}`);
}

// ---------------------------------------------------------------------------------------------
// index.json, validation, summary
// ---------------------------------------------------------------------------------------------
async function loadAllCities() {
  let files = [];
  try { files = (await readdir(CITIES_DIR)).filter((f) => /^[0-9AB]{5}\.json$/i.test(f)).sort(); } catch { /* none yet */ }
  const out = [];
  for (const f of files) {
    try { out.push({ file: f, city: await readJson(path.join(CITIES_DIR, f)) }); }
    catch (e) { out.push({ file: f, error: e.message }); }
  }
  return out;
}

const per10k = (leads, pop) => (pop > 0 ? Math.round((leads / pop) * 100_000) / 10 : 0);

async function writeIndex() {
  const cities = (await loadAllCities()).filter((x) => x.city).map(({ city: c }) => ({
    insee: c.insee, name: c.name, slug: c.slug, dept: c.dept, population: c.population, center: c.center,
    leads: c.stats.leads, gold: c.stats.gold, social: c.stats.social,
    per10k: per10k(c.stats.leads, c.population),
  }));
  cities.sort((a, b) => b.per10k - a.per10k || b.leads - a.leads || a.name.localeCompare(b.name, 'fr'));
  cities.forEach((c, i) => { c.rank = i + 1; });
  const text = `{\n  "generatedAt": ${JSON.stringify(today())},\n  "cities": [\n${cities.map((c) => '    ' + JSON.stringify(c)).join(',\n')}\n  ]\n}\n`;
  await writeAtomic(path.join(DATA_DIR, 'index.json'), text);
  return cities;
}

async function validate() {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
  const all = await loadAllCities();
  const LEAD_KEYS = ['id', 'name', 'trade', 'lat', 'lon', 'addr', 'phone', 'hours', 'email', 'social', 'cuisine', 'siret', 'tier', 'domain'];
  const TOP_KEYS = ['v', 'insee', 'name', 'slug', 'dept', 'population', 'center', 'bbox', 'generatedAt', 'source', 'stats', 'leads'];

  for (const { file, city: c, error } of all) {
    if (error) { err(file, 'does not parse: ' + error); continue; }
    for (const k of TOP_KEYS) if (!(k in c)) err(file, `missing key "${k}"`);
    if (c.v !== 1) err(file, 'v !== 1');
    if (`${c.insee}.json` !== file) err(file, `insee ${c.insee} does not match the file name`);
    if (!c.name || c.slug !== slugify(c.name)) err(file, 'bad name / slug');
    if (!isNum(c.population) || c.population <= 0) err(file, 'bad population');
    if (!Array.isArray(c.center) || c.center.length !== 2 || !c.center.every(isNum)) err(file, 'bad center');
    if (!Array.isArray(c.bbox) || c.bbox.length !== 4 || !c.bbox.every(isNum) || c.bbox[0] > c.bbox[2] || c.bbox[1] > c.bbox[3]) err(file, 'bad bbox');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.generatedAt || '')) err(file, 'bad generatedAt');
    if (!Array.isArray(c.leads)) { err(file, 'leads is not an array'); continue; }

    const count = { gold: 0, social: 0, silver: 0 };
    const byTrade = {};
    const ids = new Set();
    let prevTier = 0; let prevRich = 3;
    c.leads.forEach((l, i) => {
      const w = `${file} lead[${i}] ${l?.id ?? '?'}`;
      for (const k of LEAD_KEYS) if (!(k in l)) err(w, `missing key "${k}"`);
      if (typeof l.id !== 'string' || !/^[nwr]\d+$/.test(l.id)) err(w, 'bad id');
      if (ids.has(l.id)) err(w, 'duplicate id'); ids.add(l.id);
      if (typeof l.name !== 'string' || l.name.length < 2) err(w, 'bad name');
      if (!TRADES[l.trade]) err(w, `unknown trade "${l.trade}"`);
      if (!isNum(l.lat) || !isNum(l.lon) || l.lat < 41 || l.lat > 51.5 || l.lon < -5.5 || l.lon > 10) err(w, 'bad lat/lon');
      if (!TIERS.includes(l.tier)) { err(w, `bad tier "${l.tier}"`); return; }
      if (l.social == null || typeof l.social !== 'object') err(w, 'social must be an object');
      if (l.tier === 'silver' && l.domain) err(w, 'silver lead with a suggested domain');
      if (l.domain != null && !/^[a-z0-9-]+\.fr$/.test(l.domain)) err(w, `odd domain "${l.domain}"`);
      if (Array.isArray(c.bbox) && (l.lon < c.bbox[0] || l.lon > c.bbox[2] || l.lat < c.bbox[1] || l.lat > c.bbox[3])) err(w, 'outside bbox');
      count[l.tier]++;
      if (l.tier !== 'silver') byTrade[l.trade] = (byTrade[l.trade] || 0) + 1;
      const t = TIERS.indexOf(l.tier); const r = richness(l);
      if (t < prevTier || (t === prevTier && r > prevRich)) err(w, 'sort order broken');
      prevTier = t; prevRich = r;
    });
    const s = c.stats || {};
    for (const t of TIERS) if (s[t] !== count[t]) err(file, `stats.${t}=${s[t]} but ${count[t]} in leads[]`);
    if (s.leads !== count.gold + count.social) err(file, `stats.leads=${s.leads} != gold+social=${count.gold + count.social}`);
    for (const k of ['poisTotal', 'withWebsite', 'chains', 'tooThin']) if (!Number.isInteger(s[k]) || s[k] < 0) err(file, `bad stats.${k}`);
    if (s.poisTotal - s.withWebsite - s.chains - s.tooThin < c.leads.length) err(file, 'more leads than remaining POIs');
    const a = JSON.stringify(Object.entries(s.byTrade || {}).sort());
    const b = JSON.stringify(Object.entries(byTrade).sort());
    if (a !== b) err(file, `stats.byTrade mismatch: ${a} vs ${b}`);
  }

  // index.json
  let index = null;
  try { index = await readJson(path.join(DATA_DIR, 'index.json')); } catch (e) { err('index.json', 'does not parse: ' + e.message); }
  if (index) {
    const okCities = all.filter((x) => x.city);
    if (!Array.isArray(index.cities) || index.cities.length !== okCities.length) err('index.json', `lists ${index.cities?.length} cities, ${okCities.length} files present`);
    (index.cities || []).forEach((e, i) => {
      const c = okCities.find((x) => x.city.insee === e.insee)?.city;
      if (!c) return err('index.json', `${e.insee} has no city file`);
      if (e.rank !== i + 1) err('index.json', `${e.name}: rank ${e.rank} at position ${i + 1}`);
      if (i > 0 && index.cities[i - 1].per10k < e.per10k) err('index.json', `${e.name}: not sorted by per10k`);
      if (e.leads !== c.stats.leads || e.gold !== c.stats.gold || e.social !== c.stats.social) err('index.json', `${e.name}: counts differ from the city file`);
      if (e.per10k !== per10k(c.stats.leads, c.population)) err('index.json', `${e.name}: per10k ${e.per10k} != ${per10k(c.stats.leads, c.population)}`);
      if (e.name !== c.name || e.slug !== c.slug || e.dept !== c.dept || e.population !== c.population) err('index.json', `${e.name}: identity fields differ`);
    });
  }
  return { errors, all, index };
}

function printSummary(all, index) {
  const rows = (index?.cities || []).map((e) => {
    const c = all.find((x) => x.city?.insee === e.insee)?.city;
    return [String(e.rank), e.name, e.insee, c.population, c.stats.poisTotal, c.stats.leads, c.stats.gold, c.stats.social, c.stats.silver, e.per10k.toFixed(1)];
  });
  const head = ['#', 'city', 'insee', 'population', 'poisTotal', 'leads', 'gold', 'social', 'silver', 'per10k'];
  const tot = ['', 'TOTAL', '', 0, 0, 0, 0, 0, 0, ''];
  for (const r of rows) for (const i of [3, 4, 5, 6, 7, 8]) tot[i] += r[i];
  const table = [head, ...rows, tot].map((r) => r.map(String));
  const w = head.map((_, i) => Math.max(...table.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => (i === 1 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ');
  console.log('\n' + line(table[0]) + '\n' + w.map((n) => '-'.repeat(n)).join('  '));
  for (const r of table.slice(1, -1)) console.log(line(r));
  console.log(w.map((n) => '-'.repeat(n)).join('  ') + '\n' + line(table.at(-1)));
}

// ---------------------------------------------------------------------------------------------
async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(CITIES_DIR, { recursive: true });

  const skipped = [];
  if (!CHECK_ONLY) {
    const bad = wanted.filter((c) => !/^\d[0-9AB]\d{3}$/i.test(c));
    if (bad.length) { console.error('Not an INSEE code: ' + bad.join(', ')); process.exit(2); }
    const targets = wanted.length ? wanted.map((c) => c.toUpperCase()) : CITIES.map(([c]) => c);
    await loadCaches();
    log(`building ${targets.length} cit${targets.length > 1 ? 'ies' : 'y'}${REFRESH ? ' (refresh)' : ''} — DNS cache ${Object.keys(dnsCache).length}, address cache ${Object.keys(revCache).length}`);
    for (const insee of targets) {
      try { await buildCity(insee); }
      catch (e) {
        const label = CITIES.find(([c]) => c === insee)?.[1] || insee;
        skipped.push(`${label} (${insee}): ${e.message}`);
        log(`  !! skipped ${label} (${insee}): ${e.message}`);
        await saveCaches().catch(() => {});
      }
    }
    await writeIndex();
  }

  const { errors, all, index } = await validate();
  printSummary(all, index);
  if (!CHECK_ONLY) console.log(`\nnetwork: DoH ${net.dnsQueries} queries / ${net.dnsHits} cache hits / ${net.dnsFailed} failed — BAN reverse ${net.revQueries} queries / ${net.revHits} cache hits / ${net.revFailed} failed`);
  console.log(`\nskipped cities: ${skipped.length ? '\n  - ' + skipped.join('\n  - ') : 'none'}`);
  console.log(`validation: ${errors.length ? errors.length + ' problem(s)' : 'OK'} (${all.length} city files)`);
  for (const e of errors.slice(0, 40)) console.log('  - ' + e);
  if (errors.length > 40) console.log(`  … and ${errors.length - 40} more`);
  process.exitCode = errors.length || skipped.length ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
