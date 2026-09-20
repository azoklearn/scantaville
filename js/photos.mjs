// Street-level photo of a shop, from Panoramax: the open, community street imagery backed by IGN and OpenStreetMap France.
// Free, no key, CORS-open, licence CC-BY-SA (attribution shown under the photo). We never scrape Google photos.
// The photo is the view FROM THE STREET nearest to the shop: usually its front, never guaranteed. The caption says so.
const API = 'https://api.panoramax.xyz/api/search';
const cache = new Map();

const rad = (d) => (d * Math.PI) / 180;
function metres(aLat, aLon, bLat, bLon) { const x = rad(bLon - aLon) * Math.cos(rad((aLat + bLat) / 2)), y = rad(bLat - aLat); return Math.hypot(x, y) * 6371000; }
function bearing(aLat, aLon, bLat, bLon) {
  const y = Math.sin(rad(bLon - aLon)) * Math.cos(rad(bLat)), x = Math.cos(rad(aLat)) * Math.sin(rad(bLat)) - Math.sin(rad(aLat)) * Math.cos(rad(bLat)) * Math.cos(rad(bLon - aLon));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const turn = (a, b) => Math.abs(((a - b + 540) % 360) - 180); // smallest angle between two headings

/** @returns {Promise<null | { url, is360, offset, author, date, licence, link }>}  offset = where the shop sits in a 360 image, -0.5..0.5 */
export async function shopPhoto(lat, lon) {
  const key = lat.toFixed(5) + ',' + lon.toFixed(5);
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const d = 0.00045; // ~40 m around the shop
    try {
      const r = await fetch(`${API}?bbox=${lon - d},${lat - d},${lon + d},${lat + d}&limit=40`);
      if (!r.ok) return null;
      const feats = (await r.json()).features || [];
      let best = null;
      for (const f of feats) {
        const [plon, plat] = f.geometry?.coordinates || [], pr = f.properties || {}, url = f.assets?.sd?.href;
        if (plat == null || !url || !/^https:\/\//.test(url)) continue;
        const dist = metres(plat, plon, lat, lon);
        if (dist < 4 || dist > 45) continue; // too close = inside / wrong spot, too far = another street
        const is360 = pr['pers:interior_orientation']?.field_of_view === 360;
        const toShop = bearing(plat, plon, lat, lon), az = Number(pr['view:azimuth']);
        const facing = is360 || Number.isNaN(az) ? 0 : turn(az, toShop);
        if (!is360 && facing > 70) continue; // a flat photo looking away from the shop is useless
        const age = pr.datetime ? (Date.now() - Date.parse(pr.datetime)) / 3.15e10 : 5; // years
        const score = dist + facing * 0.4 + age * 3 - (is360 ? 6 : 0);
        if (!best || score < best.score) {
          best = { score, url, is360, offset: is360 && !Number.isNaN(az) ? (((toShop - az + 540) % 360) - 180) / 360 : 0,
            author: f.providers?.find((x) => x.roles?.includes('producer'))?.name || pr['geovisio:producer'] || 'contributeur Panoramax',
            date: pr.datetime ? pr.datetime.slice(0, 7) : '', licence: pr.license || 'CC-BY-SA-4.0',
            link: `https://api.panoramax.xyz/#focus=pic&pic=${encodeURIComponent(f.id)}` };
        }
      }
      return best;
    } catch { return null; }
  })();
  cache.set(key, p);
  return p;
}

/** Paints the photo in `box` (a block with a fixed aspect ratio). For a 360 image, turns the view towards the shop. */
export function paintPhoto(box, photo) {
  box.style.backgroundImage = `url("${photo.url.replace(/"/g, '%22')}")`;
  if (!photo.is360) { box.style.backgroundSize = 'cover'; box.style.backgroundPosition = 'center'; box.style.backgroundRepeat = 'no-repeat'; return; }
  const place = () => {
    const cw = box.clientWidth, ch = box.clientHeight; if (!cw || !ch) return;
    const imgH = ch * 2.1, imgW = imgH * 2; // equirectangular: zoom on the horizon band, repeat horizontally so any heading works
    box.style.backgroundRepeat = 'repeat-x';
    box.style.backgroundSize = `${imgW}px ${imgH}px`;
    box.style.backgroundPosition = `${Math.round(cw / 2 - (0.5 + photo.offset) * imgW)}px ${Math.round((ch - imgH) / 2 + ch * 0.06)}px`;
  };
  place(); requestAnimationFrame(place);
}
