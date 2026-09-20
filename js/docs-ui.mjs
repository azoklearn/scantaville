// Quote / invoice generator: the form lives in the app, the A4 sheet in doc.html (an iframe we can print on its own).
import { DOC_TYPES, QUICK_LINES, blankDoc, docNumber, issues, money, totals } from './doc/model.mjs';
import * as store from './store.mjs';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
};

let doc = null, hooks = {}, autoNumber = '';

const year = () => new Date().getFullYear();
const nextNumber = (type) => docNumber(type, year(), store.peekDocSeq(type, year()));

/** lead (optional) pre-fills the client block: name, address and the SIRET OpenStreetMap often carries */
export function openDocs(type = 'devis', lead = null) {
  const client = lead ? { name: lead.name, address: (lead.addr || '').replace(/,\s*/, '\n'), siren: lead.siret || '' } : {};
  autoNumber = nextNumber(type);
  doc = blankDoc(type, { seller: store.getSeller(), client, number: autoNumber });
  fillForm(); renderLines(); sync();
  $('#docs').hidden = false;
  fitPreview();
}

export function initDocs(h) {
  hooks = h;
  const form = $('#doc-form');
  $('#doc-frame').src = 'doc.html';
  $('#doc-frame').addEventListener('load', () => { push(); fitPreview(); });

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.name || t.closest('#doc-lines')) return;
    const value = t.type === 'checkbox' ? t.checked : t.value;
    const [group, key] = t.name.split('.');
    if (key) doc[group][key] = value; else doc[group] = value;
    sync();
  });

  $$('[data-doc-type]').forEach((b) => b.addEventListener('click', () => {
    const type = b.dataset.docType;
    if (doc.type === type) return;
    // keep a number the user typed; swap ours for the next one of the other series
    if (doc.number === autoNumber) { autoNumber = nextNumber(type); doc.number = autoNumber; form.elements.number.value = doc.number; }
    else autoNumber = nextNumber(type);
    doc.type = type; sync();
  }));

  $('#doc-add').addEventListener('click', () => { doc.lines.push({ label: '', qty: 1, price: 0 }); renderLines(); sync(); $('#doc-lines .doc-line:last-child input')?.focus(); });
  $('#doc-quick').replaceChildren(...QUICK_LINES.slice(1).map((q) => el('button', {
    class: 'chip', type: 'button', text: '+ ' + q.label.split(/[,(]/)[0].trim() + ' · ' + money(q.price).replace(',00', ''),
    onclick: () => { doc.lines.push({ ...q }); renderLines(); sync(); },
  })));

  $('#doc-print').addEventListener('click', () => {
    if (!store.can('invoicing')) return hooks.openPaywall('Les devis et factures en PDF sont dans la formule Pro.', { feature: 'invoicing' });
    const problems = issues(doc);
    if (problems.length && !confirm('Ce document est incomplet :\n\n• ' + problems.join('\n• ') + '\n\nL’imprimer quand même ?')) return;
    store.setSeller(doc.seller);
    // the number is now used: the next document of this series takes the following one (no gap, no duplicate)
    const m = /^[A-Z]-(\d{4})-(\d+)$/.exec(doc.number.trim());
    if (m) store.bumpDocSeq(doc.type, Number(m[1]), Number(m[2]));
    const frame = $('#doc-frame');
    frame.contentWindow.focus(); frame.contentWindow.print();
  });

  addEventListener('resize', fitPreview);
}

function fillForm() {
  const f = $('#doc-form').elements;
  for (const field of f) {
    if (!field.name) continue;
    const [group, key] = field.name.split('.');
    const v = key ? doc[group]?.[key] : doc[group];
    if (field.type === 'checkbox') field.checked = !!v; else field.value = v ?? '';
  }
}

function renderLines() {
  $('#doc-lines').replaceChildren(...doc.lines.map((l, i) => el('div', { class: 'doc-line' },
    el('input', { type: 'text', value: l.label, placeholder: 'Désignation précise de la prestation', 'aria-label': 'Désignation', oninput: (e) => { l.label = e.target.value; sync(); } }),
    el('input', { type: 'number', min: '0', step: '1', value: l.qty, 'aria-label': 'Quantité', oninput: (e) => { l.qty = e.target.value; sync(); } }),
    el('input', { type: 'number', min: '0', step: '1', value: l.price, 'aria-label': 'Prix unitaire hors taxes', oninput: (e) => { l.price = e.target.value; sync(); } }),
    el('button', { type: 'button', class: 'doc-del', 'aria-label': 'Supprimer la ligne', text: '×', onclick: () => { doc.lines.splice(i, 1); if (!doc.lines.length) doc.lines.push({ label: '', qty: 1, price: 0 }); renderLines(); sync(); } }))));
}

function sync() {
  const form = $('#doc-form');
  form.dataset.type = doc.type; form.dataset.vat = doc.vatFranchise ? 'franchise' : 'vat';
  $$('[data-doc-type]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.docType === doc.type)));
  const t = totals(doc);
  $('#doc-total').textContent = `${DOC_TYPES[doc.type].label} · ${money(t.ttc)}${t.deposit ? ` · acompte ${money(t.deposit)}` : ''}`;
  $('#doc-issues').replaceChildren(...issues(doc).map((m) => el('li', { text: m })));
  const locked = !store.can('invoicing');
  $('#doc-print').replaceChildren('Imprimer ou enregistrer en PDF', locked ? el('span', { class: 'lock', text: ' 🔒' }) : '');
  push();
}

function push() {
  if (!doc) return;
  store.setCurrentDoc(doc);
  try { $('#doc-frame').contentWindow?.postMessage({ type: 'stv-doc-update' }, location.origin); } catch { /* frame not ready yet */ }
}

/** the sheet is a real A4 (794 px wide): scale the iframe down to the width of its column */
function fitPreview() {
  const box = $('.docs-preview-in'), frame = $('#doc-frame');
  if (!box || !frame || $('#docs').hidden) return;
  const W = 830, H = 1180, k = Math.min(1, box.clientWidth / W);
  frame.style.width = W + 'px'; frame.style.height = H + 'px';
  frame.style.transform = `scale(${k})`;
  box.style.height = Math.round(H * k) + 'px';
}
