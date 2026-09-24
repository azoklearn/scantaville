// The four demo-site families. Each one builds its own DOM (different structure, not just different colours):
//   salon   "Maison"   editorial, centred, arch + didone italics
//   table   "Carte"    dark, left-aligned, plate ornament + paper menu card with dotted leaders
//   fournil "Enseigne" shop-front: striped awning, painted-sign name, rotating stamp, product tags, door sign
//   atelier "Plaque"   utilitarian grid: giant condensed caps, spec sheet, marquee, timetable with bars
// Everything goes through h()/s() (textContent + vetted attributes). No innerHTML.
import { h, s, icon } from './dom.mjs';
import { formatRange } from './hours.mjs';
import { tradeIcon } from './trade-kit.mjs';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const pad2 = (n) => String(n).padStart(2, '0');

// ---- shared bricks -----------------------------------------------------------------------------

function callLink(m, cls, label = 'Appeler') {
  if (!m.phone) return null;
  return h('a', { class: cls, href: m.phone.href, 'aria-label': `Appeler ${m.name}` }, icon('phone'), h('span', { text: label }));
}

function routeLink(m, cls, label = 'Itinéraire') {
  if (!m.itinerary) return null;
  return h('a', { class: cls, href: m.itinerary }, icon('pin'), h('span', { text: label }));
}

function heroCtas(m, primary, secondary, discoverLabel) {
  const call = callLink(m, primary, m.kit.cta);
  const route = routeLink(m, call ? secondary : primary);
  const discover = !call || !route ? h('a', { class: call || route ? secondary : primary, href: '#carte' }, h('span', { text: discoverLabel }), icon('arrow')) : null;
  return h('div', { class: 'cta' }, call, route, discover);
}

function pill(m, extra = '') {
  if (!m.hours) return null;
  return h('p', { class: `pill ${extra}`.trim(), 'data-pill': true, 'data-open': 'unknown', role: 'status' },
    h('span', { class: 'pill-dot', 'aria-hidden': 'true' }),
    h('strong', { class: 'pill-label', text: '…' }), ' ',
    h('span', { class: 'pill-detail' }));
}

/** 7-day table, or the raw OSM string when we could not parse it, or null when there is nothing. */
function hoursBlock(m, { style = 'fr', bars = false } = {}) {
  if (!m.hours && !m.hoursRaw) return null;
  if (!m.hours) {
    return h('div', { class: 'hours hours--raw' },
      h('p', { class: 'hours-raw-label', text: 'Horaires indiqués' }),
      h('p', { class: 'hours-raw', text: m.hoursRaw }),
      h('p', { class: 'hours-note', text: 'À confirmer auprès du commerce.' }));
  }
  const AXIS_START = 6 * 60, AXIS_END = 24 * 60;
  const rows = m.hours.days.map((d, i) => {
    const times = d.closed
      ? h('span', { class: 'rg rg--off', text: 'Fermé' })
      : d.ranges.map((r) => h('span', { class: 'rg', text: formatRange(r, style) }));
    let track = null;
    if (bars) {
      track = h('span', { class: 'track', 'aria-hidden': 'true' }, d.ranges.map((r) => {
        const a = Math.max(r.start, AXIS_START), b = Math.min(r.end, AXIS_END);
        if (b <= a) return null;
        const left = ((a - AXIS_START) / (AXIS_END - AXIS_START)) * 100, width = ((b - a) / (AXIS_END - AXIS_START)) * 100;
        return h('span', { class: 'bar', vars: { '--l': left.toFixed(2) + '%', '--w': width.toFixed(2) + '%' } });
      }));
    }
    return h('tr', { 'data-day': i, class: d.closed ? 'is-closed' : null },
      h('th', { scope: 'row' }, h('span', { class: 'day-full', text: d.label }), h('span', { class: 'day-short', text: d.short, 'aria-hidden': 'true' })),
      h('td', null, h('span', { class: 'times' }, times), track));
  });
  return h('div', { class: 'hours' },
    pill(m),
    h('table', { class: 'hours-table' }, h('caption', { class: 'sr', text: 'Horaires d’ouverture' }), h('tbody', null, rows)),
    m.hours.holidays ? h('p', { class: 'hours-note', text: m.hours.holidays.text }) : null);
}

function addressBlock(m) {
  if (!m.addr) return null;
  return h('address', { class: 'addr' }, h('span', { class: 'addr-1', text: m.addr.line1 }), m.addr.line2 ? h('span', { class: 'addr-2', text: m.addr.line2 }) : null);
}

