// Short "TikTok" quiz, for filming: goal -> payout -> first sale -> contact -> done-for-you -> potential -> a site being built.
// Nothing real is created at the end. Reserved to two accounts; their e-mails are not written here, only their SHA-256.
import * as supa from './supa.mjs';
import * as sound from './sound.mjs';

const ALLOWED = new Set([
  '8ef74dcccefe8552742fa26186b28178bac5eced74c02735af0f1acba956ee41',
  'd5b5b994b4d7c58f9294de969d294ce5081b66fcfba0bcbc99be1a4ca0e93a17',
]);
const STEPS = ['goal', 'payout', 'first', 'contact', 'done4you', 'potential', 'build'];
const KICKER = { goal: 'Ton objectif', payout: 'Ton argent', first: 'Ton horloge', contact: 'Ta méthode', done4you: 'Tes sites', potential: 'Ton potentiel', build: 'Ton premier site' };
const SITE_PRICE = 400;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); } for (const c of kids) if (c != null) n.append(c); return n; };
const fr = (n) => Math.round(n).toLocaleString('fr-FR');
const buzz = (ms) => { try { if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(ms); } catch { /* no haptics */ } };
const raf = (fn) => requestAnimationFrame(fn);
let cur = 'goal', goal = 2000;

async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }

// ───────────────────────── steps ─────────────────────────
function show(name) {
  cur = name;
  const i = STEPS.indexOf(name);
  $('#quiz-bar').style.width = Math.round(((i + 1) / STEPS.length) * 100) + '%';
  $('#quiz-kicker').textContent = KICKER[name];
  $$('.quiz-step').forEach((s) => { s.hidden = s.dataset.step !== name; if (!s.hidden) { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; } });
  $('.quizcard').scrollTop = 0;
  if (name === 'potential') potential();
  if (name === 'build') build();
}
const next = () => show(STEPS[STEPS.indexOf(cur) + 1]);

function burst(btn, e) {
  const r = btn.getBoundingClientRect(), x = (e.clientX || r.left + r.width / 2) - r.left, y = (e.clientY || r.top + r.height / 2) - r.top;
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI * 2 * i) / 14 + Math.random() * .4, d = 34 + Math.random() * 40;
    const p = el('i', { class: 'spark', style: `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px` });
    btn.append(p); setTimeout(() => p.remove(), 650);
  }
}
for (const box of $$('.tt-opts')) box.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  sound.unlock(); sound.flip(); buzz(14); burst(b, e);
  $$('button', box).forEach((x) => x.classList.toggle('picked', x === b));
  setTimeout(next, 420);
});
for (const b of $$('[data-next]')) b.addEventListener('click', () => { sound.unlock(); next(); });

// ───────────────────────── goal gauge (drag anywhere on the track) ─────────────────────────
let lastStep = -1;
function drawGauge() {
  const r = $('#goal-gauge'), v = Number(r.value), pct = ((v - r.min) / (r.max - r.min)) * 100;
  $('#goal-val').textContent = fr(v) + ' €';
  $('#gauge-fill').style.width = pct + '%'; $('#gauge-thumb').style.left = pct + '%';
  $('.gauge').style.setProperty('--heat', String(pct / 100));
  const s = Math.floor(v / 500); if (s !== lastStep) { lastStep = s; sound.tick(); buzz(6); }
  goal = v;
}
{
  const track = $('#gauge-track'), range = $('#goal-gauge');
  const setX = (x) => { const rc = track.getBoundingClientRect(), k = Math.min(1, Math.max(0, (x - rc.left) / rc.width)); range.value = String(Math.round((+range.min + k * (range.max - range.min)) / 100) * 100); drawGauge(); };
  let drag = false;
  track.addEventListener('pointerdown', (e) => { e.preventDefault(); sound.unlock(); try { track.setPointerCapture(e.pointerId); } catch { /* synthetic */ } drag = true; track.classList.add('drag'); setX(e.clientX); });
  track.addEventListener('pointermove', (e) => { if (drag) setX(e.clientX); });
  const end = () => { drag = false; track.classList.remove('drag'); };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
  range.addEventListener('input', drawGauge);
}

