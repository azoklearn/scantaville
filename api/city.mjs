// GET /api/city?id=<INSEE | osm-relationId>
// Reads one city from OpenStreetMap (Overpass) on the server, keeps only the shops without a website, and lets Vercel's
// CDN cache the answer for a week. The browser no longer talks to the public Overpass servers itself: they throttle
// each visitor's IP, and a city like Paris weighs 17 MB raw (about 2 MB once sorted here).
import { buildOverpassQuery, elementsToLeads } from '../js/core/leads.mjs';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const HEADERS = {
  'content-type': 'application/x-www-form-urlencoded',
  'user-agent': 'ScanTaVille/1.0 (+https://www.scantaville.fr; movento.dev@gmail.com)',
  referer: 'https://www.scantaville.fr/',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(query, deadline) {
  const body = 'data=' + encodeURIComponent(query);
  let last = 'no answer', empty = null;
  for (let round = 0; round < 2; round++) {
    for (const url of SERVERS) {
      const left = deadline - Date.now();
      if (left < 8000) return empty ? { json: empty } : { error: last };
      try {
        const r = await fetch(url, { method: 'POST', body, headers: HEADERS, signal: AbortSignal.timeout(Math.min(left - 2000, 40000)) });
        if (!r.ok) { last = `${new URL(url).host} HTTP ${r.status}`; continue; }
        const json = await r.json();
        if (Array.isArray(json.elements) && json.elements.length) return { json };
        // a 200 with nothing in it: a timeout reported as a "remark", or a server whose areas are not ready. Ask the next one.
        if (Array.isArray(json.elements) && !json.remark) empty = json;
        last = `${new URL(url).host} ${json.remark || 'empty'}`;
      } catch (e) { last = `${new URL(url).host} ${e.name}`; }
    }
    await sleep(2500);
  }
  return empty ? { json: empty } : { error: last }; // every server says "nothing here": probably a hamlet with no shop
}

export default async function handler(req, res) {
  const id = String(req.query?.id || '');
  if (!/^(\d[0-9AB]\d{3}|osm-\d{1,12})$/.test(id)) { res.status(400).json({ error: 'bad id' }); return; }
  const { json, error } = await overpass(buildOverpassQuery(id), Date.now() + 55000);
  if (!json) { res.setHeader('Cache-Control', 'no-store'); res.status(503).json({ error }); return; }
  const { leads, stats } = elementsToLeads(json.elements);
  // a full city is kept a week; an empty answer only 5 minutes, in case it was a server hiccup
  res.setHeader('Cache-Control', leads.length ? 'public, max-age=0, s-maxage=604800, stale-while-revalidate=2592000' : 'public, max-age=0, s-maxage=300');
  res.status(200).json({ v: 1, id, generatedAt: new Date().toISOString().slice(0, 10), stats, leads });
}
