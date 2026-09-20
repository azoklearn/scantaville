// OSM opening_hours -> 7-day French table + "open now" logic.
// Pure functions, no DOM: runs in the browser and in Node (see hours.test.mjs).
//
// Supported (the syntax mappers actually use for shops):
//   "Mo-Fr 09:00-19:00; Sa 09:00-12:00; Su off"      rule list, later rules override earlier ones per day
//   "Tu-Sa 09:00-12:30,14:00-19:00"                   several time ranges
//   "Mo,We 10:00-18:00" / "Mo-We,Fr 10:00-18:00"      day lists, day ranges, wrapping ranges ("Sa-Mo")
//   "Mo-Fr 09:00-12:00, Sa 10:00-12:00"               additive rules separated by a comma
//   "09:00-19:00"                                     no day = every day
//   "24/7"
//   "PH off" / "PH 10:00-12:00" / "Mo-Sa,PH 09:00-19:00"
//   "Fr-Sa 18:00-02:00" / "18:00-26:00"               wrap past midnight
//   "Mo-Sa 17:00+"                                    open end
//   trailing "open", quoted comments next to real times
// Anything else (months, dates, week numbers, sunrise, "||", school holidays, nth weekday, days
// without times...) -> null, and the page politely shows the raw string instead.

export const DAY_KEYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const DAY_MIN = 1440;
const TOKEN = /\s*(?:(24\/7)|(off|closed)(?![a-z])|(open)(?![a-z])|(PH)(?![a-z])|(Mo|Tu|We|Th|Fr|Sa|Su)(?![a-z])|(\d{1,2})\s*[:h]\s*(\d{2})|(\+)|([-–—])|(,))/iy;

function tokenize(rule) {
  const out = [];
  TOKEN.lastIndex = 0;
  let pos = 0;
  while (pos < rule.length) {
    if (/^\s*$/.test(rule.slice(pos))) break;
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(rule);
    if (!m) return null;
    pos = TOKEN.lastIndex;
    if (m[1]) out.push({ k: 'always' });
    else if (m[2]) out.push({ k: 'off' });
    else if (m[3]) out.push({ k: 'open' });
    else if (m[4]) out.push({ k: 'ph' });
    else if (m[5]) out.push({ k: 'day', v: DAY_KEYS.findIndex((d) => d.toLowerCase() === m[5].toLowerCase()) });
    else if (m[6] !== undefined) {
      const hh = +m[6], mm = +m[7];
      if (hh > 48 || mm > 59) return null;
      out.push({ k: 'time', v: hh * 60 + mm });
    } else if (m[8]) out.push({ k: 'plus' });
    else if (m[9]) out.push({ k: 'dash' });
    else if (m[10]) out.push({ k: 'comma' });
  }
  return out;
}

/** One ";" rule -> list of segments { days:number[]|null, ph:boolean, off:boolean, ranges:[] } or null. */
function parseRule(tokens) {
  const segments = [];
  let i = 0;
  const at = (n, k) => tokens[n] && tokens[n].k === k;
  const isDayish = (n) => at(n, 'day') || at(n, 'ph');

  for (;;) {
    let days = null;
    let ph = false;

    if (isDayish(i)) {
      days = [];
      for (;;) {
        if (at(i, 'ph')) { ph = true; i++; }
        else if (at(i, 'day')) {
          const from = tokens[i].v; i++;
          if (at(i, 'dash') && at(i + 1, 'day')) {
            const to = tokens[i + 1].v; i += 2;
            for (let d = from; ; d = (d + 1) % 7) { days.push(d); if (d === to) break; }
          } else days.push(from);
        } else return null;
        if (at(i, 'comma') && isDayish(i + 1)) { i++; continue; }
        break;
      }
    }

    const seg = { days, ph, off: false, ranges: [] };
    if (at(i, 'off')) { seg.off = true; i++; }
    else if (at(i, 'always')) { seg.ranges.push({ start: 0, end: DAY_MIN, openEnd: false }); i++; }
    else if (at(i, 'time')) {
      for (;;) {
        if (!at(i, 'time')) return null;
        const start = tokens[i].v; i++;
        if (start >= DAY_MIN) return null;
        if (at(i, 'plus')) { seg.ranges.push({ start, end: DAY_MIN, openEnd: true }); i++; }
        else {
          if (!at(i, 'dash') || !at(i + 1, 'time')) return null;
          let end = tokens[i + 1].v; i += 2;
          if (end <= start) end += DAY_MIN;          // 18:00-02:00 and 00:00-00:00
          if (end - start > DAY_MIN) return null;
          let openEnd = false;
          if (at(i, 'plus')) { openEnd = true; i++; }
          seg.ranges.push({ start, end, openEnd });
        }
        if (at(i, 'comma') && at(i + 1, 'time')) { i++; continue; }
        break;
      }
      if (at(i, 'open')) i++;
    } else return null;                              // days without times, stray tokens...

    segments.push(seg);
    if (at(i, 'comma') && isDayish(i + 1)) { i++; continue; }   // "Mo-Fr 09:00-12:00, Sa 10:00-12:00"
    break;
  }
  return i === tokens.length ? segments : null;
}