// ───────────────────────── "on chiffre ton potentiel" ─────────────────────────
function potential() {
  const ring = $('#pot-ring'), pct = $('#pot-pct'), C = 2 * Math.PI * 52, res = $('#pot-res');
  ring.style.strokeDasharray = C; ring.style.strokeDashoffset = C; res.hidden = true; $('.tt-pot .an-ring').hidden = false;
  $('.tt-pot h2').textContent = 'On chiffre ton potentiel…';
  const t0 = performance.now(), dur = 3200;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 2);
    ring.style.strokeDashoffset = C * (1 - e); pct.textContent = Math.round(e * 100) + ' %';
    if (Math.random() < .25) sound.tick();
    if (k < 1) return raf(tick);
    const low = Math.round((goal * 0.87) / 100) * 100, high = Math.round((goal * 1.13) / 100) * 100, sites = Math.max(1, Math.ceil(goal / SITE_PRICE));
    $('.tt-pot .an-ring').hidden = true; $('.tt-pot h2').textContent = 'Ton potentiel est prêt.';
    $('#pot-range').textContent = `${fr(low)} € à ${fr(high)} €`;
    $('#pot-tiles').replaceChildren(...[[fr(sites), 'sites à vendre'], [`${fr(SITE_PRICE)} €`, 'par site'], [`${fr(goal)} €`, 'ton objectif']].map(([b, t]) => el('div', {}, el('b', { text: b }), el('span', { text: t }))));
    res.hidden = false; sound.landed(); buzz([12, 40, 20]); coins(18);
  };
  raf(tick);
}
function coins(n) {
  const box = $('.tt-pot .quiz-coins'); box.replaceChildren();
  for (let i = 0; i < n; i++) { const c = document.createElement('i'); c.style.left = (4 + Math.random() * 92) + '%'; c.style.animationDelay = (Math.random() * .9) + 's'; c.style.width = c.style.height = (12 + Math.random() * 12) + 'px'; box.append(c); }
}

// ───────────────────────── a site being built (abstract blocks only) ─────────────────────────
const BUILD = ['Analyse du commerce', 'Choix des couleurs', 'Mise en page', 'Textes et horaires', 'Photos', 'Bouton d’appel', 'Mise en ligne'];
function build() {
  const list = $('#build-steps'), pct = $('#build-pct'), canvas = $('.tt-canvas');
  $('#build-h').textContent = 'Création du site en cours…'; $('#build-again').hidden = true;
  list.replaceChildren(...BUILD.map((t) => el('li', {}, el('i'), el('span', { text: t }))));
  canvas.classList.remove('done'); $$('.tt-blk', canvas).forEach((b) => b.classList.remove('on'));
  const blocks = $$('.tt-blk', canvas), url = $('#build-url'), letters = 'www.ton-premier-client.fr';
  const t0 = performance.now(), dur = 9000;
  let shown = -1, bshown = -1;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    pct.textContent = Math.round(e * 100) + ' %';
    url.textContent = letters.slice(0, Math.max(4, Math.round(letters.length * Math.min(1, e * 1.4)))) + (e < .7 ? '▍' : '');
    const n = Math.min(BUILD.length - 1, Math.floor(e * BUILD.length * 0.999));
    while (shown < n) { shown++; list.children[shown].classList.add('on'); sound.tick(); buzz(8); }
    const bn = Math.min(blocks.length - 1, Math.floor(e * blocks.length * 1.05));
    while (bshown < bn) { bshown++; blocks[bshown].classList.add('on'); }
    if (k < 1) return raf(tick);
    list.children[BUILD.length - 1].classList.add('on'); canvas.classList.add('done');
    $('#build-h').textContent = 'Ton site est prêt ✓'; sound.built(); buzz([12, 40, 20]);
    $('#build-again').hidden = false;
  };
  raf(tick);
}
$('#build-again').addEventListener('click', () => { $$('.picked').forEach((b) => b.classList.remove('picked')); show('goal'); });

// ───────────────────────── access ─────────────────────────
async function gate(user) {
  const ok = !!user?.email && ALLOWED.has(await sha(user.email.trim().toLowerCase()));
  $('#quiz').hidden = !ok; $('#tt-login').hidden = ok;
  if (user && !ok) $('#tt-login-msg').textContent = 'Ce compte n’a pas accès à cette page.';
  if (ok) { drawGauge(); show('goal'); }
}
$('#tt-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, { error } = await supa.signIn(f.email.value.trim(), f.password.value);
  f.password.value = '';
  if (error) $('#tt-login-msg').textContent = error;
});
const localPreview = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('preview'); // local tests only
if (localPreview) { $('#quiz').hidden = false; drawGauge(); show('goal'); }
else if (supa.enabled) supa.onAuth(({ user }) => gate(user)); else $('#tt-login-msg').textContent = 'Les comptes ne sont pas activés.';
