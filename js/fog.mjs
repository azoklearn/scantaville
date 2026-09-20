// White mist + blue pins, drawn on two canvases stacked above the MapLibre map.
// The fog is geographic: the revealed hole is a circle in metres around the city centre,
// re-projected every frame, so panning / zooming keeps the rest of the world in the dark.

const BLUE = '29,91,255';
const TIER_COLOR = {
  gold:    { glow: `rgba(${BLUE},` },
  social:  { glow: `rgba(${BLUE},` },
  pending: { glow: `rgba(${BLUE},` },
  silver:  { glow: 'rgba(120,134,160,' },
};

const easeOutQuad = (x) => 1 - (1 - x) * (1 - x);
const easeOutQuadInv = (y) => 1 - Math.sqrt(Math.max(0, 1 - y));
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function metersBetween(lat1, lon1, lat2, lon2) {
  const k = Math.PI / 180, dLat = (lat2 - lat1) * k, dLon = (lon2 - lon1) * k;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * k) * Math.cos(lat2 * k) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(a));
}

function makeSprite(tier) {
  // halo only; the crisp core is drawn as a vector dot so dense centres stay readable instead of blooming to white
  const c = TIER_COLOR[tier], s = 96, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d'), r = s / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, c.glow + '.34)'); grad.addColorStop(.35, c.glow + '.1)'); grad.addColorStop(1, c.glow + '0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  return cv;
}

