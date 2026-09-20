// Builds the A4 sheet of a quote / invoice. textContent only: everything in a document is typed by the user.
import { DOC_TYPES, VAT_FRANCHISE_MENTION, LATE_PENALTY, RECOVERY_FEE, NO_DISCOUNT, totals, money, frDate, addDays } from './model.mjs';

const h = (tag, cls, ...kids) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false && k !== '') n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
};
const lines = (text) => String(text || '').split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
const siretFmt = (s) => { const d = String(s || '').replace(/\s/g, ''); return d.length === 14 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4') : d.replace(/(\d{3})(?=\d)/g, '$1 '); };

export function renderSheet(doc) {
  const t = totals(doc), isQuote = doc.type === 'devis', kind = DOC_TYPES[doc.type] || DOC_TYPES.devis;
  const sellerName = [doc.seller.name.trim(), doc.seller.ei ? 'EI' : ''].filter(Boolean).join(' ');
  const idLabel = String(doc.seller.siret || '').replace(/\s/g, '').length === 9 ? 'SIREN' : 'SIRET';

  const head = h('header', 'sh-head',
    h('div', 'sh-seller',
      h('p', 'sh-seller-name', sellerName || 'Ton nom EI'),
      lines(doc.seller.address).map((l) => h('p', null, l)),
      doc.seller.siret ? h('p', null, `${idLabel} ${siretFmt(doc.seller.siret)}`) : null,
      doc.seller.email ? h('p', null, doc.seller.email) : null,
      doc.seller.phone ? h('p', null, doc.seller.phone) : null),
    h('div', 'sh-meta',
      h('p', 'sh-kind', kind.label),
      h('p', 'sh-num', `N° ${doc.number || '—'}`),
      h('dl', 'sh-dates',
        h('div', null, h('dt', null, 'Date d’émission'), h('dd', null, frDate(doc.date))),
        isQuote
          ? h('div', null, h('dt', null, 'Valable jusqu’au'), h('dd', null, frDate(addDays(doc.date, doc.validityDays))))
          : [h('div', null, h('dt', null, 'Date de la prestation'), h('dd', null, frDate(doc.serviceDate))),
             h('div', null, h('dt', null, 'Échéance'), h('dd', null, frDate(addDays(doc.date, doc.dueDays))))])));

  const client = h('section', 'sh-client',
    h('p', 'sh-label', isQuote ? 'Devis pour' : 'Facturé à'),
    h('p', 'sh-client-name', doc.client.name || 'Nom du commerce'),
    doc.client.contact ? h('p', null, `À l’attention de ${doc.client.contact}`) : null,
    lines(doc.client.address).map((l) => h('p', null, l)),
    doc.client.siren ? h('p', null, `SIREN / SIRET ${siretFmt(doc.client.siren)}`) : null);

  const table = h('table', 'sh-table',
    h('thead', null, h('tr', null, h('th', null, 'Désignation'), h('th', 'num', 'Qté'), h('th', 'num', 'Prix unitaire HT'), h('th', 'num', 'Total HT'))),
    h('tbody', null, t.lines.filter((l) => l.label.trim() || l.total).map((l) => h('tr', null,
      h('td', null, l.label), h('td', 'num', String(l.qty).replace('.', ',')), h('td', 'num', money(l.price)), h('td', 'num', money(l.total))))));

  const sums = h('section', 'sh-sums',
    h('div', null, h('span', null, 'Total HT'), h('b', null, money(t.ht))),
    doc.vatFranchise
      ? h('p', 'sh-vat-note', VAT_FRANCHISE_MENTION)
      : h('div', null, h('span', null, `TVA ${String(doc.vatRate).replace('.', ',')} %`), h('b', null, money(t.vat))),
    h('div', 'sh-total', h('span', null, doc.vatFranchise ? 'Net à payer' : 'Total TTC'), h('b', null, money(t.ttc))),
    t.deposit ? h('div', 'sh-deposit', h('span', null, `Acompte à la commande (${doc.depositPct} %)`), h('b', null, money(t.deposit))) : null,
    t.deposit ? h('div', 'sh-deposit', h('span', null, 'Solde à la mise en ligne'), h('b', null, money(Math.round((t.ttc - t.deposit) * 100) / 100))) : null);

  const terms = h('section', 'sh-terms',
    !isQuote ? h('p', null, 'Nature de l’opération : prestation de services.') : null,
    doc.notes.trim() ? h('div', 'sh-notes', lines(doc.notes).map((l) => h('p', null, l))) : null,
    h('p', null, doc.payment),
    doc.bank.trim() ? h('p', null, doc.bank) : null,
    isQuote
      ? h('p', null, `Devis valable ${doc.validityDays} jours. Un acompte est un engagement ferme des deux parties. Il donne lieu à une facture d’acompte, déduite de la facture finale.`)
      : h('p', null, `Paiement à réception, au plus tard le ${frDate(addDays(doc.date, doc.dueDays))}.`),
    h('p', null, [LATE_PENALTY, RECOVERY_FEE, NO_DISCOUNT].join(' ')));

  const sign = isQuote ? h('section', 'sh-sign',
    h('div', null, h('p', 'sh-label', 'Le prestataire'), h('p', null, sellerName)),
    h('div', 'sh-sign-box', h('p', 'sh-label', 'Le client'), h('p', null, 'Date, signature, précédées de la mention « Bon pour accord »'))) : null;

  const foot = h('footer', 'sh-foot', [sellerName, doc.seller.siret ? `${idLabel} ${siretFmt(doc.seller.siret)}` : '', doc.vatFranchise ? VAT_FRANCHISE_MENTION : ''].filter(Boolean).join(' · '));

  return h('article', 'sheet', head, client, table, sums, terms, sign, foot);
}