function mapBlock(m) {
  if (!m.coords) return null;
  return h('div', { class: 'map', 'data-map': true, 'data-lat': m.coords.lat, 'data-lon': m.coords.lon, role: 'img', 'aria-label': `Carte : emplacement de ${m.name}` },
    h('div', { class: 'map-canvas' }),
    h('div', { class: 'map-ph', 'aria-hidden': 'true' }, icon('pin')));
}

function contactItems(m) {
  return [
    m.phone && { k: 'phone', label: 'Téléphone', value: m.phone.display, href: m.phone.href },
    m.email && { k: 'mail', label: 'E-mail', value: m.email.display, href: m.email.href },
    m.ig && { k: 'instagram', label: 'Instagram', value: m.ig.label, href: m.ig.href },
    m.fb && { k: 'facebook', label: 'Facebook', value: m.fb.label === 'Facebook' ? 'Voir la page' : m.fb.label, href: m.fb.href },
  ].filter(Boolean);
}

function contactList(m, arrow = 'arrowUpRight') {
  const items = contactItems(m);
  if (!items.length) return null;
  return h('ul', { class: 'contact-list' }, items.map((it) => h('li', null,
    h('a', { class: `contact contact--${it.k}`, href: it.href },
      h('span', { class: 'contact-ico' }, icon(it.k)),
      h('span', { class: 'contact-txt' }, h('span', { class: 'contact-label', text: it.label }), h('span', { class: 'contact-value', text: it.value })),
      icon(arrow, 'ico contact-arrow')))));
}

/** The trade's pictogram in a round badge (hero). */
function tradeBadge(m, cls = 'trade-badge') {
  return h('span', { class: cls, 'aria-hidden': 'true' }, tradeIcon(m.kit.ico));
}

/** The one block only this trade has: booking, order, quote, project steps... Same DOM in every family, styled per family. */
function signature(m) {
  const k = m.kit.sig;
  const list = k.steps
    ? h('ol', { class: 'sig-steps' }, k.steps.map((t, i) => h('li', null, h('span', { class: 'sig-step-n', 'aria-hidden': 'true', text: pad2(i + 1) }), h('span', { text: t }))))
    : h('ul', { class: 'sig-points' }, k.points.map((t) => h('li', { text: t })));
  const action = callLink(m, 'btn btn--solid sig-btn', k.action) || routeLink(m, 'btn btn--solid sig-btn', 'Passer nous voir');
  return h('section', { class: 'sec sec--sig', id: 'plus' }, h('div', { class: 'wrap' },
    h('div', { class: 'sig' },
      h('div', { class: 'sig-ico', 'aria-hidden': 'true' }, tradeIcon(m.kit.ico)),
      h('div', { class: 'sig-body' },
        h('p', { class: 'sig-kicker', text: k.kicker }), h('h2', { class: 'sig-title', text: k.title }), h('p', { class: 'sig-text', text: k.text }),
        list, action, h('p', { class: 'sig-note', text: k.note })))));
}

function section(kind, id, head, ...body) {
  return h('section', { class: `sec sec--${kind}`, id }, h('div', { class: 'wrap' }, head, h('div', { class: 'sec-body' }, body)));
}

function footer(m, ...extra) {
  const place = [m.label, m.city].filter(Boolean).join(' · ');
  return h('footer', { class: 'ft' }, h('div', { class: 'wrap' },
    extra,
    h('p', { class: 'ft-name', text: m.name }),
    place ? h('p', { class: 'ft-place', text: place }) : null,
    m.domain ? h('p', { class: 'ft-domain' }, h('span', { class: 'ft-domain-k', text: 'Bientôt sur ' }), h('span', { class: 'ft-domain-v', text: m.domain })) : null,
    m.badge && !m.live ? h('p', { class: 'ft-made', text: 'Maquette générée avec ScanTaVille · scantaville.fr' }) : null,
    m.live ? h('p', { class: 'ft-legal', text: `Mentions légales : éditeur ${m.name}${m.addr ? ', ' + m.addr.full : ''}${m.phone ? ', ' + m.phone.display : ''}. Hébergement : Vercel Inc., 340 Pine Street, San Francisco, CA 94104, USA.${m.by ? ` Site réalisé par ${m.by}.` : ''}` }) :
    h('p', { class: 'ft-legal', text: `Maquette de démonstration non officielle${m.by ? `, proposée par ${m.by}` : ''}. Ce site n’est pas en ligne. Informations issues de données ouvertes (© les contributeurs d’OpenStreetMap), à vérifier par le commerce.` })));
}

