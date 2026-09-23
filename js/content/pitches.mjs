// Sales scripts: what turns a gold pin into a first client.
// Pure data + one tiny template engine. No DOM, no network, safe to import from Node or the browser.
//
// House rules baked into every script (do not remove them when editing the copy):
//   1. The first spoken / written words say who is talking ("je crée des sites web...").
//   2. Never pretend to be a customer, never say the site is online: it is a free mock-up ("maquette gratuite").
//   3. The mock-up is built from public info only (address, hours, phone). Prices, menus and photos are
//      still to be added WITH the owner, so the scripts never claim they are already in it.
//   4. Every DM and e-mail ends with the opt-out line. A "no" is final.
//   5. No income promise anywhere. "tu" towards our user, "vous" towards shop owners.
//   6. No result promise towards the owner either: a new site does not outrank directories on Google, so the
//      copy says what the site SHOWS, never where it ranks or how many clients it brings.
//   7. Anything sold as a paid option in starter.mjs (online booking, SMS reminder, order / quote form) is
//      called "en option" here, and the yearly domain fee is said out loud: "payé une fois" is only the site.
//   8. The domain is never "réservé" (nothing is registered): the owner registers it in their own name.
//   {prenom} must be the sender's real first name: CNIL expects every B2B message to say who sends it.
//
// Template syntax understood by fillTemplate():
//   {commerce} {prenom} {ville} {lien} {prix} {domaine} {metier}
//   [[ ...text with {vars}... ]]  optional block: removed entirely when any variable inside it is empty.
//   "de {ville}" / "à {ville}" are contracted the French way (d'Orléans, du Mans, au Havre, aux Sables...).

import { TRADES } from '../core/leads.mjs';

export const OPT_OUT = "Si ce n'est pas le moment, dites-le-moi et je ne vous relance pas.";

/** Tab order for the UI. Walk-in and DM come first on purpose: our users will not cold call. */
export const CHANNELS = [
  { key: 'walkin', label: 'En boutique' },
  { key: 'dm', label: 'DM Insta' },
  { key: 'email', label: 'E-mail' },
  { key: 'call', label: 'Appel' },
];

// ───────────────────────── Template engine ─────────────────────────

const DEFAULTS = { commerce: 'votre commerce', metier: 'commerce', prix: '490' };

// Noun that reads well after "votre ...". Keys = trade keys from leads.mjs AND their lowercased labels,
// because callers pass either one as {metier}.
const METIER_NOUN = {
  coiffeur: 'salon de coiffure',
  beaute: 'institut de beauté', 'institut de beauté': 'institut de beauté',
  tatoueur: 'salon de tatouage',
  restaurant: 'restaurant',
  bar: 'bar',
  cafe: 'café', 'café': 'café',
  fastfood: 'snack', snack: 'snack',
  boulangerie: 'boulangerie',
  boucherie: 'boucherie', 'boucherie / traiteur': 'boucherie',
  epicerie: 'épicerie', 'épicerie fine': 'épicerie',
  fleuriste: 'boutique de fleurs',
  garage: 'garage',
  artisan: 'entreprise',
  mode: 'boutique', 'boutique de mode': 'boutique',
  commerce: 'commerce',
};

/** "votre ___" noun for a trade key ("coiffeur" -> "salon de coiffure"). */
export function metierOf(trade) {
  return METIER_NOUN[String(trade || '').toLowerCase()] || DEFAULTS.metier;
}

const BLOCK_INNER = '((?:(?!\\[\\[|\\]\\])[\\s\\S])*?)';
const RE_BLOCK_LINE = new RegExp('^[ \\t]*\\[\\[' + BLOCK_INNER + '\\]\\][ \\t]*(\\r?\\n|$)', 'gm');
const RE_BLOCK = new RegExp('\\[\\[' + BLOCK_INNER + '\\]\\]', 'g');
const RE_VAR = /\{([a-zA-Z_]+)\}/g;
const RE_PREP = /(^|[^\p{L}])(de|à) \{(ville|commerce)\}/gu;
const GONE = String.fromCharCode(1); // marks where an optional block vanished, so the next word can be re-capitalised

function cleanVars(vars) {
  const out = {};
  for (const [k, v] of Object.entries(vars || {})) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) out[k] = s;
  }
  if (out.prix) out.prix = out.prix.replace(/\s*(€|eur|euros?)\s*$/i, '').trim();
  if (out.metier) out.metier = METIER_NOUN[out.metier.toLowerCase()] || out.metier;
  return out;
}