function mergeRanges(ranges) {
  const sorted = ranges.map((r) => ({ ...r })).sort((a, b) => a.start - b.start);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) {
      if (r.end > last.end) { last.end = r.end; last.openEnd = r.openEnd; }
    } else out.push(r);
  }
  return out;
}

/** 540 -> "9h", 750 -> "12h30", 1440 -> "minuit", 1560 -> "2h". */
export function formatTime(min, style = 'fr') {
  const m = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const hh = Math.floor(m / 60), mm = m % 60;
  if (style === 'digital') return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  if (m === 0 && min !== 0) return 'minuit';
  return `${hh}h${mm ? String(mm).padStart(2, '0') : ''}`;
}

export function formatRange(r, style = 'fr') {
  if (r.start === 0 && r.end === DAY_MIN && !r.openEnd) return style === 'digital' ? '00:00–24:00' : '24h/24';
  if (r.openEnd && r.end === DAY_MIN) return style === 'digital' ? `${formatTime(r.start, style)} +` : `dès ${formatTime(r.start)}`;
  return `${formatTime(r.start, style)} – ${formatTime(r.end, style)}`;
}

export function formatRanges(ranges, style = 'fr') {
  if (!ranges.length) return 'Fermé';
  return ranges.map((r) => formatRange(r, style)).join(style === 'digital' ? '  ' : ', ');
}

/**
 * @returns {null | { days: {key,label,short,ranges,closed,text}[], always: boolean,
 *                    holidays: null | {closed:true,text} | {closed:false,ranges,text} }}
 */
export function parseOpeningHours(input) {
  if (typeof input !== 'string') return null;
  let str = input.trim();
  if (!str || str.length > 400) return null;
  if (str.includes('||')) return null;

  const week = Array.from({ length: 7 }, () => []);
  let holidays = null;
  let sawRule = false;

  for (const rawRule of str.split(';')) {
    const hadComment = /"[^"]*"/.test(rawRule);
    const rule = rawRule.replace(/"[^"]*"/g, ' ').trim();
    if (!rule) { if (hadComment) return null; continue; }   // comment-only rule ("sur rendez-vous")
    if (rule.includes('"')) return null;
    const tokens = tokenize(rule);
    if (!tokens || !tokens.length) return null;
    const segments = parseRule(tokens);
    if (!segments) return null;
    sawRule = true;

    const touched = new Set();
    for (const seg of segments) {
      if (seg.ph) holidays = seg.off ? { closed: true } : { closed: false, ranges: mergeRanges(seg.ranges) };
      const target = seg.days === null ? [0, 1, 2, 3, 4, 5, 6] : seg.days;
      for (const d of target) {
        if (!touched.has(d)) { week[d] = []; touched.add(d); }   // a later ";" rule overrides the day
        if (seg.off) week[d] = [];
        else week[d].push(...seg.ranges);
      }
    }
  }
  if (!sawRule) return null;

  const days = week.map((ranges, i) => {
    const merged = mergeRanges(ranges);
    return {
      key: DAY_KEYS[i], label: DAY_LABELS[i], short: DAY_SHORT[i],
      ranges: merged, closed: merged.length === 0, text: formatRanges(merged),
    };
  });
  const always = days.every((d) => d.ranges.length === 1 && d.ranges[0].start === 0 && d.ranges[0].end === DAY_MIN && !d.ranges[0].openEnd);
  if (holidays) holidays.text = holidays.closed ? 'Fermé les jours fériés' : `Jours fériés : ${formatRanges(holidays.ranges)}`;
  return { days, always, holidays };
}

function rangesFor(parsed, dayIdx, holiday) {
  if (holiday && parsed.holidays) return parsed.holidays.closed ? [] : parsed.holidays.ranges;
  return parsed.days[dayIdx].ranges;
}