function brand(m) {
  return h('a', { class: 'hd-brand', href: '#top', 'aria-label': m.name },
    h('span', { class: 'hd-mono', 'aria-hidden': 'true', text: m.mono }), h('span', { class: 'hd-name', text: m.name }));
}

function nameHeading(m, i) {
  return h('h1', { class: 'name reveal', vars: { '--i': i, '--longest': m.longest, '--len-scale': m.lenScale } }, m.name);
}

const SPARK = 'M12 0C12.8 7.5 16.5 11.2 24 12 16.5 12.8 12.8 16.5 12 24 11.2 16.5 7.5 12.8 0 12 7.5 11.2 11.2 7.5 12 0Z';
function spark(cls) { return s('svg', { class: cls, viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: SPARK, fill: 'currentColor' })); }

// ---- SALON -------------------------------------------------------------------------------------

function salon(m) {
  let n = 0;
  const head = (title, kicker) => h('header', { class: 'sec-head' },
    h('span', { class: 'sec-idx', 'aria-hidden': 'true', text: ROMAN[n++] }), h('h2', { class: 'sec-title', text: title }),
    kicker ? h('p', { class: 'sec-kicker', text: kicker }) : null);

  const hero = h('section', { class: 'hero', id: 'top' }, h('div', { class: 'wrap hero-in' },
    h('div', { class: 'hero-art reveal', vars: { '--i': 1 }, 'aria-hidden': 'true' },
      h('div', { class: 'sun' }),
      h('div', { class: 'arch' }, h('span', { class: 'arch-mono', text: m.mono })),
      tradeBadge(m),
      spark('spark spark-a'), spark('spark spark-b')),
    h('div', { class: 'hero-txt' },
      h('p', { class: 'eyebrow reveal', vars: { '--i': 0 } }, h('span', { class: 'rule' }), h('span', { text: [m.label, m.city].filter(Boolean).join(' · ') }), h('span', { class: 'rule' })),
      nameHeading(m, 2),
      h('p', { class: 'tagline reveal', vars: { '--i': 3 }, text: m.tagline }),
      h('div', { class: 'reveal', vars: { '--i': 4 } }, heroCtas(m, 'btn btn--solid', 'btn btn--line', 'Découvrir')))));

  const services = section('services', 'carte', head(m.fam.servicesTitle, m.fam.servicesKicker),
    h('ol', { class: 'svc-list' }, m.items.map(([name, desc], i) => h('li', { class: 'svc' },
      h('span', { class: 'svc-n', 'aria-hidden': 'true', text: pad2(i + 1) }),
      h('div', { class: 'svc-main' }, h('h3', { class: 'svc-name', text: name }), h('p', { class: 'svc-desc', text: desc })),
      h('span', { class: 'svc-slot', text: m.fam.slot })))),
    h('p', { class: 'mock-note', text: m.fam.note }));

  const hb = hoursBlock(m);
  const hours = hb && section('hours', 'horaires', head(m.fam.hoursTitle, m.fam.hoursKicker || 'Au plaisir de vous recevoir'), hb);
  const loc = (m.addr || m.coords) && section('loc', 'acces', head(m.fam.locTitle, m.city ? `À ${m.city}` : null),
    h('div', { class: 'loc-txt' }, addressBlock(m), routeLink(m, 'link-arrow', 'Voir l’itinéraire')), mapBlock(m));
  const cl = contactList(m);
  const contact = cl && section('contact', 'contact', head(m.fam.contactTitle, m.fam.contactKicker || 'Un appel, un message'), cl);

  return [
    h('header', { class: 'hd' }, h('div', { class: 'wrap hd-in' }, brand(m), callLink(m, 'hd-call'))),
    h('main', null, hero, services, ...(m.variant.hoursFirst ? [hours, signature(m)] : [signature(m), hours]), loc, contact),
    footer(m, h('div', { class: 'ft-mono', 'aria-hidden': 'true', text: m.mono })),
  ];
}

// ---- TABLE -------------------------------------------------------------------------------------

function plate(m) {
  return h('div', { class: 'plate', 'aria-hidden': 'true' },
    s('svg', { viewBox: '0 0 200 200' },
      s('circle', { cx: 100, cy: 100, r: 98, class: 'pl-rim' }),
      s('circle', { cx: 100, cy: 100, r: 86, class: 'pl-dash' }),
      s('circle', { cx: 100, cy: 100, r: 62, class: 'pl-well' }),
      s('circle', { cx: 100, cy: 100, r: 58, class: 'pl-hair' })),
    h('span', { class: 'plate-mono', text: m.mono }));
}

