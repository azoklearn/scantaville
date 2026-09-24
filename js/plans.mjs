// The offer, in one place: prices, billing periods, what each plan unlocks, and the checkout links.
// Each plan includes everything the plan below has (level 1 < 2 < 3). Level 0 = free.
//
// To go live: paste the payment page of each plan (Whop, Stripe Payment Link...) in `checkoutUrl`.
// While it is empty, the button collects an e-mail for the waiting list instead.

export const PLANS = [
  {
    id: 'm1', level: 1, name: 'Essentiel', period: '1 mois', cycle: 'par mois, sans engagement',
    price: 19.9, months: 1, checkoutUrl: 'https://whop.com/checkout/plan_kNW3NHWQg9Ty1/',
    pitch: 'Pour tester sur ta ville et décrocher un premier rendez-vous.',
    perks: [
      { text: '20 commerces débloqués par ville' },
      { text: '10 maquettes de sites par jour' },
      { text: '3 styles par commerce' },
      { text: 'Scripts « en boutique » et DM Insta' },
      { text: 'Suivi complet : contacté, RDV, signé' },
    ],
  },
  {
    id: 'm3', level: 2, name: 'Pro', period: '3 mois', cycle: 'tous les 3 mois',
    price: 29.9, months: 3, checkoutUrl: 'https://whop.com/checkout/plan_m05UMVsdrVkG9/', popular: true,
    pitch: 'Le temps qu’il faut pour signer un premier client : compte ~2 contacts.',
    perks: [
      { text: 'Tout Essentiel' },
      { text: '100 commerces débloqués par ville' },
      { text: 'Maquettes illimitées, sans la mention « générée avec ScanTaVille »' },
      { text: 'Les 6 styles par commerce' },
      { text: 'Tous les scripts : e-mail, appel, réponses aux objections' },
      { text: 'Devis et factures en PDF, mentions obligatoires incluses' },
      { text: 'Export CSV de tes prospects et kit légal' },
      { text: 'Export du site vendu, prêt à héberger', soon: true },
    ],
  },
  {
    id: 'y1', level: 3, name: 'Illimité', period: '1 an', cycle: 'par an',
    price: 79, months: 12, checkoutUrl: 'https://whop.com/checkout/plan_5cYuHjzfNRNQ4/',
    pitch: 'Pour en faire une vraie activité, toute l’année, dans plusieurs villes.',
    perks: [
      { text: 'Tout Pro' },
      { text: 'Tous les commerces de chaque ville, sans limite' },
      { text: 'Ta ville pré-scannée sur demande, domaines vérifiés' },
      { text: 'Accès en avant-première aux nouveautés' },
    ],
  },
];

export const FREE = {
  id: 'free', level: 0, name: 'Découverte',
  perks: ['Scanne n’importe quelle ville', 'Vois combien de commerces n’ont pas de site', 'La carte de ta ville à partager'],
};

/** Quotas by plan level [free, Essentiel, Pro, Illimité]. */
export const LIMITS = {
  leadsPerCity: [0, 20, 100, Infinity],   // shops a user can open per city scan (the map still shows them all)
  demosPerDay:  [0, 10, Infinity, Infinity],   // nothing without a plan: the free scan only shows how many shops there are
  styles:       [2, 3, 6, 6],             // looks reachable with "Autre style"
};
export const limitFor = (kind, level) => LIMITS[kind][Math.max(0, Math.min(3, level))];

/** sales-script channel -> lowest plan level */
export const SCRIPT_LEVEL = { walkin: 1, dm: 1, email: 2, call: 2, objections: 2 };

/** feature -> lowest plan level that unlocks it */
export const FEATURES = {
  fullPipeline: 1,
  noBadge: 2, csvExport: 2, legalKit: 2, invoicing: 2, siteExport: 2,
  cityOnDemand: 3,
};


const eur = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
export const priceLabel = (p) => eur(p.price);
export const perMonthLabel = (p) => eur(Math.round((p.price / p.months) * 100) / 100);
/** saving versus paying the monthly plan for the same duration, in % (0 for the monthly plan) */
export function savingPct(p) {
  const monthly = PLANS[0].price * p.months;
  return Math.max(0, Math.round((1 - p.price / monthly) * 100));
}
export const planById = (id) => PLANS.find((p) => p.id === id) || null;
export const planForFeature = (feature) => PLANS.find((p) => p.level >= (FEATURES[feature] || 1)) || PLANS[0];
export const planForLevel = (level) => PLANS.find((p) => p.level >= level) || PLANS[PLANS.length - 1];