function contract(prep, val) {
  const art = /^(les|le)\s+(.+)$/i.exec(val);
  if (art) {
    const plural = art[1].toLowerCase() === 'les';
    return (prep === 'de' ? (plural ? 'des ' : 'du ') : (plural ? 'aux ' : 'au ')) + art[2];
  }
  if (prep === 'de' && /^[aeiouyàâäéèêëîïôöùûüœ]/i.test(val)) return "d'" + val;
  return prep + ' ' + val;
}

function tidy(s) {
  return s
    .replace(new RegExp('(^|\\n|[.!?…]\\s+|«\\s?)' + GONE + '\\s*(\\p{Ll})', 'gu'), (_, pre, ch) => pre + ch.toUpperCase())
    .replace(new RegExp(GONE, 'g'), '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/«\s*»/g, '')
    .replace(/ +,/g, ',')
    .replace(/ +\.(?=\s|$|[»)])/g, '.')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/,{2,}/g, ',')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n +/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fillString(str, rawVars) {
  const vars = cleanVars(rawVars);
  const keep = (inner) => {
    RE_VAR.lastIndex = 0;
    for (const m of inner.matchAll(RE_VAR)) if (!vars[m[1]]) return false;
    return true;
  };
  let s = String(str)
    .replace(RE_BLOCK_LINE, (_, inner, eol) => (keep(inner) ? inner + eol : ''))
    .replace(RE_BLOCK, (_, inner) => (keep(inner) ? inner : GONE))
    .replace(RE_PREP, (_, pre, prep, key) => {
      const val = vars[key] || (key === 'commerce' ? DEFAULTS.commerce : '');
      return pre + (val ? contract(prep, val) : '');
    })
    .replace(RE_VAR, (_, key) => vars[key] ?? DEFAULTS[key] ?? '');
  s = tidy(s);
  // a template that opens on a variable must still open on a capital letter
  if (/^\s*(\[\[)?\s*\{/.test(str)) s = s.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
  return s;
}

function printable(obj, render) {
  Object.defineProperty(obj, 'toString', { value: render, enumerable: false });
  return obj;
}

const emailToString = function () { return `Objet : ${this.subject}\n\n${this.body}`; };

/**
 * Fills a template. Accepts a string, an array of strings or an object of strings ({subject, body})
 * and returns the same shape. Arrays and objects come back with a readable toString(), so
 * `element.textContent = fillTemplate(PITCHES.salon.email, vars)` just works.
 */
export function fillTemplate(tpl, vars = {}) {
  if (tpl === null || tpl === undefined) return '';
  if (Array.isArray(tpl)) {
    const out = tpl.map((t) => fillTemplate(t, vars));
    return printable(out, function () { return this.join('\n'); });
  }
  if (typeof tpl === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(tpl)) out[k] = fillTemplate(v, vars);
    return printable(out, 'subject' in out && 'body' in out
      ? emailToString
      : function () { return Object.values(this).join('\n\n'); });
  }
  return fillString(tpl, vars);
}

// ───────────────────────── The scripts ─────────────────────────

const HELLO = "Bonjour, [[je m'appelle {prenom} et ]]je crée des sites web pour les commerces[[ de {ville}]].";
const NOT_FOUND = "Je n'ai pas trouvé de site pour {commerce}, alors je vous ai préparé une maquette gratuite";

/**
 * One family = one trade vocabulary + one real pain. The skeleton is shared so the house rules
 * (identify first, "maquette gratuite", nothing online, opt-out last) can never be forgotten in one variant.
 */
function family(f) {
  const walkin = [
    `1. OUVRIR (${f.when}) — « ${HELLO} Je ne viens pas ${f.notHereFor} : j'ai préparé quelque chose pour votre {metier}. Vous avez deux minutes ? »`,
    `2. MONTRER — Tends ton téléphone : « C'est une maquette gratuite de site pour votre {metier}, faite avec vos infos publiques : adresse, horaires, téléphone. Il reste à y mettre ${f.toAdd}. Rien n'est en ligne, c'est juste pour vous montrer. »`,
    `3. LA QUESTION — « ${f.question} » ${f.afterQuestion}`,
    `4. RÉPONDRE — « ${f.answer} »`,
    `5. LE PRIX — « Le site, c'est {prix} €, payé une fois, avec un devis écrit. ${f.option} Le nom de domaine, vous le prenez à votre nom, une dizaine d'euros par an : il reste à vous quoi qu'il arrive.[[ J'ai regardé, {domaine} a l'air encore libre.]] »`,
    `6. CONCLURE — « Je vous envoie le lien de la maquette, ${f.lookWhen} ? Je peux repasser en fin de semaine, si vous voulez. Et si ça ne vous dit rien, dites-le-moi, je ne vous relance pas. »`,
  ].join('\n');

  const dm = [
    `Bonjour, [[ici {prenom}, ]]je crée des sites web[[ à {ville}]]. ${NOT_FOUND}. Rien n'est en ligne.`,
    '[[{lien}]]',
    `${f.dmPain}[[ Et {domaine} a l'air libre.]] ${OPT_OUT}`,
  ].join('\n');

  const email = printable({
    subject: f.subject,
    body: [
      'Bonjour,',
      '',
      `[[Je m'appelle {prenom} et ]]je crée des sites web[[ à {ville}]]. ${NOT_FOUND} à partir de vos infos publiques. Rien n'est en ligne.`,
      '',
      '[[{lien}\n\n]]' + f.mailPain,
      '',
      `Si elle vous plaît : {prix} € le site, payé une fois, sur devis. Le nom de domaine[[ ({domaine} a l'air libre)]] serait à votre nom. Je peux passer vous la montrer ${f.calm}.`,
      '',
      'Bonne journée,',
      '[[{prenom}]]',
      '',
      `PS : ${OPT_OUT[0].toLowerCase()}${OPT_OUT.slice(1)}`,
    ].join('\n'),
  }, emailToString);

  const call = [
    `« Bonjour, [[{prenom} à l'appareil, ]]je crée des sites web pour les commerces[[ de {ville}]]. Je ne vous appelle pas ${f.notCallingFor}, j'en ai pour trente secondes. ${NOT_FOUND}. Rien n'est en ligne. ${f.callPain} Je vous envoie le lien, ou je passe vous la montrer ${f.calm} ? »`,
    '',
    "S'IL EST OCCUPÉ — « Je comprends, je tombe mal. Je vous envoie juste le lien et vous regardez quand vous voulez ? Sinon je rappelle à l'heure qui vous arrange. »",
    "S'IL DIT NON — « Pas de souci, merci de m'avoir répondu. Je note de ne pas vous rappeler. Bonne journée ! »",
  ].join('\n');

  return { walkin, dm, email, call };
}

export const PITCHES = {
  // Coiffeurs, instituts, tatoueurs: bookings taken mid-appointment, and no-shows.
  salon: family({
    when: 'à une heure creuse, jamais un samedi après-midi',
    notHereFor: 'pour un rendez-vous',
    notCallingFor: 'pour un rendez-vous',
    toAdd: 'vos tarifs et vos photos',
    question: 'Quand le téléphone sonne alors que vous êtes en plein rendez-vous, vous faites comment ?',
    afterQuestion: 'Puis tais-toi et écoute.',
    answer: "Avec un site, vos tarifs, vos photos et vos horaires sont visibles à toute heure, ça peut déjà vous éviter des appels. Et si vous voulez, on ajoute la réservation en ligne, avec un rappel par SMS pour les clients qui oublient leur rendez-vous.",
    option: 'La réservation en ligne et le rappel par SMS, ce sont des options, chiffrées à part sur le devis.',
    lookWhen: 'vous regardez ça ce soir au calme',
    calm: 'à une heure calme',
    subject: 'Une maquette de site pour {commerce}',
    dmPain: 'Reste à y mettre vos tarifs, vos photos et, en option, la réservation en ligne.',
    mailPain: "Reste à y mettre vos tarifs et vos photos. La réservation en ligne, avec rappel par SMS, est possible en option.",
    callPain: "L'idée, c'est d'y mettre vos tarifs et vos photos, et en option la réservation en ligne, pour qu'on vous dérange moins en plein rendez-vous.",
  }),

  // Restaurants, bars, cafés, snacks: the menu, the real opening hours, outdated info on directories.
  table: family({
    when: 'entre deux services, jamais pendant le coup de feu',
    notHereFor: "en client aujourd'hui",
    notCallingFor: 'pour réserver',
    toAdd: 'votre carte et vos photos',
    question: 'Quand quelqu\'un cherche votre carte ou vos horaires sur Google, il tombe sur quoi ?',
    afterQuestion: 'Laisse-le vérifier sur son propre téléphone.',
    answer: "Avec un site à vous, il y a au moins un endroit où la carte, les horaires et les jours de fermeture viennent de vous, et pas d'un annuaire ou d'une plateforme à commission. Je ne vous promets pas la première place sur Google, mais l'info sera juste.",
    option: '',
    lookWhen: 'vous regardez ça après le service',
    calm: 'entre deux services',
    subject: 'Une maquette de site pour {commerce}',
    dmPain: 'Reste à y mettre votre carte, vos photos et vos vrais horaires.',
    mailPain: "Reste à y mettre votre carte et vos vrais horaires : une page où l'info vient de vous, pas d'un annuaire.",
    callPain: "L'idée, c'est d'y mettre votre carte, vos vrais horaires et vos jours de fermeture, pour avoir une page où l'info vient de vous, pas d'un annuaire.",
  }),

  // Boulangeries, bouchers-traiteurs, épiceries, fleuristes: orders for the big dates, and holiday closures.
  fournil: family({
    when: "au creux de l'après-midi, jamais quand il y a la queue",
    notHereFor: "en client aujourd'hui",
    notCallingFor: 'pour une commande',
    toAdd: 'vos spécialités, vos photos et vos dates de congés',
    question: 'Pour les fêtes, vos commandes, vous les prenez comment aujourd\'hui ?',
    afterQuestion: 'Carnet, téléphone, Messenger : laisse raconter.',
    answer: "Sur un site, vos horaires et vos congés sont affichés, ça évite des clients devant une porte fermée. Et si vous voulez, on ajoute un formulaire : les gens envoient leur commande, vous la recevez par e-mail, et vous avez moins à noter au téléphone en plein rush.",
    option: 'Le formulaire de commande, c\'est une option, chiffrée à part sur le devis.',
    lookWhen: 'vous regardez ça après la fermeture',
    calm: "au creux de l'après-midi",
    subject: 'Une maquette de site pour {commerce}',
    dmPain: 'Reste à y mettre vos spécialités, vos congés et, en option, un formulaire de commande.',
    mailPain: "Reste à y mettre vos spécialités, vos horaires et vos congés. Un formulaire pour les commandes des fêtes est possible en option.",
    callPain: "L'idée, c'est d'y mettre vos spécialités, vos horaires et vos congés, et en option un formulaire pour les commandes des fêtes.",
  }),

  // Garages, artisans (and, by default, shops): quotes, and trust before the first call.
  atelier: family({
    when: 'à un moment calme, pas en plein chantier ni les mains dans un moteur',
    notHereFor: "en client aujourd'hui",
    notCallingFor: 'pour un devis',
    toAdd: 'vos prestations et des photos de votre travail',
    question: 'Quelqu\'un qui ne vous connaît pas et qui compare sur son téléphone avant d\'appeler, il vous choisit comment ?',
    afterQuestion: 'Le bouche-à-oreille, souvent. Laisse-le le dire.',
    answer: "Un site, ça sert à rassurer avant le premier appel : qui vous êtes, ce que vous faites, en photos, et un lien vers vos avis. Le bouche-à-oreille continue, le site parle à ceux qui ne vous connaissent pas encore. Et si vous voulez, on ajoute un formulaire de demande de devis.",
    option: 'Le formulaire de demande de devis, c\'est une option, chiffrée à part.',
    lookWhen: 'vous regardez ça ce soir au calme',
    calm: 'à un moment calme',
    subject: 'Une maquette de site pour {commerce}',
    dmPain: 'Reste à y mettre vos prestations, vos photos et, en option, une demande de devis.',
    mailPain: "Reste à y mettre vos prestations et des photos de votre travail. Un formulaire de demande de devis est possible en option.",
    callPain: "L'idée, c'est d'y mettre vos prestations et des photos de votre travail, pour rassurer ceux qui ne vous connaissent pas encore, et en option une demande de devis en ligne.",
  }),
};

/**
 * Not a 5th template family: shops (trades "mode" and "commerce") render with the "atelier" demo template,
 * but talking about quotes to a bookshop sounds off. getPitch() serves this copy for those two trades.
 */
export const BOUTIQUE_PITCH = family({
  when: 'à une heure calme, jamais un samedi après-midi',
  notHereFor: "en client aujourd'hui",
  notCallingFor: 'pour un article',
  toAdd: 'vos nouveautés, vos marques et vos photos',
  question: 'Les gens qui ne vous suivent pas sur Insta, ils découvrent ce que vous vendez comment ?',
  afterQuestion: 'Puis tais-toi et écoute.',
  answer: 'Un site montre ce que vous vendez, vos marques, vos nouveautés et vos horaires à des gens qui n\'ont pas Insta. Insta reste pour vos abonnés, le site est là pour les autres.',
  option: '',
  lookWhen: 'vous regardez ça ce soir au calme',
  calm: 'à une heure calme',
  subject: 'Une maquette de site pour {commerce}',
  dmPain: 'Reste à y mettre vos nouveautés, vos marques et vos photos.',
  mailPain: "Reste à y mettre vos nouveautés, vos marques et vos photos, pour ceux qui ne vous suivent pas sur Insta.",
  callPain: "L'idée, c'est d'y mettre vos nouveautés, vos marques et vos horaires, pour ceux qui ne vous suivent pas sur Insta.",
});

/** Template family for a trade key from leads.mjs (or a family name passed through). */
export function familyOf(trade) {
  if (PITCHES[trade]) return trade;
  return TRADES[trade]?.tpl || 'atelier';
}

/**
 * Ready-to-show script. `trade` = a trade key ("coiffeur") or a family ("salon").
 * Always returns a string (the e-mail comes back as "Objet : ...\n\n body").
 */
export function getPitch(trade, channel, vars = {}) {
  const set = trade === 'mode' || trade === 'commerce' ? BOUTIQUE_PITCH : PITCHES[familyOf(trade)];
  const tpl = set?.[channel];
  if (!tpl) return '';
  const v = { ...vars };
  if (TRADES[trade]) v.metier = metierOf(trade);
  return String(fillTemplate(tpl, v));
}

// ───────────────────────── Objections ─────────────────────────
// q = what the owner says, a = an honest answer to say out loud (vouvoiement). No placeholders here.

export const OBJECTIONS = [
  {
    q: "J'ai déjà Facebook / Instagram",
    a: "Gardez-les, ils marchent bien pour vos habitués, et je mets les liens sur le site. Le site sert aux autres : ceux qui cherchent sur Google ou Maps et qui n'ont pas de compte. Et il est à vous : si un jour votre compte est bloqué, votre adresse, vos horaires et votre téléphone restent en ligne.",
  },
  {
    q: "C'est trop cher",
    a: "Je comprends. C'est un prix fixe, payé une fois, sans abonnement obligatoire, et le devis détaille tout, options comprises. À côté, il y a juste le nom de domaine, une dizaine d'euros par an, à votre nom. Comparez avec d'autres devis, c'est normal. On peut aussi régler en deux fois. Et si vous pensez que ça ne vous servira pas, ne le prenez pas : la maquette reste gratuite.",
  },
  {
    q: "Je n'ai pas le temps",
    a: "Justement, le plus gros est fait : la maquette existe déjà avec vos infos publiques. Il me faut une demi-heure avec vous pour vérifier les horaires et les textes, et quelques photos si vous en avez. Le reste, c'est mon travail.",
  },
  {
    q: 'Mon neveu va me le faire',
    a: "Très bien, s'il le fait, c'est parfait, et gardez la maquette comme modèle. Je vous laisse mon numéro, au cas où ça n'avance pas. Dans les deux cas, demandez que le nom de domaine soit à votre nom.",
  },
  {
    q: "J'ai déjà eu une mauvaise expérience",
    a: "Désolé pour ça, et vous avez raison d'être prudent. Avec moi : un devis écrit, un acompte à la commande et le solde à la mise en ligne, le nom de domaine à votre nom, et vous repartez avec les fichiers du site quand vous voulez. Vous ne dépendez pas de moi.",
  },
  {
    q: 'Je vais réfléchir',
    a: "Bien sûr. Je vous laisse le lien de la maquette, regardez-la tranquillement. Je peux repasser en fin de semaine, ou vous préférez me rappeler ? Et si c'est non, dites-le-moi simplement : je ne vous relance pas.",
  },
];

// ───────────────────────── Funnel assumption ─────────────────────────

export const FUNNEL = {
  contactsPerSale: 15,
  note: "Hypothèse d'illustration et non une promesse : on compte ici 1 vente pour 15 commerces contactés, mais ton résultat réel dépend de ton travail, de ta ville et de ta façon de présenter, et il peut très bien être de zéro.",
};