function flourish() {
  return s('svg', { class: 'flourish', viewBox: '0 0 120 12', 'aria-hidden': 'true' },
    s('path', { d: 'M0 6h46M74 6h46', stroke: 'currentColor', 'stroke-width': 1, fill: 'none' }),
    s('path', { d: 'M60 1l5 5-5 5-5-5z', fill: 'currentColor' }),
    s('circle', { cx: 50, cy: 6, r: 1.4, fill: 'currentColor' }), s('circle', { cx: 70, cy: 6, r: 1.4, fill: 'currentColor' }));
}

function table(m) {
  const head = (title, kicker) => h('header', { class: 'sec-head' },
    kicker ? h('p', { class: 'sec-kicker', text: kicker }) : null, h('h2', { class: 'sec-title', text: title }));
  const eyebrow = [m.label, m.cuisine && m.cuisine !== m.label ? m.cuisine : null].filter(Boolean);

  const hero = h('section', { class: 'hero', id: 'top' }, h('div', { class: 'wrap hero-in' },
    h('div', { class: 'reveal plate-slot', vars: { '--i': 1 } }, plate(m)),
    h('div', { class: 'hero-txt' },
      h('div', { class: 'reveal', vars: { '--i': 0 } }, tradeBadge(m)),
      h('p', { class: 'eyebrow reveal', vars: { '--i': 0 } }, eyebrow.map((t, i) => [i ? [' ', h('span', { class: 'sep', 'aria-hidden': 'true', text: '—' }), ' '] : null, h('span', { text: t })])),
      nameHeading(m, 1),
      m.city ? h('p', { class: 'hero-city reveal', vars: { '--i': 2 } }, h('span', { class: 'hero-city-line', 'aria-hidden': 'true' }), h('span', { text: `à ${m.city}` })) : null,
      h('p', { class: 'tagline reveal', vars: { '--i': 3 }, text: m.tagline }),
      h('div', { class: 'reveal', vars: { '--i': 4 } }, heroCtas(m, 'btn btn--solid', 'btn btn--line', 'Voir la carte')),
      m.hours ? h('div', { class: 'reveal', vars: { '--i': 5 } }, pill(m, 'pill--hero')) : null)));

  const services = h('section', { class: 'sec sec--services', id: 'carte' }, h('div', { class: 'wrap' },
    h('div', { class: 'menu-card' }, h('div', { class: 'menu-in' },
      h('p', { class: 'menu-kicker', text: m.name }),
      h('h2', { class: 'menu-title', text: m.fam.servicesTitle }),
      flourish(),
      h('ul', { class: 'menu' }, m.items.map(([name, desc]) => h('li', { class: 'dish' },
        h('div', { class: 'dish-row' }, h('h3', { class: 'dish-name', text: name }), h('span', { class: 'dish-dots', 'aria-hidden': 'true' }), h('span', { class: 'dish-slot', text: m.fam.slot })),
        h('p', { class: 'dish-desc', text: desc })))),
      flourish(),
      h('p', { class: 'mock-note', text: m.fam.note })))));

  const hb = hoursBlock(m);
  const hours = hb && section('hours', 'horaires', head(m.fam.hoursTitle, 'Quand passer'), hb);
  const loc = (m.addr || m.coords) && section('loc', 'acces', head(m.fam.locTitle, 'L’adresse'),
    h('div', { class: 'loc-txt' }, addressBlock(m), routeLink(m, 'btn btn--line', 'Itinéraire')), mapBlock(m));
  const cl = contactList(m);
  const contact = cl && section('contact', 'contact', head(m.fam.contactTitle, 'Une question, une table ?'), cl);

  return [
    h('header', { class: 'hd' }, h('div', { class: 'wrap hd-in' }, brand(m), callLink(m, 'hd-call'))),
    h('main', null, hero, services, ...(m.variant.hoursFirst ? [hours, signature(m)] : [signature(m), hours]), loc, contact),
    footer(m, flourish()),
  ];
}

// ---- FOURNIL -----------------------------------------------------------------------------------

