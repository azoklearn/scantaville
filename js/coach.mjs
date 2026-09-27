// Keeps "Mon plan" in sync between localStorage and the `coach` row of the signed-in user.
// Merge rules: journal = union by id (deleted ids remembered), contacts per day = the higher count, roadmap = union, plan = the newer one.
import * as store from './store.mjs';
import * as supa from './supa.mjs';

const localDoc = () => ({ plan: store.getMyPlan(), journal: store.getJournal(), daylog: store.getDayLog(), roadmap: store.getRoadmap() });

function merge(a, b) {
  const gone = new Set([...(a.journal || []), ...(b.journal || [])].filter((e) => e.deleted).map((e) => e.id));
  const byId = new Map();
  for (const e of [...(a.journal || []), ...(b.journal || [])]) if (e?.id) byId.set(e.id, gone.has(e.id) ? { id: e.id, deleted: true, ts: e.ts } : e);
  const daylog = { ...(a.daylog || {}) };
  for (const [d, n] of Object.entries(b.daylog || {})) daylog[d] = Math.max(daylog[d] || 0, Number(n) || 0);
  const plan = (a.plan?.ts || 0) >= (b.plan?.ts || 0) ? a.plan : b.plan;
  return { plan: plan || null, journal: [...byId.values()].sort((x, y) => x.ts - y.ts), daylog, roadmap: { ...(b.roadmap || {}), ...(a.roadmap || {}) } };
}

function save(doc) {
  if (doc.plan) localStorage.setItem('scantaville.myplan', JSON.stringify(doc.plan)); // keeps its ts
  store.setJournal(doc.journal); store.setDayLog(doc.daylog); store.setRoadmap(doc.roadmap);
}

/** pull, merge, save locally, push back. Returns true when the account copy was reached. */
export async function syncCoach() {
  try {
    const remote = await supa.pullCoach();
    if (!remote) return false;
    const doc = merge(localDoc(), remote);
    save(doc);
    await supa.pushCoach(doc);
    return true;
  } catch { return false; }
}

let t = 0;
/** after a local change: push a bit later (several quick taps = one write) */
export function pushSoon() { clearTimeout(t); t = setTimeout(() => supa.pushCoach(localDoc()).catch(() => {}), 1200); }
