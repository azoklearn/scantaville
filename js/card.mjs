// 9:16 share card: the city's constellation, white on brand blue. Drawn client-side, exported as PNG.
import { BRAND } from './brand.mjs';

const W = 1080, H = 1920;
const DISPLAY = '"Archivo", "Helvetica Neue", Arial, sans-serif';
const MONO = '"Martian Mono", ui-monospace, monospace';
const BODY = '"Schibsted Grotesk", system-ui, sans-serif';

const fr = (n) => n.toLocaleString('fr-FR');

function fitText(g, text, font, maxW, maxSize, minSize = 60) {
  let size = maxSize;
  do { g.font = font(size); if (g.measureText(text).width <= maxW) break; size -= 6; } while (size > minSize);
  return size;
}

export async function drawCard(canvas, { city, leads, stats, rank }) {
  await Promise.all([
    document.fonts.load(`800 200px ${DISPLAY}`), document.fonts.load(`900 200px ${DISPLAY}`),
    document.fonts.load(`500 28px ${MONO}`), document.fonts.load(`600 40px ${BODY}`),
  ]).catch(() => {});
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = '0px';

  // brand blue, lighter towards the constellation
  let gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#2a66ff'); gr.addColorStop(.55, '#1d5bff'); gr.addColorStop(1, '#0f3fd0');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  gr = g.createRadialGradient(W / 2, 600, 40, W / 2, 600, 700);
  gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);

  // constellation inside the "lifted mist" disc
  const pts = leads.filter((l) => l.tier !== 'silver' && !l._hidden);
  const cx = W / 2, cy = 600, R = 360;
  g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(cx, cy, R * 1.06, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.setLineDash([3, 9]);
  g.beginPath(); g.arc(cx, cy, R * 1.06, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  if (pts.length) {
    const lat0 = pts.reduce((s, l) => s + l.lat, 0) / pts.length, lon0 = pts.reduce((s, l) => s + l.lon, 0) / pts.length;
    const k = Math.cos(lat0 * Math.PI / 180);
    const xy = pts.map((l) => ({ x: (l.lon - lon0) * k, y: -(l.lat - lat0), hollow: l.tier === 'social' }));
    const dists = xy.map((p) => Math.hypot(p.x, p.y)).sort((a, b) => a - b);
    const span = (dists[Math.floor(dists.length * .97)] || dists[dists.length - 1] || 1) * 1.08;
    g.save(); g.beginPath(); g.arc(cx, cy, R * 1.04, 0, Math.PI * 2); g.clip();
    for (const p of xy) {
      const x = cx + (p.x / span) * R, y = cy + (p.y / span) * R;
      const halo = g.createRadialGradient(x, y, 0, x, y, 20);
      halo.addColorStop(0, 'rgba(255,255,255,.34)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.fill();
      if (p.hollow) { g.strokeStyle = '#fff'; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.stroke(); }
      else { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 5.4, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
  }

  // header: pin + wordmark
  g.fillStyle = '#fff'; g.beginPath();
  g.moveTo(104, 96); g.bezierCurveTo(86, 96, 72, 110, 72, 128); g.bezierCurveTo(72, 152, 104, 178, 104, 178);
  g.bezierCurveTo(104, 178, 136, 152, 136, 128); g.bezierCurveTo(136, 110, 122, 96, 104, 96); g.fill();
  g.fillStyle = '#1d5bff'; g.beginPath(); g.arc(104, 127, 11, 0, Math.PI * 2); g.fill();
  g.font = `800 56px ${DISPLAY}`;
  let x = 160;
  BRAND.parts.forEach((part, i) => { g.fillStyle = i === BRAND.accent ? '#b9d0ff' : '#fff'; g.fillText(part, x, 156); x += g.measureText(part).width - 1; });
  g.font = `500 23px ${MONO}`; g.fillStyle = '#cfe0ff'; g.textAlign = 'right';
  g.fillText(new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase(), W - 72, 150);
  g.textAlign = 'left';

  // city + number
  const size = fitText(g, city, (s) => `800 ${s}px ${DISPLAY}`, W - 144, 170, 84);
  const nameY = 1105 + size * .5;
  g.fillStyle = '#fff'; g.fillText(city, 72, nameY);
  const numY = nameY + 250;
  g.font = `900 290px ${DISPLAY}`;
  const num = fr(stats.leads); g.fillText(num, 64, numY);
  const numW = g.measureText(num).width;
  g.font = `600 44px ${BODY}`;
  g.fillStyle = '#fff'; g.fillText('commerces', 64 + numW + 30, numY - 128);
  g.fillStyle = '#cfe0ff'; g.fillText('sans site web', 64 + numW + 30, numY - 74);
  g.fillText('référencé', 64 + numW + 30, numY - 20);

  // tiers + rank
  let y = numY + 72;
  g.font = `500 26px ${MONO}`;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(84, y - 9, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#eaf1ff'; g.fillText(`${fr(stats.gold)} AUCUN SITE DÉTECTÉ`, 108, y);
  y += 46;
  g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.beginPath(); g.arc(84, y - 9, 7.5, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#eaf1ff'; g.fillText(`${fr(stats.social)} INSTA / FACEBOOK SEULEMENT`, 108, y);
  if (rank?.rank) {
    y += 84;
    const label = `#${rank.rank} SUR ${rank.total} VILLES · ${String(rank.per10k).replace('.', ',')} POUR 10 000 HAB.`;
    g.font = `500 25px ${MONO}`; const tw = g.measureText(label).width;
    roundRect(g, 72, y - 42, tw + 44, 62, 12); g.fillStyle = '#0b1b3f'; g.fill();
    g.fillStyle = '#fff'; g.fillText(label, 94, y);
  }

  // footer: question + domain pill
  g.font = `800 52px ${DISPLAY}`; g.fillStyle = '#fff'; g.fillText('Et dans ta ville ?', 72, H - 128);
  g.font = `700 34px ${DISPLAY}`;
  const dom = BRAND.domain, dw = g.measureText(dom).width + 56;
  roundRect(g, W - 72 - dw, H - 176, dw, 68, 34); g.fillStyle = '#fff'; g.fill();
  g.fillStyle = '#1d5bff'; g.fillText(dom, W - 72 - dw + 28, H - 130);
  g.fillStyle = '#b9d0ff'; g.font = `400 20px ${MONO}`;
  g.fillText('Données © contributeurs OpenStreetMap · estimation à vérifier', 72, H - 66);
  return canvas;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function cardBlob(canvas) { return new Promise((res) => canvas.toBlob(res, 'image/png')); }
