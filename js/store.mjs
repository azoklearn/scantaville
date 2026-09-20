// Everything the MVP remembers lives in localStorage (no account, no backend).
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

export const isPro = () => read('pro', false) === true;
export const setPro = (v) => write('pro', !!v);

export const getAuthor = () => read('author', '');
export const setAuthor = (v) => write('author', String(v || '').trim().slice(0, 24));

/** Demo quota: re-opening a shop you already built today is free. */
export function demoQuota() {
  const q = read('quota', { day: today(), ids: [] });
  return q.day === today() ? q : { day: today(), ids: [] };
}
export function canBuild(id) { const q = demoQuota(); return isPro() || q.ids.includes(id) || q.ids.length < FREE_DEMOS_PER_DAY; }
export function countBuild(id) { const q = demoQuota(); if (!q.ids.includes(id)) q.ids.push(id); write('quota', q); return q; }
export function demosLeft() { return isPro() ? Infinity : Math.max(0, FREE_DEMOS_PER_DAY - demoQuota().ids.length); }

export const getPipeline = () => read('pipeline', {});
export function setStatus(lead, city, status) {
  const p = getPipeline();
  if (!status) delete p[lead.id]; else p[lead.id] = { status, name: lead.name, city, ts: Date.now() };
  write('pipeline', p); return p;
}
export const wonCount = () => Object.values(getPipeline()).filter((x) => x.status === 'won').length;

/** "Il a déjà un site": hidden locally; production feeds this back into the shared dataset. */
export const getHidden = () => read('hidden', []);
export function hideLead(id) { const h = getHidden(); if (!h.includes(id)) h.push(id); write('hidden', h); }

export const getGoal = () => read('goal', 15);
export const setGoal = (n) => write('goal', n);
export const saveWaitlist = (email) => write('waitlist', { email, ts: Date.now() });

export function cacheCity(insee, data) { try { sessionStorage.setItem(K + 'city.' + insee, JSON.stringify(data)); } catch { /* too big: skip */ } }
export function cachedCity(insee) { try { const v = sessionStorage.getItem(K + 'city.' + insee); return v ? JSON.parse(v) : null; } catch { return null; } }
