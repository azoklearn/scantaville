// The quiz, screen by screen, in order. Rendered by js/app.mjs (renderFunnel / go).
// Types: single (one answer, auto-advance) · multi (several, then Continue) · scale · info (text + button)
//        text (free answer, skippable) · goal / analyze (built in index.html) · potential · email · beforeafter · plannow · final
// `other: true` adds "Ma réponse n'est pas dans la liste / Écris-la toi-même".
// Numbers shown here are real: shops stored in the database (cities scanned so far), real prices.

export const FUNNEL = [
  { id: 'age', type: 'single', kicker: 'Pour commencer', q: 'Tu as quel âge ?',
    opts: [['18-30', '18 – 30 ans'], ['31-60', '31 – 60 ans'], ['60+', '60 ans et plus']] },

  { id: 'proof', type: 'info', kicker: 'Tu n’es pas le premier', big: '+15 000',
    title: 'commerces sans site déjà repérés par ScanTaVille.',
    body: 'Dans 66 villes de France. Chacun est un client potentiel, et son site est déjà prêt à lui être montré.', cta: 'Continuer' },

  { id: 'xp', type: 'single', kicker: 'Ton parcours', q: 'Depuis combien de temps tu vends des sites ou des services ?',
    opts: [['never', 'Je n’en ai jamais fait'], ['lt1', 'Depuis moins d’un an'], ['1to3', 'Entre 1 et 3 ans']] },

  { id: 'explain', type: 'info', kicker: 'En trente secondes', title: 'Vendre des sites, c’est quoi ?',
    body: 'Des centaines de commerces de ta ville n’ont pas de site web et perdent des clients chaque jour. ScanTaVille te les montre sur une carte et génère leur site en une seconde. Toi, tu le leur montres sur ton téléphone, et tu le vends.',
    points: [
      ['Un site vendu, c’est 300 à 800 €', 'Payé une fois par le commerçant. À 400 € le site, 5 ventes font 2 000 €.'],
      ['Le revenu peut se répéter', 'Propose l’entretien du site à 20 € par mois : 50 clients, c’est 1 000 € qui tombent chaque mois.'],
    ], cta: 'Compris' },

  { id: 'dream', type: 'single', other: true, kicker: 'Ce qui te fait avancer', q: 'Quel est ton rêve ultime ?',
    opts: [['1k', 'Faire mes premiers 1 000 €'], ['free', 'Être libre financièrement'], ['parents', 'Rendre mes parents fiers'], ['quitjob', 'Quitter mon travail'], ['quitschool', 'Arrêter les études']] },

  { id: 'block', type: 'single', other: true, kicker: 'Ce qui bloque', q: 'Qu’est-ce qui t’empêche d’atteindre ce rêve ?',
    opts: [['method', 'Le manque de méthode'], ['focus', 'J’ai du mal à me concentrer'], ['tried', 'J’essaie, mais je n’y arrive pas'], ['start', 'Je commence tout juste']] },

  { id: 'grit', type: 'single', kicker: 'Ton tempérament', q: 'Je suis du genre à persévérer même quand c’est dur.',
    opts: [['1', 'Pas du tout'], ['2', 'Plutôt non'], ['3', 'Je ne sais pas'], ['4', 'Plutôt oui'], ['5', 'Complètement']] },

  { id: 'hours', type: 'single', kicker: 'Ton carburant', q: 'Tu peux y consacrer combien d’heures par semaine ?',
    opts: [['3', 'Moins de 5 h'], ['10', '5 à 15 h'], ['20', 'Plus de 15 h']] },

  { id: 'goal', type: 'goal', kicker: 'Ton objectif' },
  { id: 'analyze', type: 'analyze', kicker: 'Analyse' },
  { id: 'potential', type: 'potential', kicker: 'Ton potentiel' },

  { id: 'missing', type: 'info', kicker: 'Ce qui te bloque', title: 'Il te manque la méthode et les outils clé en main.',
    body: 'Pas d’inquiétude : ScanTaVille s’occupe de tout à ta place.', cta: 'Continuer' },
  { id: 'welcome', type: 'info', kicker: 'Bienvenue', title: 'Bienvenue dans ScanTaVille.',
    body: 'La carte des commerces sans site de ta ville, leur site généré en une seconde, les scripts pour le leur vendre, et le plan de tes 30 premiers jours. Rien d’autre.', cta: 'Suivant' },
  { id: 'idea', type: 'info', kicker: 'Les clients', title: 'Trouve les commerces qui n’ont pas de site.',
    body: 'On scanne ta ville et on te montre chaque coiffeur, resto, boulangerie ou garage sans site web, avec son adresse, son téléphone et ses horaires.', cta: 'Suivant' },
  { id: 'site', type: 'info', kicker: 'Le site', title: 'Le site est déjà fait. Toi, tu le montres.',
    body: 'Pas besoin de savoir coder : on génère le site du commerce à son nom, adapté à son métier, prêt à être montré et mis en ligne.', cta: 'Suivant' },

  { id: 'email', type: 'email', kicker: 'Tes résultats' },
  { id: 'beforeafter', type: 'beforeafter', kicker: 'Avant, après' },

  { id: 'payout', type: 'single', kicker: 'Ton argent', q: 'Sur quoi tu veux recevoir tes paiements ?',
    opts: [['bank', 'Virement bancaire', null, '/img/pay/bank.svg'], ['paypal', 'PayPal', null, '/img/pay/paypal.svg'], ['revolut', 'Revolut', null, '/img/pay/revolut.svg'], ['wero', 'Lydia / Wero', null, '/img/pay/lydia.svg']] },
  { id: 'pain', type: 'multi', other: true, kicker: 'Ce qui pique', q: 'Qu’est-ce qui t’énerve le plus dans ta situation ?',
    opts: [['cap', 'Mes revenus sont plafonnés'], ['time', 'Je n’ai plus de temps à moi'], ['others', 'Je vois des gens réussir'], ['fomo', 'J’ai peur de rater le moment']] },
  { id: 'stopper', type: 'single', other: true, kicker: 'Le vrai blocage', q: 'Qu’est-ce qui t’a arrêté jusqu’ici ?',
    opts: [['clients', 'Trouver des clients'], ['build', 'Savoir faire un site'], ['sell', 'Oser vendre'], ['finish', 'Aller au bout']] },
  { id: 'limits', type: 'multi', other: true, kicker: 'Tes limites', q: 'Qu’est-ce que tu refuses de faire, même pour de l’argent ?',
    opts: [['door', 'Démarcher en boutique'], ['calls', 'Passer des appels'], ['video', 'Me montrer en vidéo'], ['none', 'Rien, je suis prêt à tout']] },
  { id: 'today', type: 'single', kicker: 'Ton objectif', q: 'À quoi t’attends-tu pour aujourd’hui ?',
    opts: [['clients', 'Trouver mes premiers clients'], ['site', 'Générer mon premier site'], ['sale', 'Faire ma première vente']] },
  { id: 'deep', type: 'single', other: true, kicker: 'La vie derrière l’argent', q: 'Et au fond, tu cherches quoi ?',
    opts: [['auto', 'Un revenu qui tombe chaque mois'], ['leave', 'Quitter ma situation actuelle'], ['freedom', 'Une liberté totale'], ['prove', 'Me prouver que j’en suis capable']] },
  { id: 'clock', type: 'single', kicker: 'Ton horloge', q: 'D’ici quand ça doit marcher ?',
    opts: [['today', 'Aujourd’hui'], ['1w', '1 semaine'], ['2w', '2 semaines'], ['1m', '1 mois']] },
  { id: 'target', type: 'single', kicker: 'Tes futurs clients', q: 'Tu préfères vendre à qui ?',
    opts: [
      ['local', 'Les commerces de quartier', 'Coiffeurs, boulangeries, fleuristes : un site simple, vendu 300 à 500 €. Il y en a des dizaines dans chaque ville.'],
      ['pro', 'Les pros et les artisans', 'Restos, garages, artisans : des sites plus complets, vendus 600 € et plus. Moins nombreux, plus rentables.'],
    ] },
  { id: 'words', type: 'text', kicker: 'Tes mots', q: 'Décris en une phrase la situation où tu veux être dans un an.',
    ph: 'Ex : je veux 2 000 € par mois en vendant des sites, pour ne plus dépendre de mon employeur.' },
  { id: 'cap', type: 'info', kicker: 'Ton cap', title: 'C’est tout à fait réaliste.', body: 'Et on va le faire avec toi.', cta: 'Continuer' },
  { id: 'now', type: 'plannow', kicker: 'Ce qu’on fait maintenant' },
  { id: 'final', type: 'final', kicker: 'Ce qui te sépare de tout ça' },
];

/** asked while the analysis runs: it stops, waits for the answer, then resumes */
export const ANALYSIS_QUESTIONS = [
  { id: 'start', q: 'Tu veux commencer quand ?', opts: [['asap', '⚡', 'Maintenant'], ['now', '🔥', 'Cette semaine'], ['month', '📅', 'Ce mois-ci'], ['later', '👀', 'Je découvre']] },
  { id: 'how', q: 'Tu préfères trouver tes clients comment ?', opts: [['door', '🚪', 'En passant en boutique'], ['dm', '💬', 'Par message Insta / Facebook'], ['phone', '📞', 'Par téléphone'], ['unsure', '🤔', 'Je ne sais pas encore']] },
];

/** shown in turn under the analysis (real facts, no invented testimonials) */
export const ANALYSIS_FACTS = [
  '+15 000 commerces sans site déjà repérés dans 66 villes',
  'Un site de commerce se vend souvent entre 300 et 800 €',
  'Le site d’un commerce est généré en 1 seconde',
  '1 seul site vendu rembourse 13 fois la formule Pro',
];
