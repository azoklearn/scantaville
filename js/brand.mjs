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

// Partner upsell: once the owner says yes, the user still has to BUILD the real site.
// Wording rule: never say or imply the prompts are free (they are a premium product); "premium" is the word.
export const UPSELL = {
  name: 'Movento',
  base: 'https://movento.dev/',
  kicker: 'Pour construire le vrai site',
  title: 'Des prompts premium, prêts à coller dans Lovable',
  text: 'Le patron a dit oui ? Colle le prompt dans Lovable, ajuste les textes et les photos : tu pars d’une base solide, pas d’une page blanche.',
  cta: 'Voir les prompts sur Movento',
};
export const upsellUrl = (placement) => `${UPSELL.base}?utm_source=${BRAND.slug}&utm_medium=app&utm_campaign=${encodeURIComponent(placement)}`;

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
  for (const a of root.querySelectorAll('[data-upsell]')) {
    a.href = upsellUrl(a.dataset.upsell); a.target = '_blank'; a.rel = 'noopener';
    const span = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
    a.replaceChildren(span('upsell-k', UPSELL.kicker), span('upsell-t', UPSELL.title), span('upsell-x', UPSELL.text), span('upsell-go', UPSELL.cta + ' ↗'));
  }
  document.title = `${BRAND.name} · Les commerces sans site web de ta ville`;
}
