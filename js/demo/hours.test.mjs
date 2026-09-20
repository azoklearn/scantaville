// Run: node js/demo/hours.test.mjs
import assert from 'node:assert/strict';
import {
  parseOpeningHours, isOpenAt, isOpenNow, statusNow, formatTime, formatRange, isFrenchHoliday, zonedParts,
} from './hours.mjs';

let n = 0;
function test(name, fn) { fn(); n++; console.log('ok  ' + name); }
const ranges = (p, d) => p.days[d].ranges.map((r) => [r.start, r.end]);
const H = (h, m = 0) => h * 60 + m;
const MO = 0, TU = 1, WE = 2, TH = 3, FR = 4, SA = 5, SU = 6;

test('classic week: Mo-Fr 09:00-19:00; Sa 09:00-12:00; Su off', () => {
  const p = parseOpeningHours('Mo-Fr 09:00-19:00; Sa 09:00-12:00; Su off');
  assert.ok(p);
  assert.equal(p.days.length, 7);
  for (const d of [MO, TU, WE, TH, FR]) assert.deepEqual(ranges(p, d), [[H(9), H(19)]]);
  assert.deepEqual(ranges(p, SA), [[H(9), H(12)]]);
  assert.deepEqual(ranges(p, SU), []);
  assert.equal(p.days[SU].closed, true);
  assert.equal(p.days[SU].text, 'Fermé');
  assert.equal(p.days[MO].label, 'Lundi');
  assert.equal(p.days[MO].text, '9h – 19h');
  assert.equal(p.always, false);
  assert.equal(p.holidays, null);
});

test('lunch break: Tu-Sa 09:00-12:30,14:00-19:00', () => {
  const p = parseOpeningHours('Tu-Sa 09:00-12:30,14:00-19:00');
  assert.deepEqual(ranges(p, TU), [[H(9), H(12, 30)], [H(14), H(19)]]);
  assert.deepEqual(ranges(p, MO), []);
  assert.deepEqual(ranges(p, SU), []);
  assert.equal(p.days[TU].text, '9h – 12h30, 14h – 19h');
  assert.equal(isOpenAt(p, TU, H(13)), false);
  assert.equal(isOpenAt(p, TU, H(12, 29)), true);
  assert.equal(isOpenAt(p, TU, H(12, 30)), false);
  assert.equal(isOpenAt(p, TU, H(14)), true);
});

test('day list: Mo,We 10:00-18:00', () => {
  const p = parseOpeningHours('Mo,We 10:00-18:00');
  assert.deepEqual(ranges(p, MO), [[H(10), H(18)]]);
  assert.deepEqual(ranges(p, WE), [[H(10), H(18)]]);
  assert.deepEqual(ranges(p, TU), []);
});

test('mixed day list: Mo-We,Fr 10:00-18:00 and wrapping day range Sa-Mo', () => {
  const p = parseOpeningHours('Mo-We,Fr 10:00-18:00');
  assert.deepEqual([MO, TU, WE, TH, FR, SA, SU].map((d) => p.days[d].closed), [false, false, false, true, false, true, true]);
  const q = parseOpeningHours('Sa-Mo 08:00-13:00');
  assert.deepEqual([MO, TU, WE, TH, FR, SA, SU].map((d) => q.days[d].closed), [false, true, true, true, true, false, false]);
});

test('24/7', () => {
  const p = parseOpeningHours('24/7');
  assert.equal(p.always, true);
  assert.equal(p.days[SU].text, '24h/24');
  assert.equal(isOpenAt(p, SU, H(3, 33)), true);
  assert.equal(statusNow(p, new Date('2026-09-21T03:00:00+02:00')).detail, '24h/24');
});

test('no day selector = every day', () => {
  const p = parseOpeningHours('08:00-20:00');
  for (let d = 0; d < 7; d++) assert.deepEqual(ranges(p, d), [[H(8), H(20)]]);
});

