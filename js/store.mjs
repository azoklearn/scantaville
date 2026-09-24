// Everything the MVP remembers lives in localStorage (no account, no backend).
import { FEATURES, planById, limitFor } from './plans.mjs';
import { enabled as serverAuth } from './supa.mjs';

const K = 'scantaville.';
const read = (k, d) => { try { const v = localStorage.getItem(K + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch { /* private mode */ } };

export const FREE_DEMOS_PER_DAY = 3;
export const PRICE = 490;
export const STATUSES = [
  { key: 'todo', label: 'À contacter' },
  { key: 'contacted', label: 'Contacté' },
  { key: 'meeting', label: 'RDV' },
  { key: 'won', label: 'Signé' },
  { key: 'lost', label: 'Non' },
];

const today = () => new Date().toISOString().slice(0, 10);

// The plan lives in localStorage for the prototype. In production it comes from the payment provider
// (Whop / Stripe webhook -> signed session): never trust the browser for this.
let serverPlan = null;
export const setServerPlan = (id) => { serverPlan = planById(id) ? id : null; };
const isLocalDev = () => typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const getPlanId = () => {
  // with accounts on, the plan comes from the `profiles` table; the browser copy only counts on localhost (?plan=...)
  if (serverAuth && !isLocalDev()) return serverPlan || 'free';
  const local = read('plan', 'free');
  if (serverAuth && serverPlan && !planById(local)) return serverPlan;
  return planById(local) ? local : serverPlan || 'free';
};
export const setPlanId = (id) => write('plan', planById(id) ? id : 'free');
export const planLevel = () => planById(getPlanId())?.level || 0;
export const can = (feature) => planLevel() >= (FEATURES[feature] || 1);
export const isPro = () => planLevel() >= 1;

export const getAuthor = () => read('author', '');
export const setAuthor = (v) => write('author', String(v || '').trim().slice(0, 24));

/** Demo quota: re-opening a shop you already built today is free. */
export function demoQuota() {
  const q = read('quota', { day: today(), ids: [] });
  if (planLevel() === 0) return q; // the free mock-up is a one-off: no daily reset
  return q.day === today() ? q : { day: today(), ids: [] };
}
export const demoLimit = () => limitFor('demosPerDay', planLevel());
export function canBuild(id) { const q = demoQuota(); return q.ids.includes(id) || q.ids.length < demoLimit(); }
export function countBuild(id) { const q = demoQuota(); if (!q.ids.includes(id)) q.ids.push(id); write('quota', q); return q; }
export function demosLeft() { const max = demoLimit(); return max === Infinity ? Infinity : Math.max(0, max - demoQuota().ids.length); }

export const getPipeline = () => read('pipeline', {});
/** server copy wins on the statuses it knows; local-only entries are kept */
export function mergePipeline(remote) { if (!remote) return; write('pipeline', { ...getPipeline(), ...remote }); }
export function setStatus(lead, city, status) {
  const p = getPipeline();
  if (!status) delete p[lead.id]; else p[lead.id] = { status, name: lead.name, city, ts: Date.now() };
  write('pipeline', p); return p;
}
export const wonCount = () => Object.values(getPipeline()).filter((x) => x.status === 'won').length;

/** "Il a déjà un site": hidden locally; production feeds this back into the shared dataset. */
export const getHidden = () => read('hidden', []);
export function hideLead(id) { const h = getHidden(); if (!h.includes(id)) h.push(id); write('hidden', h); }

// quotes and invoices: the seller block is remembered, numbers follow one series per type and year
export const getSeller = () => read('seller', {});
export const setSeller = (s) => write('seller', s || {});
export const peekDocSeq = (type, year) => (read('docseq', {})[type]?.[year] || 0) + 1;
export function bumpDocSeq(type, year, seq) { const c = read('docseq', {}); c[type] = c[type] || {}; c[type][year] = Math.max(c[type][year] || 0, seq); write('docseq', c); }
export const setCurrentDoc = (d) => write('doc.current', d); // read by doc.html (same origin), never put in a URL

export const getBuilt = () => read('built', {});
export function rememberBuilt(lead, city, insee) { const b = getBuilt(); b[lead.id] = { name: lead.name, city, insee, trade: lead.trade, ts: b[lead.id]?.ts || Date.now() }; write('built', b); }

export const getEdits = (id) => read('edits', {})[id] || null;
export function setEdits(id, o) { const all = read('edits', {}); if (o) all[id] = o; else delete all[id]; write('edits', all); }

export const getGoal = () => read('goal', 15);
export const setGoal = (n) => write('goal', n);
export const saveWaitlist = (email, plan) => write('waitlist', { email, plan, ts: Date.now() });

export function cacheCity(insee, data) { try { sessionStorage.setItem(K + 'city.' + insee, JSON.stringify(data)); } catch { /* too big: skip */ } }
export function cachedCity(insee) { try { const v = sessionStorage.getItem(K + 'city.' + insee); return v ? JSON.parse(v) : null; } catch { return null; } }
