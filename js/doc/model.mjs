// Quote (devis) and invoice (facture) model: defaults, totals, numbering. No DOM in here.
// The mandatory mentions follow js/content/starter.mjs (checked on service-public.fr, 2026-09):
// unique chronological number, issue date, service date, seller name + "EI", address, SIREN/SIRET,
// client name + address (+ SIREN, mandatory with the e-invoicing reform), each line with quantity and
// unit price excl. tax, total, due date, late-payment penalties, 40 EUR recovery fee, early-payment
// discount, and "TVA non applicable, art. 293 B du CGI" under the VAT franchise.
import { PRICE_GRID } from '../content/starter.mjs';

export const DOC_TYPES = { devis: { label: 'Devis', prefix: 'D' }, facture: { label: 'Facture', prefix: 'F' } };

export const VAT_FRANCHISE_MENTION = 'TVA non applicable, art. 293 B du CGI';
export const LATE_PENALTY = 'Pénalités de retard : trois fois le taux d’intérêt légal en vigueur.';
export const RECOVERY_FEE = 'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.';
export const NO_DISCOUNT = 'Escompte pour paiement anticipé : néant.';

export const QUICK_LINES = [
  { label: PRICE_GRID.site.label, price: PRICE_GRID.site.price, qty: 1 },
  ...PRICE_GRID.options.map((o) => ({ label: o.label, price: o.price, qty: 1 })),
  { label: PRICE_GRID.maintenance.label + ' (par mois)', price: PRICE_GRID.maintenance.price, qty: 1 },
];

const iso = (d) => d.toISOString().slice(0, 10);
export const today = () => iso(new Date());
export function addDays(dateIso, days) { const d = new Date(dateIso + 'T12:00:00'); d.setDate(d.getDate() + Number(days || 0)); return iso(d); }
export function frDate(dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso || '')) return '';
  const [y, m, d] = dateIso.split('-'); return `${d}/${m}/${y}`;
}
export const money = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function docNumber(type, year, seq) { return `${DOC_TYPES[type]?.prefix || 'D'}-${year}-${String(seq).padStart(3, '0')}`; }

export function blankDoc(type = 'devis', { seller = {}, client = {}, number = '' } = {}) {
  const date = today();
  return {
    type, number, date,
    serviceDate: date, validityDays: 30, dueDays: 30, depositPct: 30,
    seller: { name: '', ei: true, address: '', siret: '', email: '', phone: '', ...seller },
    client: { name: '', address: '', siren: '', contact: '', ...client },
    lines: [{ label: PRICE_GRID.site.label, qty: 1, price: PRICE_GRID.site.price }],
    vatFranchise: true, vatRate: 20,
    payment: 'Paiement par virement bancaire.',
    bank: '',
    notes: 'Compris : une page, mise en ligne sur le domaine du client, textes et photos fournis par le client, deux séries de corrections. Délai : 10 jours ouvrés après réception des contenus. Le nom de domaine est réservé au nom du client.',
  };
}

export function totals(doc) {
  const lines = (doc.lines || []).map((l) => ({ ...l, qty: Number(l.qty) || 0, price: Number(l.price) || 0 })).map((l) => ({ ...l, total: Math.round(l.qty * l.price * 100) / 100 }));
  const ht = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
  const vat = doc.vatFranchise ? 0 : Math.round(ht * (Number(doc.vatRate) || 0)) / 100;
  const ttc = Math.round((ht + vat) * 100) / 100;
  const deposit = doc.type === 'devis' && Number(doc.depositPct) > 0 ? Math.round(ttc * Number(doc.depositPct)) / 100 : 0;
  return { lines, ht, vat, ttc, deposit };
}

/** What would make this document non-compliant or unusable. Shown in the form, never blocks the preview. */
export function issues(doc) {
  const out = [];
  if (!doc.seller.name.trim()) out.push('Ton nom et ton prénom manquent.');
  if (!/^\d{9}(\d{5})?$/.test(doc.seller.siret.replace(/\s/g, ''))) out.push('Ton SIREN (9 chiffres) ou SIRET (14 chiffres) manque : sans lui, tu ne peux pas facturer.');
  if (!doc.seller.address.trim()) out.push('Ton adresse manque.');
  if (!doc.client.name.trim() || !doc.client.address.trim()) out.push('Le nom et l’adresse du client sont obligatoires.');
  if (doc.type === 'facture' && !/^\d{9}(\d{5})?$/.test(doc.client.siren.replace(/\s/g, ''))) out.push('Ajoute le SIREN du client : il devient obligatoire avec la réforme de la facture électronique.');
  if (!doc.number.trim()) out.push('Il faut un numéro unique, dans une suite sans trou.');
  if (!totals(doc).lines.some((l) => l.label.trim() && l.total > 0)) out.push('Ajoute au moins une ligne avec un prix.');
  return out;
}