test('PH off and PH with hours', () => {
  const p = parseOpeningHours('Mo-Sa 09:00-19:00; PH off');
  assert.deepEqual(p.holidays, { closed: true, text: 'Fermé les jours fériés' });
  assert.deepEqual(ranges(p, MO), [[H(9), H(19)]]);                 // PH rule must not wipe weekdays
  const q = parseOpeningHours('Mo-Fr 09:00-19:00; PH 10:00-12:00');
  assert.equal(q.holidays.closed, false);
  assert.equal(q.holidays.text, 'Jours fériés : 10h – 12h');
  const r = parseOpeningHours('Mo-Sa,PH 09:00-19:00; Su off');
  assert.equal(r.holidays.closed, false);
  assert.deepEqual(ranges(r, SA), [[H(9), H(19)]]);
  const s = parseOpeningHours('Mo-Sa 09:00-19:00; Su,PH off');
  assert.equal(s.holidays.closed, true);
  assert.equal(s.days[SU].closed, true);
});

test('PH off is honoured on a French public holiday', () => {
  const p = parseOpeningHours('Mo-Su 09:00-19:00; PH off');
  assert.equal(isOpenNow(p, new Date('2026-07-14T11:00:00+02:00')), false);   // Bastille day, a Tuesday
  assert.equal(isOpenNow(p, new Date('2026-07-15T11:00:00+02:00')), true);
  assert.equal(isFrenchHoliday(2026, 4, 6), true);    // Easter Monday 2026
  assert.equal(isFrenchHoliday(2026, 5, 14), true);   // Ascension 2026
  assert.equal(isFrenchHoliday(2026, 5, 25), true);   // Whit Monday 2026
  assert.equal(isFrenchHoliday(2026, 5, 26), false);
});

test('wrap past midnight: Fr-Sa 18:00-02:00', () => {
  const p = parseOpeningHours('Fr-Sa 18:00-02:00');
  assert.deepEqual(ranges(p, FR), [[H(18), H(26)]]);
  assert.equal(p.days[FR].text, '18h – 2h');
  assert.equal(isOpenAt(p, FR, H(23)), true);
  assert.equal(isOpenAt(p, SA, H(1)), true);          // Friday night spilling into Saturday
  assert.equal(isOpenAt(p, SU, H(1, 59)), true);      // Saturday night spilling into Sunday
  assert.equal(isOpenAt(p, SU, H(2)), false);
  assert.equal(isOpenAt(p, FR, H(1)), false);         // Thursday is closed, nothing spills into Friday
  assert.equal(isOpenAt(p, MO, H(1)), false);
  assert.deepEqual(ranges(parseOpeningHours('Fr 18:00-26:00'), FR), [[H(18), H(26)]]);
  assert.equal(parseOpeningHours('Mo-Su 18:00-24:00').days[MO].text, '18h – minuit');
});

test('open end: Mo-Sa 17:00+', () => {
  const p = parseOpeningHours('Mo-Sa 17:00+');
  assert.equal(p.days[MO].text, 'dès 17h');
  assert.equal(isOpenAt(p, MO, H(22)), true);
  assert.equal(isOpenAt(p, MO, H(16)), false);
});

test('later ";" rule overrides, "," rule adds', () => {
  const p = parseOpeningHours('Mo-Sa 09:00-19:00; We off');
  assert.equal(p.days[WE].closed, true);
  assert.deepEqual(ranges(p, TH), [[H(9), H(19)]]);
  const q = parseOpeningHours('Mo-Sa 09:00-19:00; We 09:00-12:00');
  assert.deepEqual(ranges(q, WE), [[H(9), H(12)]]);
  const r = parseOpeningHours('Mo-Fr 09:00-12:00, Mo-Fr 14:00-18:00, Sa 10:00-12:00');
  assert.deepEqual(ranges(r, MO), [[H(9), H(12)], [H(14), H(18)]]);
  assert.deepEqual(ranges(r, SA), [[H(10), H(12)]]);
});

test('tolerant input: case, spacing, "closed", "open", trailing ";", 9h30, comments', () => {
  assert.deepEqual(ranges(parseOpeningHours('mo-fr 9:00-19:00;'), MO), [[H(9), H(19)]]);
  assert.deepEqual(ranges(parseOpeningHours('  Mo-Fr   09:00 - 19:00 ;  Su closed '), FR), [[H(9), H(19)]]);
  assert.deepEqual(ranges(parseOpeningHours('Mo-Fr 09:00-19:00 open'), FR), [[H(9), H(19)]]);
  assert.deepEqual(ranges(parseOpeningHours('Mo-Fr 9h30-19h00'), MO), [[H(9, 30), H(19)]]);
  assert.deepEqual(ranges(parseOpeningHours('Mo-Fr 09:00-18:00 "sur rendez-vous"'), MO), [[H(9), H(18)]]);
  assert.deepEqual(ranges(parseOpeningHours('Mo 09:00-12:00,11:00-18:00'), MO), [[H(9), H(18)]]);   // overlap merged
});