function makeFogTexture() {
  // cheap tileable cloud noise: a few octaves of wrapped value noise
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'), img = g.createImageData(S, S);
  const rnd = (() => { let a = 1337; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const octaves = [8, 16, 32].map((n) => ({ n, v: Array.from({ length: n * n }, rnd) }));
  const sample = (o, x, y) => {
    const fx = (x / S) * o.n, fy = (y / S) * o.n, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const at = (i, j) => o.v[((j + o.n) % o.n) * o.n + ((i + o.n) % o.n)];
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = sample(octaves[0], x, y) * .55 + sample(octaves[1], x, y) * .3 + sample(octaves[2], x, y) * .15;
    const i = (y * S + x) * 4;
    img.data[i] = 170; img.data[i + 1] = 194; img.data[i + 2] = 240; img.data[i + 3] = Math.round(clamp01((n - .4) * 2.2) * 105);
  }
  g.putImageData(img, 0, 0);
  return cv;
}

export class FogLayer {
  constructor(map, fogCanvas, pinCanvas) {
    this.map = map; this.fogCv = fogCanvas; this.pinCv = pinCanvas;
    this.fog = fogCanvas.getContext('2d'); this.pin = pinCanvas.getContext('2d');
    this.sprites = { gold: makeSprite('gold'), social: makeSprite('social'), pending: makeSprite('pending'), silver: makeSprite('silver') };
    this.texture = makeFogTexture();
    this.leads = []; this.filter = () => true; this.selected = null; this.glints = [];
    this.center = null; this.radiusM = 0; this.reveal = null; this.revealed = 0; // revealed: 0..1
    this.onCount = null; this.lastCount = -1; this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._raf = 0; this._t0 = performance.now(); this._screen = [];
    this._resize = this._resize.bind(this); this._frame = this._frame.bind(this);
    addEventListener('resize', this._resize); this._resize();
    this._raf = requestAnimationFrame(this._frame);
  }

  _resize() {
    const w = innerWidth, h = innerHeight;
    this.w = w; this.h = h;
    this.fogDpr = Math.min(devicePixelRatio || 1, 1.25); this.pinDpr = Math.min(devicePixelRatio || 1, 2);
    this.fogCv.width = Math.round(w * this.fogDpr); this.fogCv.height = Math.round(h * this.fogDpr);
    this.pinCv.width = Math.round(w * this.pinDpr); this.pinCv.height = Math.round(h * this.pinDpr);
    // resizing a canvas wipes it: repaint now, or the bare map flashes through until the next frame
    if (this.texture) this._render(performance.now());
  }

  /** faint gold glints seen through the fog on the landing map (pre-scanned cities) */
  setGlints(points) { this.glints = points || []; }

  setCity(center, leads) {
    this.center = center; // [lon, lat]
    let max = 1500;
    for (const l of leads) {
      l._d = metersBetween(center[1], center[0], l.lat, l.lon);
      if (l._d > max) max = l._d;
    }
    // trim absurd outliers (a mis-tagged POI 30 km away must not blow the radius up)
    const sorted = leads.map((l) => l._d).sort((a, b) => a - b);
    const p98 = sorted[Math.floor(sorted.length * .98)] || max;
    this.maxD = Math.max(1500, Math.min(max, p98 * 1.25));
    this.radiusM = this.maxD * 1.45; // the fully clear zone is ~70 % of the hole radius
    this.leads = leads; this.revealed = 0; this.reveal = null; this.lastCount = -1; this.selected = null;
    for (const l of leads) l._at = null;
  }

  reset() { this.leads = []; this.center = null; this.revealed = 0; this.reveal = null; this.selected = null; this.lastCount = -1; }

  startReveal({ duration = 3400, onCount, onDone } = {}) {
    if (this.reduced) duration = 600;
    const now = performance.now();
    this.reveal = { start: now, duration, onDone, done: false };
    this.onCount = onCount;
    // a pin pops at the moment the clear edge of the ring reaches it
    for (const l of this.leads) l._at = now + this._timeForRadius(l._d, duration);
  }

  _timeForRadius(d, duration) {
    // ring radius r(t) = radiusM * easeOutQuad(t); the clear edge sits at ~0.72 r
    const y = clamp01(d / (this.radiusM * .72));
    return easeOutQuadInv(y) * duration;
  }

  setFilter(fn) { this.filter = fn || (() => true); this.lastCount = -1; }
  setSelected(id) { this.selected = id; }

  /** nearest visible pin to a screen point */
  pick(point, tol = 18) {
    let best = null, bd = tol * tol;
    for (const s of this._screen) {
      const dx = s.x - point.x, dy = s.y - point.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = s.lead; }
    }
    return best;
  }

  _radiusPx(cx, cy) {
    const lat2 = this.center[1] + (this.radiusM * this.revealed) / 111320;
    const p = this.map.project([this.center[0], lat2]);
    return Math.hypot(p.x - cx, p.y - cy);
  }

  _frame(now) {
    this._raf = requestAnimationFrame(this._frame);
    if (document.hidden) return;
    this._render(now);
  }

  _render(now) {
    const t = (now - this._t0) / 1000;
    let ringAlpha = 0;
    if (this.reveal && !this.reveal.done) {
      const x = clamp01((now - this.reveal.start) / this.reveal.duration);
      this.revealed = easeOutQuad(x);
      ringAlpha = 1 - x * x * x;
      if (x >= 1) { this.reveal.done = true; this.revealed = 1; this.reveal.onDone?.(); }
    }
    this._drawFog(t, ringAlpha);
    this._drawPins(now, t);
  }

  _drawFog(t, ringAlpha) {
    const g = this.fog, d = this.fogDpr, w = this.w, h = this.h;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(0, 0, w, h);

    // drifting cloud texture, two layers at different speeds
    const S = 256 * 2.4;
    for (const [sp, al, ph] of [[7, .9, 0], [-4, .6, 140]]) {
      const ox = ((t * sp + ph) % S + S) % S, oy = ((t * sp * .4 + ph) % S + S) % S;
      g.globalAlpha = al;
      for (let x = -ox; x < w; x += S) for (let y = -oy; y < h; y += S) g.drawImage(this.texture, x, y, S, S);
    }
    g.globalAlpha = 1;

    // glints through the fog (landing)
    if (this.glints.length && !this.center) {
      for (let i = 0; i < this.glints.length; i++) {
        const p = this.map.project(this.glints[i].center);
        if (p.x < -40 || p.y < -40 || p.x > w + 40 || p.y > h + 40) continue;
        const pulse = .6 + .4 * Math.sin(t * 1.4 + i * 1.7), r = 9 + this.glints[i].weight * 20;
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, `rgba(${BLUE},${.55 * pulse})`); gr.addColorStop(.35, `rgba(${BLUE},${.18 * pulse})`); gr.addColorStop(1, `rgba(${BLUE},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      }
    }

    if (!this.center || this.revealed <= 0) return;
    const c = this.map.project(this.center), cx = c.x, cy = c.y, R = Math.max(2, this._radiusPx(cx, cy));

    // burn the hole
    g.globalCompositeOperation = 'destination-out';
    let gr = g.createRadialGradient(cx, cy, R * .66, cx, cy, R);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.55, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    // ragged, living edge
    const N = 26;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, wob = Math.sin(t * .7 + k * 2.1) * .5 + Math.sin(t * .31 + k * .77) * .5;
      const rr = R * (.8 + .07 * wob), br = R * (.16 + .05 * Math.sin(k * 3.3 + t * .4));
      const bx = cx + Math.cos(a) * rr, by = cy + Math.sin(a) * rr;
      gr = g.createRadialGradient(bx, by, 0, bx, by, br);
      gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
    }

    // blue scan band while the mist lifts, then a faint resting halo
    g.globalCompositeOperation = 'source-over';
    const a = Math.max(ringAlpha, .16);
    gr = g.createRadialGradient(cx, cy, R * .72, cx, cy, R * 1.02);
    gr.addColorStop(0, `rgba(${BLUE},0)`);
    gr.addColorStop(.5, `rgba(${BLUE},${.2 * a})`);
    gr.addColorStop(.68, `rgba(106,165,255,${.6 * a})`);
    gr.addColorStop(.78, `rgba(${BLUE},${.34 * a})`);
    gr.addColorStop(1, `rgba(${BLUE},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 1.02, 0, Math.PI * 2); g.fill();
  }

  _drawPins(now, t) {
    const g = this.pin, d = this.pinDpr, w = this.w, h = this.h;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, w, h);
    this._screen.length = 0;
    if (!this.center || !this.leads.length) return;

    const zoom = this.map.getZoom(), base = Math.max(.55, Math.min(1.25, (zoom - 9) / 5));
    let count = 0, selectedScreen = null;
    const drawn = [];
    for (const l of this.leads) {
      if (l._at == null || now < l._at) continue;
      if (l.tier !== 'silver' && !l._hidden) count += this.filter(l) ? 1 : 0;
      if (!this.filter(l) || l._hidden) continue;
      const p = this.map.project([l.lon, l.lat]);
      if (p.x < -30 || p.y < -30 || p.x > w + 30 || p.y > h + 30) continue;
      const age = (now - l._at) / 480;
      const pop = age < 1 ? Math.max(0, easeOutBack(clamp01(age))) : 1;
      const tw = 1 + .1 * Math.sin(t * 2.2 + l.lat * 9000);
      const s = 40 * base * pop * tw;
      g.globalAlpha = (age < 1.4 ? 1 : .6) * (l._locked ? .45 : 1); // newborn pins flash, then settle; locked ones stay faint
      g.drawImage(l.tier === 'silver' ? this.sprites.silver : this.sprites.gold, p.x - s / 2, p.y - s / 2, s, s);
      if (age < 1.6) { // shockwave on birth
        const k = clamp01(age / 1.6);
        g.globalAlpha = (1 - k) * .75; g.strokeStyle = '#1d5bff'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(p.x, p.y, 4 + k * 26 * base, 0, Math.PI * 2); g.stroke();
      }
      drawn.push(p.x, p.y, pop, l.tier === 'social' ? 1 : 0, l._locked ? 1 : 0);
      this._screen.push({ x: p.x, y: p.y, lead: l });
      if (l.id === this.selected) selectedScreen = p;
    }
    // crisp cores on top
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const cr = Math.max(2.4, 4.2 * base);
    for (let i = 0; i < drawn.length; i += 5) {
      const x = drawn[i], y = drawn[i + 1], r = cr * drawn[i + 2] * (drawn[i + 4] ? .8 : 1), rose = drawn[i + 3];
      if (r <= 0) continue;
      g.globalAlpha = drawn[i + 4] ? .38 : 1; // the plan has not unlocked this shop
      // solid blue dot = no website at all; hollow blue ring = Instagram / Facebook only
      g.beginPath(); g.arc(x, y + 1, r + 2.2, 0, Math.PI * 2); g.fillStyle = 'rgba(11,27,63,.16)'; g.fill();
      g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.fillStyle = rose ? '#1d5bff' : '#ffffff'; g.fill();
      g.beginPath(); g.arc(x, y, Math.max(0, rose ? r - .4 : r), 0, Math.PI * 2); g.fillStyle = rose ? '#ffffff' : '#1d5bff'; g.fill();
    }

    g.globalAlpha = 1;
    if (selectedScreen) {
      const k = (t * .9) % 1;
      g.strokeStyle = '#0b1b3f'; g.lineWidth = 2.2; g.globalAlpha = .95;
      g.beginPath(); g.arc(selectedScreen.x, selectedScreen.y, 13, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1 - k; g.lineWidth = 1.5;
      g.beginPath(); g.arc(selectedScreen.x, selectedScreen.y, 13 + k * 22, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    }

    if (count !== this.lastCount) { this.lastCount = count; this.onCount?.(count); }
  }

  destroy() { cancelAnimationFrame(this._raf); removeEventListener('resize', this._resize); }
}
