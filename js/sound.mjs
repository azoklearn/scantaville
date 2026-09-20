// Tiny synthesized sounds (no audio files): coin ticks while pins pop, a chord when the scan lands.
let ctx = null, enabled = true, lastTick = 0, streak = 0;

export function setSound(on) { enabled = on; }
export function unlock() {
  if (ctx || !enabled) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
}

function blip(freq, dur, gain, type = 'sine', when = 0) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur * .6);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .005);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + .02);
}

/** called on every counter change; rate-limited, pitch climbs with the streak */
export function tick() {
  const now = performance.now();
  if (now - lastTick < 38) return;
  streak = now - lastTick < 400 ? Math.min(streak + 1, 60) : 0;
  lastTick = now;
  blip(880 + streak * 14, .07, .035, 'triangle');
}

export function landed() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, .5, .05, 'sine', i * .07)); }
export function flip() { blip(320, .12, .05, 'triangle'); blip(1320, .25, .04, 'sine', .09); }
export function built() { [783.99, 987.77, 1318.5].forEach((f, i) => blip(f, .35, .045, 'sine', i * .06)); }