function sprig(flip) {
  const LEAF = 'M0 0C2.6-3.6 7.4-3.6 10 0 7.4 3.6 2.6 3.6 0 0Z';
  const leaf = (x, up) => s('path', { d: LEAF, transform: `translate(${x} 8) rotate(${up ? -38 : 38})`, fill: 'currentColor' });
  return s('svg', { class: `sprig${flip ? ' sprig--flip' : ''}`, viewBox: '0 0 46 16', 'aria-hidden': 'true' },
    s('path', { d: 'M1 8h44', stroke: 'currentColor', 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round' }),
    leaf(6, true), leaf(13, false), leaf(20, true), leaf(27, false), leaf(34, true));
}

function stamp(m) {
  const bits = [m.name.length <= 26 ? m.name : m.label, m.city || m.label].filter(Boolean);
  const unit = [...new Set(bits)].join(' • ') + ' • ';
  let ring = unit;
  while (Array.from(ring).length < 38) ring += unit;
  const id = 'stamp-path';
  return h('div', { class: 'stamp reveal', vars: { '--i': 5 }, 'aria-hidden': 'true' },
    s('svg', { viewBox: '0 0 160 160' },
      s('defs', null, s('path', { id, d: 'M80 80m-58 0a58 58 0 1 1 116 0a58 58 0 1 1-116 0' })),
      s('circle', { cx: 80, cy: 80, r: 77, class: 'st-out' }),
      s('circle', { cx: 80, cy: 80, r: 72, class: 'st-out2' }),
      s('circle', { cx: 80, cy: 80, r: 44, class: 'st-in' }),
      s('g', { class: 'st-ring' }, s('text', { class: 'st-text' },
        s('textPath', { href: `#${id}`, textLength: '360', lengthAdjust: 'spacing', startOffset: '0' }, ring.toUpperCase()))),
      s('text', { x: 80, y: 80, class: 'st-mono', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, m.mono)));
}

function fournil(m) {
  const head = (title, kicker) => h('header', { class: 'sec-head' },
    kicker ? h('p', { class: 'sec-kicker' }, sprig(false), h('span', { text: kicker }), sprig(true)) : null,
    h('h2', { class: 'sec-title', text: title }));

  const hero = h('section', { class: 'hero', id: 'top' }, h('div', { class: 'wrap hero-in' },
    h('div', { class: 'reveal', vars: { '--i': 0 } }, tradeBadge(m)),
    h('p', { class: 'eyebrow reveal', vars: { '--i': 1 } }, sprig(false), h('span', { text: m.label }), sprig(true)),
    nameHeading(m, 2),
    m.city ? h('p', { class: 'hero-city reveal', vars: { '--i': 3 }, text: `à ${m.city}` }) : null,
    h('p', { class: 'tagline reveal', vars: { '--i': 3 }, text: m.tagline }),
    h('div', { class: 'reveal', vars: { '--i': 4 } }, heroCtas(m, 'btn btn--solid', 'btn btn--line', 'Voir la boutique')),
    stamp(m)));

  const services = section('services', 'carte', head(m.fam.servicesTitle, m.fam.servicesKicker),
    h('ul', { class: 'tags' }, m.items.map(([name, desc]) => h('li', { class: 'tag' },
      h('span', { class: 'tag-hole', 'aria-hidden': 'true' }),
      h('h3', { class: 'tag-name', text: name }), h('p', { class: 'tag-desc', text: desc }),
      h('span', { class: 'tag-slot', text: m.fam.slot })))),
    h('p', { class: 'mock-note', text: m.fam.note }));

  const hb = hoursBlock(m);
  const hours = hb && h('section', { class: 'sec sec--hours', id: 'horaires' }, h('div', { class: 'wrap' },
    h('div', { class: 'door-sign' },
      h('span', { class: 'door-string', 'aria-hidden': 'true' }),
      h('div', { class: 'door-board' }, h('h2', { class: 'sec-title', text: m.fam.hoursTitle }), hb))));
  const loc = (m.addr || m.coords) && section('loc', 'acces', head(m.fam.locTitle, m.city ? `À ${m.city}` : 'L’adresse'),
    h('div', { class: 'loc-txt' }, addressBlock(m), routeLink(m, 'btn btn--line', 'Itinéraire')), mapBlock(m));
  const cl = contactList(m, 'arrow');
  const contact = cl && section('contact', 'contact', head(m.fam.contactTitle, 'À très vite'), cl);

  const awning = () => h('div', { class: 'awning', 'aria-hidden': 'true' }, h('div', { class: 'awning-stripes' }), h('div', { class: 'awning-scallop' }));
  return [
    awning(),
    h('header', { class: 'hd' }, h('div', { class: 'wrap hd-in' }, brand(m), callLink(m, 'hd-call'))),
    h('main', null, hero, services, ...(m.variant.hoursFirst ? [hours, signature(m)] : [signature(m), hours]), loc, contact),
    footer(m, h('div', { class: 'ft-mono', 'aria-hidden': 'true', text: m.mono })),
  ];
}

// ---- ATELIER -----------------------------------------------------------------------------------

function atelier(m) {
  let n = 0;
  const head = (title, kicker) => h('header', { class: 'sec-head' },
    h('p', { class: 'sec-idx', 'aria-hidden': 'true' }, h('span', { text: pad2(++n) }), h('span', { class: 'sec-idx-line' })),
    h('h2', { class: 'sec-title', text: title }), kicker ? h('p', { class: 'sec-kicker', text: kicker }) : null);

  const coordTxt = m.coords
    ? `${Math.abs(m.coords.lat).toFixed(3)}°${m.coords.lat >= 0 ? 'N' : 'S'} ${Math.abs(m.coords.lon).toFixed(3)}°${m.coords.lon >= 0 ? 'E' : 'O'}` : null;
  const strip = [m.label, m.city, coordTxt].filter(Boolean);
  const tape = [m.label, m.city, ...m.items.map((it) => it[0])].filter(Boolean);
  const tapeRun = () => h('span', { class: 'tape-run' }, tape.map((t) => [h('span', { class: 'tape-w', text: t }), h('span', { class: 'tape-x', text: '✕' })]));

  const hero = h('section', { class: 'hero', id: 'top' }, h('div', { class: 'wrap hero-in' },
    h('ul', { class: 'strip reveal', vars: { '--i': 0 } }, strip.map((t) => h('li', { text: t }))),
    nameHeading(m, 1),
    h('div', { class: 'hero-row' },
      h('p', { class: 'tagline reveal', vars: { '--i': 2 }, text: m.tagline }),
      h('div', { class: 'reveal', vars: { '--i': 3 } }, heroCtas(m, 'btn btn--solid', 'btn btn--line', 'Voir les prestations'))),
    m.hours ? h('div', { class: 'reveal', vars: { '--i': 4 } }, pill(m, 'pill--hero')) : null,
    tradeBadge(m, 'trade-badge trade-badge--corner'), h('span', { class: 'cross cross-b', 'aria-hidden': 'true' })));

  const marquee = h('div', { class: 'tape', 'aria-hidden': 'true' }, h('div', { class: 'tape-track' }, tapeRun(), tapeRun(), tapeRun(), tapeRun()));

  const services = section('services', 'carte', head(m.fam.servicesTitle, m.fam.servicesKicker),
    h('ol', { class: 'spec' }, m.items.map(([name, desc], i) => h('li', { class: 'spec-row' },
      h('span', { class: 'spec-n', 'aria-hidden': 'true', text: pad2(i + 1) }),
      h('h3', { class: 'spec-name', text: name }),
      h('p', { class: 'spec-desc', text: desc }),
      h('span', { class: 'spec-slot', text: `[ ${m.fam.slot} ]` })))),
    h('p', { class: 'mock-note', text: m.fam.note }));

  const hb = hoursBlock(m, { style: 'digital', bars: true });
  const hours = hb && section('hours', 'horaires', head(m.fam.hoursTitle, m.hours ? 'Semaine type · 6 h → minuit' : null), hb);
  const loc = (m.addr || m.coords) && section('loc', 'acces', head(m.fam.locTitle, coordTxt),
    h('div', { class: 'loc-txt' }, addressBlock(m), routeLink(m, 'btn btn--solid', 'Itinéraire')), mapBlock(m));
  const cl = contactList(m);
  const contact = cl && section('contact', 'contact', head(m.fam.contactTitle, 'Direct, sans formulaire'), cl);

  return [
    h('header', { class: 'hd' }, h('div', { class: 'wrap hd-in' }, brand(m), callLink(m, 'hd-call'))),
    h('main', null, hero, marquee, services, ...(m.variant.hoursFirst ? [hours, signature(m)] : [signature(m), hours]), loc, contact),
    footer(m, h('p', { class: 'ft-giant', 'aria-hidden': 'true', text: m.name })),
  ];
}

const FAMILIES = { salon, table, fournil, atelier };

/** model -> array of top-level nodes for #app */
export function renderFamily(m) {
  return (FAMILIES[m.tpl] || atelier)(m).flat().filter(Boolean);
}
