// The payload comes from the URL hash = attacker-controlled. Everything goes through here first.
// Rule of the house: payload strings only ever reach the DOM through textContent / setAttribute on
// vetted attributes (see dom.mjs). Nothing in js/demo uses innerHTML.
// Pure functions, no DOM: also runs in Node (safe.test.mjs).

// control chars, zero-width, bidi overrides/isolates, line/paragraph separators, BOM
function isInvisible(cp) {
  return cp <= 0x1F || (cp >= 0x7F && cp <= 0x9F) || (cp >= 0x200B && cp <= 0x200F)
    || (cp >= 0x2028 && cp <= 0x202F) || (cp >= 0x2060 && cp <= 0x206F) || cp === 0xFEFF;
}

/** Any value -> trimmed single-line string, invisible/bidi characters removed, hard length cap. */
export function cleanText(v, max = 120) {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return '';
  const s = Array.from(v.normalize('NFC'), (ch) => (isInvisible(ch.codePointAt(0)) ? ' ' : ch)).join('').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, max).join('').trim();
}

/** First name for the ribbon: letters, spaces, hyphen, apostrophe only. */
export function cleanFirstName(v) {
  const s = cleanText(v, 24);
  return /^[\p{L}][\p{L} '’-]*$/u.test(s) ? s : '';
}

/** -> { display, href } or null. href is always "tel:" + [+]digits. */
export function cleanPhone(v) {
  const raw = cleanText(v, 40).split(/[;,/]/)[0].trim();
  if (!raw || /[^\d+().\s-]/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  const plus = raw.trim().startsWith('+');
  if (digits.length < 6 || digits.length > 15) return null;
  let intl;
  if (plus) intl = '+' + digits;
  else if (digits.startsWith('00')) intl = '+' + digits.slice(2);
  else if (/^0\d{9}$/.test(digits)) intl = '+33' + digits.slice(1);
  else intl = digits;
  let display = raw;
  const fr = intl.startsWith('+33') && intl.length === 12 ? '0' + intl.slice(3) : null;
  if (fr) display = fr.replace(/(\d{2})(?=\d)/g, '$1 ');
  return { display, href: 'tel:' + intl };
}

const EMAIL = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;

/** -> { display, href } or null. No "%", "?", "&" can get through: no mailto header injection. */
export function cleanEmail(v) {
  const s = cleanText(v, 100).split(/[;,\s]/)[0];
  if (!s || s.includes('..') || !EMAIL.test(s)) return null;
  return { display: s.toLowerCase(), href: 'mailto:' + s.toLowerCase() };
}

/** Only https links whose host is `domain` or one of its subdomains. -> { href, label } or null. */
export function cleanSocial(v, kind) {
  const domain = kind === 'ig' ? 'instagram.com' : kind === 'fb' ? 'facebook.com' : null;
  const s = cleanText(v, 300);
  if (!domain || !s) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;   // http is rebuilt as https below
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (host !== domain && !host.endsWith('.' + domain)) return null;
  const href = 'https://' + host + u.pathname + u.search;
  let first = '';
  try { first = decodeURIComponent(u.pathname.split('/').filter(Boolean)[0] || ''); } catch { first = ''; }
  let label = kind === 'ig' ? 'Instagram' : 'Facebook';
  if (kind === 'ig' && /^[\w.]{2,30}$/.test(first) && !['p', 'explore', 'reel', 'stories'].includes(first)) label = '@' + first;
  return { href, label, network: kind === 'ig' ? 'Instagram' : 'Facebook' };
}

/** -> { lat, lon } or null. */
export function cleanCoords(la, lo) {
  const lat = typeof la === 'string' && la.trim() !== '' ? Number(la) : la;
  const lon = typeof lo === 'string' && lo.trim() !== '' ? Number(lo) : lo;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  return { lat, lon };
}

const DOMAIN = /^(?=.{4,63}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,12}$/;

export function cleanDomain(v) {
  const s = cleanText(v, 80).toLowerCase();
  return DOMAIN.test(s) ? s : '';
}

/** Links our own code is allowed to put in an href. Second line of defence, used by dom.mjs. */
export function isSafeHref(href) {
  return typeof href === 'string' && /^(?:https:\/\/[^\s]+|tel:\+?\d{6,15}|mailto:[^\s?&%]+|#[\w-]*)$/i.test(href);
}