/** dayIdx: 0 = Monday. minutes: minutes since midnight. Returns the active range or null. */
export function activeRange(parsed, dayIdx, minutes, { holiday = false, holidayYesterday = false } = {}) {
  if (!parsed) return null;
  for (const r of rangesFor(parsed, dayIdx, holiday)) {
    if (minutes >= r.start && minutes < r.end) return { ...r, spill: false };
  }
  const y = (dayIdx + 6) % 7;                         // last night's "18:00-02:00"
  for (const r of rangesFor(parsed, y, holidayYesterday)) {
    if (r.end > DAY_MIN && minutes + DAY_MIN < r.end) return { ...r, spill: true };
  }
  return null;
}

export function isOpenAt(parsed, dayIdx, minutes, opts) {
  return activeRange(parsed, dayIdx, minutes, opts) !== null;
}

// ---- calendar helpers -------------------------------------------------------------------------

function easter(year) {                                // anonymous Gregorian algorithm
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}

/** French public holidays (metropolitan France). month is 1-12. */
export function isFrenchHoliday(year, month, day) {
  const fixed = ['1-1', '5-1', '5-8', '7-14', '8-15', '11-1', '11-11', '12-25'];
  if (fixed.includes(`${month}-${day}`)) return true;
  const t = Date.UTC(year, month - 1, day), e = easter(year), D = 86400000;
  return t === e + D || t === e + 39 * D || t === e + 50 * D;   // Easter Monday, Ascension, Whit Monday
}

const WD = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Wall-clock parts of `date` in `timeZone` (undefined = the viewer's own time zone). */
export function zonedParts(date = new Date(), timeZone = 'Europe/Paris') {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
      }).formatToParts(date);
      const get = (t) => parts.find((p) => p.type === t)?.value;
      const dayIdx = WD[get('weekday')];
      if (dayIdx !== undefined) {
        return { dayIdx, minutes: (+get('hour') % 24) * 60 + +get('minute'), year: +get('year'), month: +get('month'), day: +get('day') };
      }
    } catch { /* unknown zone -> local time below */ }
  }
  return {
    dayIdx: (date.getDay() + 6) % 7, minutes: date.getHours() * 60 + date.getMinutes(),
    year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(),
  };
}

function holidayFlags(parsed, p) {
  if (!parsed.holidays) return { holiday: false, holidayYesterday: false };
  const y = new Date(Date.UTC(p.year, p.month - 1, p.day) - 86400000);
  return {
    holiday: isFrenchHoliday(p.year, p.month, p.day),
    holidayYesterday: isFrenchHoliday(y.getUTCFullYear(), y.getUTCMonth() + 1, y.getUTCDate()),
  };
}

export function isOpenNow(parsed, date = new Date(), timeZone = 'Europe/Paris') {
  if (!parsed) return false;
  const p = zonedParts(date, timeZone);
  return isOpenAt(parsed, p.dayIdx, p.minutes, holidayFlags(parsed, p));
}

/** { open, dayIdx, label: 'Ouvert'|'Fermé', detail: "jusqu'à 19h" | 'ouvre demain à 9h' | '' } */
export function statusNow(parsed, date = new Date(), timeZone = 'Europe/Paris') {
  const p = zonedParts(date, timeZone);
  if (!parsed) return { open: false, dayIdx: p.dayIdx, label: '', detail: '' };
  if (parsed.always) return { open: true, dayIdx: p.dayIdx, label: 'Ouvert', detail: '24h/24' };
  const r = activeRange(parsed, p.dayIdx, p.minutes, holidayFlags(parsed, p));
  if (r) {
    const detail = r.openEnd ? '' : `jusqu'à ${formatTime(r.end)}`;
    return { open: true, dayIdx: p.dayIdx, label: 'Ouvert', detail };
  }
  for (let off = 0; off < 8; off++) {                  // next opening, weekly table only
    const d = (p.dayIdx + off) % 7;
    const next = parsed.days[d].ranges.find((x) => off > 0 || x.start > p.minutes);
    if (!next) continue;
    const when = off === 0 ? '' : off === 1 ? 'demain ' : `${DAY_LABELS[d].toLowerCase()} `;
    return { open: false, dayIdx: p.dayIdx, label: 'Fermé', detail: `ouvre ${when}à ${formatTime(next.start)}` };
  }
  return { open: false, dayIdx: p.dayIdx, label: 'Fermé', detail: '' };
}