test('unparseable -> null', () => {
  for (const s of [
    '', '   ', 'sur rendez-vous', '"sur rendez-vous"', 'Mo-Fr', 'Mo-Fr 09:00', 'Mo-Fr 25:99-26:00',
    'Jan-Mar Mo-Fr 09:00-19:00', 'Mo-Fr 09:00-19:00; Dec 25 off', 'week 1-26 Mo 10:00-12:00',
    'Mo-Fr sunrise-sunset', 'Mo-Fr 09:00-19:00 || "by appointment"', 'Mo[1] 10:00-12:00', 'SH off',
    'Mon-Fri 09:00-19:00', 'Lu-Ve 09:00-19:00', 'Mo-Fr 09:00-19:00; Sa "sur rendez-vous"', '<script>alert(1)</script>',
    'x'.repeat(500),
  ]) assert.equal(parseOpeningHours(s), null, JSON.stringify(s));
  for (const v of [null, undefined, 42, {}, []]) assert.equal(parseOpeningHours(v), null);
});

test('isOpenNow / statusNow use Paris wall-clock time', () => {
  const p = parseOpeningHours('Mo-Fr 09:00-19:00; Sa 09:00-12:00; Su off');
  // 2026-09-21 is a Monday. +02:00 = Paris summer time.
  assert.equal(zonedParts(new Date('2026-09-21T10:00:00+02:00')).dayIdx, MO);
  assert.equal(isOpenNow(p, new Date('2026-09-21T10:00:00+02:00')), true);
  assert.equal(isOpenNow(p, new Date('2026-09-21T08:59:00+02:00')), false);
  assert.equal(isOpenNow(p, new Date('2026-09-21T19:00:00+02:00')), false);
  assert.equal(isOpenNow(p, new Date('2026-09-21T08:30:00Z')), true);          // 10:30 in Paris
  assert.equal(isOpenNow(p, new Date('2026-09-27T10:00:00+02:00')), false);    // Sunday
  assert.equal(isOpenNow(p, new Date('2026-01-05T09:30:00+01:00')), true);     // winter time Monday
  assert.equal(isOpenNow(null), false);

  assert.deepEqual(statusNow(p, new Date('2026-09-21T10:00:00+02:00')), { open: true, dayIdx: MO, label: 'Ouvert', detail: "jusqu'à 19h" });
  assert.deepEqual(statusNow(p, new Date('2026-09-21T08:00:00+02:00')), { open: false, dayIdx: MO, label: 'Fermé', detail: 'ouvre à 9h' });
  assert.deepEqual(statusNow(p, new Date('2026-09-21T20:00:00+02:00')), { open: false, dayIdx: MO, label: 'Fermé', detail: 'ouvre demain à 9h' });
  assert.deepEqual(statusNow(p, new Date('2026-09-26T13:00:00+02:00')), { open: false, dayIdx: SA, label: 'Fermé', detail: 'ouvre lundi à 9h' });
  const bar = parseOpeningHours('Fr-Sa 18:00-02:00');
  assert.deepEqual(statusNow(bar, new Date('2026-09-26T01:00:00+02:00')), { open: true, dayIdx: SA, label: 'Ouvert', detail: "jusqu'à 2h" });
  const oneDay = parseOpeningHours('Mo 09:00-12:00');
  assert.equal(statusNow(oneDay, new Date('2026-09-21T13:00:00+02:00')).detail, 'ouvre lundi à 9h');
});

test('formatters', () => {
  assert.equal(formatTime(H(9)), '9h');
  assert.equal(formatTime(H(12, 5)), '12h05');
  assert.equal(formatTime(0), '0h');
  assert.equal(formatTime(H(24)), 'minuit');
  assert.equal(formatTime(H(9), 'digital'), '09:00');
  assert.equal(formatRange({ start: H(9), end: H(19) }, 'digital'), '09:00 – 19:00');
});

console.log(`\n${n} tests passed`);
