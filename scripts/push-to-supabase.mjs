// Uploads data/cities/*.json into the `leads` table of your Supabase project (run supabase/schema.sql first).
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/push-to-supabase.mjs [insee ...]
//
// The service_role key bypasses row-level security: keep it in your shell or in a CI secret, never in a file of this
// repository and never in the browser. Zero dependency: plain fetch against the project's REST endpoint.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(URL_) || KEY.length < 40) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}
const headers = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };

/** Same round-robin across trades as the app: every trade filter keeps something unlocked, whatever the plan. */
function unlockOrder(leads) {
  const byTrade = new Map();
  for (const l of leads) { if (!byTrade.has(l.trade)) byTrade.set(l.trade, []); byTrade.get(l.trade).push(l); }
  const queues = [...byTrade.values()].sort((a, b) => b.length - a.length);
  const order = [];
  for (let i = 0; order.length < leads.length; i++) { let took = false; for (const q of queues) if (q[i]) { order.push(q[i]); took = true; } if (!took) break; }
  return order;
}

async function pushCity(file) {
  const city = JSON.parse(await readFile(file, 'utf8'));
  const open = city.leads.filter((l) => l.tier !== 'silver'), silver = city.leads.filter((l) => l.tier === 'silver');
  const rows = [...unlockOrder(open), ...silver].map((l, i) => ({
    id: l.id, city_insee: city.insee, name: l.name, trade: l.trade, tier: l.tier, lat: l.lat, lon: l.lon,
    addr: l.addr, phone: l.phone, hours: l.hours, email: l.email, social: l.social || {}, cuisine: l.cuisine,
    siret: l.siret, domain: l.domain, unlock_rank: i,
  }));
  let r = await fetch(`${URL_}/rest/v1/leads?city_insee=eq.${encodeURIComponent(city.insee)}`, { method: 'DELETE', headers });
  if (!r.ok) throw new Error(`${city.name}: delete failed (${r.status}) ${await r.text()}`);
  for (let i = 0; i < rows.length; i += 500) {
    r = await fetch(`${URL_}/rest/v1/leads`, { method: 'POST', headers: { ...headers, prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) throw new Error(`${city.name}: insert failed (${r.status}) ${await r.text()}`);
  }
  console.log(`${city.name.padEnd(14)} ${String(open.length).padStart(4)} shops (+${silver.length} "à vérifier")`);
}

const dir = path.join(ROOT, 'data', 'cities');
const only = process.argv.slice(2);
const files = (await readdir(dir)).filter((f) => f.endsWith('.json') && (!only.length || only.includes(f.replace('.json', ''))));
for (const f of files) await pushCity(path.join(dir, f));
console.log(`Done: ${files.length} cities pushed to ${URL_}`);
