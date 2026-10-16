// scan-city: scans a city that is not in the database yet, ONCE, and stores its shops in `leads`.
// After that, the city is served like the pre-scanned ones by city_leads() (fast, and locked by plan on the server).
//
// Deploy: supabase functions deploy scan-city --no-verify-jwt
// Call:   POST https://<project>.supabase.co/functions/v1/scan-city?id=<INSEE | osm-relationId>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildOverpassQuery, elementsToLeads } from '../../../js/core/leads.mjs';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const HEADERS = {
  'content-type': 'application/x-www-form-urlencoded',
  'user-agent': 'ScanTaVille/1.0 (+https://www.scantaville.fr; movento.dev@gmail.com)',
  referer: 'https://www.scantaville.fr/',
};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

/** Same round-robin across trades as scripts/push-to-supabase.mjs: every trade keeps something unlocked. */
function unlockOrder(leads: any[]) {
  const byTrade = new Map<string, any[]>();
  for (const l of leads) { if (!byTrade.has(l.trade)) byTrade.set(l.trade, []); byTrade.get(l.trade)!.push(l); }
  const queues = [...byTrade.values()].sort((a, b) => b.length - a.length), order: any[] = [];
  for (let i = 0; order.length < leads.length; i++) { let took = false; for (const q of queues) if (q[i]) { order.push(q[i]); took = true; } if (!took) break; }
  return order;
}

async function overpass(query: string, deadline: number) {
  const body = 'data=' + encodeURIComponent(query);
  let last = 'no answer';
  for (let round = 0; round < 2; round++) {
    for (const url of SERVERS) {
      const left = deadline - Date.now();
      if (left < 10000) return { error: last };
      try {
        const r = await fetch(url, { method: 'POST', body, headers: HEADERS, signal: AbortSignal.timeout(Math.min(left - 3000, 90000)) });
        if (!r.ok) { last = `${new URL(url).host} HTTP ${r.status}`; continue; }
        const j = await r.json();
        if (Array.isArray(j.elements) && j.elements.length) return { json: j };
        last = `${new URL(url).host} ${j.remark || 'empty'}`;
      } catch (e) { last = `${new URL(url).host} ${(e as Error).name}`; }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { error: last };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^(\d[0-9AB]\d{3}|osm-\d{1,12})$/.test(id)) return json({ error: 'bad id' }, 400);

  // already scanned (by the build script or an earlier call): nothing to do
  const { count } = await admin.from('leads').select('id', { count: 'exact', head: true }).eq('city_insee', id);
  if (count) return json({ ok: true, cached: true, count });

  const { json: data, error } = await overpass(buildOverpassQuery(id), Date.now() + 140000);
  if (!data) { console.warn('scan-city', id, error); return json({ error }, 503); }

  const { leads } = elementsToLeads(data.elements);
  if (!leads.length) return json({ ok: true, count: 0 });
  // live leads have no domain check yet: "pending" counts as a shop without a site, like in the app
  const norm = leads.map((l: any) => ({ ...l, tier: l.tier === 'pending' ? 'gold' : l.tier }));
  const rows = unlockOrder(norm).map((l: any, i: number) => ({
    id: l.id, city_insee: id, name: l.name, trade: l.trade, tier: l.tier, lat: l.lat, lon: l.lon,
    addr: l.addr, phone: l.phone, hours: l.hours, email: l.email, social: l.social || {}, cuisine: l.cuisine,
    siret: l.siret, domain: l.domain, unlock_rank: i,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await admin.from('leads').upsert(rows.slice(i, i + 500), { onConflict: 'city_insee,id', ignoreDuplicates: true });
    if (e) { console.error('scan-city insert', id, e); return json({ error: 'db' }, 500); }
  }
  console.log('scan-city', id, rows.length, 'shops');
  return json({ ok: true, count: rows.length });
});
