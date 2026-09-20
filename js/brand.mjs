// The one place to rename the product. Everything visible (logo, title, footer, share card, file names) reads this.
// parts = the wordmark split into pieces; the piece at index `accent` is drawn in the brand blue.
export const BRAND = {
  name: 'ScanTaVille',
  parts: ['scan', 'ta', 'ville'],
  accent: 1,
  slug: 'scantaville',
  domain: 'scantaville.fr',
  optOutEmail: 'retrait@scantaville.fr',
};

/** Fills every [data-brand], [data-brand-mark], [data-brand-domain] and [data-brand-optout] node of the page. */
export function applyBrand(root = document) {
  for (const n of root.querySelectorAll('[data-brand]')) n.textContent = BRAND.name;
  for (const n of root.querySelectorAll('[data-brand-domain]')) n.textContent = BRAND.domain;
  for (const n of root.querySelectorAll('[data-brand-mark]')) {
    n.replaceChildren(...BRAND.parts.map((p, i) => {
      const s = document.createElement(i === BRAND.accent ? 'b' : 'span');
      s.textContent = p;
      return s;
    }));
  }
  for (const a of root.querySelectorAll('[data-brand-optout]')) {
    a.href = `mailto:${BRAND.optOutEmail}?subject=${encodeURIComponent('Retirer mon commerce')}`;
  }
  document.title = `${BRAND.name} · Les commerces sans site web de ta ville`;
}
