// Tiny DOM builders. The ONLY way js/demo creates markup: createElement + textContent + setAttribute.
// No innerHTML / insertAdjacentHTML / document.write anywhere, so a hostile payload can never become markup.
import { isSafeHref } from './safe.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BLOCKED_ATTR = /^on|^srcdoc$|^formaction$/i;

function apply(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (BLOCKED_ATTR.test(k)) continue;
    if (k === 'text') el.textContent = String(v);
    else if (k === 'vars') { for (const [p, val] of Object.entries(v)) el.style.setProperty(p, String(val)); }
    else if (k === 'href' || k === 'xlink:href') {
      if (!isSafeHref(v)) continue;                      // drop the link, keep the element
      el.setAttribute('href', v);
      if (v.startsWith('https://')) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer nofollow'); }
    } else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** h('a', { class: 'btn', href: safeHref, text: 'Appeler' }) / h('div', { class: 'x' }, child, 'text', ...) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  apply(el, attrs);
  return append(el, children);
}

/** Same for SVG. Text nodes still go through textContent. */
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs);
  return append(el, children);
}

// ---- icons (static paths, nothing from the payload) -----------------------------------------------
const ICONS = {
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm8 8.2L19.2 7H4.8zM5 8.3V17h14V8.3l-7 6z',
  instagram: 'M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zm0 2A2.5 2.5 0 0 0 5 7.5v9A2.5 2.5 0 0 0 7.5 19h9a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 16.5 5zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm4.6-3.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  facebook: 'M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.25-1.46 1.5-1.46h1.6V4.45A21 21 0 0 0 14.3 4.3c-2.3 0-3.8 1.4-3.8 3.95v2.25H8v3h2.5V21z',
  arrow: 'M5 12h12.2l-4.6-4.6L14 6l7 7-7 7-1.4-1.4 4.6-4.6H5z',
  arrowUpRight: 'M8 6h10v10h-2V9.4L7.4 18 6 16.6 14.6 8H8z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm-1 2v5.4l4 2.4 1-1.7-3-1.8V7z',
};

export function icon(name, cls = 'ico') {
  return s('svg', { class: cls, viewBox: '0 0 24 24', width: '1em', height: '1em', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: ICONS[name] || ICONS.arrow, fill: 'currentColor' }));
}
