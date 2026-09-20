// Demo-site payload <-> URL hash. The MVP keeps the whole demo in the URL (no database).
// Production swaps this for a short link (/d/abc123) served by one Worker + KV, which also gives open tracking.
//
// Payload keys (short on purpose, the URL gets pasted in DMs):
//   n name · t trade key · c city · a address · p phone · h OSM opening_hours · la/lo lat/lon
//   ig/fb social urls · e email · cu cuisine · by author first name · d suggested free domain

export function encodePayload(obj) {
  const clean = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined && v !== '') clean[k] = v;
  const bytes = new TextEncoder().encode(JSON.stringify(clean));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePayload(str) {
  try {
    const b64 = str.replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return obj && typeof obj === 'object' ? obj : null;
  } catch { return null; }
}

export function leadToPayload(lead, city, author) {
  return {
    n: lead.name, t: lead.trade, c: city, a: lead.addr, p: lead.phone, h: lead.hours,
    la: lead.lat, lo: lead.lon, ig: lead.social?.instagram, fb: lead.social?.facebook,
    e: lead.email, cu: lead.cuisine, by: author || null, d: lead.domain,
  };
}
