// French copy for the demo site. Pure data + tiny helpers, no DOM.
//
// Honesty rules for everything in here (this is a MOCK-UP of a real shop we know almost nothing about):
//   - no prices, no "depuis 1987", no "fait maison", no "meilleur", no opening promises, no reviews;
//   - only generic categories of the trade, presented as a layout the owner will replace;
//   - every services block ends with a note saying so.

/** Per template family. */
export const FAMILY_COPY = {
  salon: {
    servicesTitle: 'Prestations', servicesKicker: 'La carte du salon', slot: 'Votre tarif',
    note: 'Exemple de présentation : vos prestations et vos tarifs prendront place ici.',
    hoursTitle: 'Horaires', locTitle: 'Nous trouver', contactTitle: 'Prendre contact',
  },
  table: {
    servicesTitle: 'La carte', servicesKicker: 'À table', slot: 'Votre carte',
    note: 'Exemple de présentation : votre carte et vos prix prendront place ici.',
    hoursTitle: 'Horaires', locTitle: 'Venir', contactTitle: 'Contact',
  },
  fournil: {
    servicesTitle: 'Nos spécialités', servicesKicker: 'En boutique', slot: 'Votre sélection',
    note: 'Exemple de présentation : vos produits et vos spécialités prendront place ici.',
    hoursTitle: 'Horaires d’ouverture', locTitle: 'Où nous trouver', contactTitle: 'Nous joindre',
  },
  atelier: {
    servicesTitle: 'Prestations', servicesKicker: 'Ce que nous faisons', slot: 'À compléter',
    note: 'Exemple de présentation : vos prestations et vos conditions prendront place ici.',
    hoursTitle: 'Horaires', locTitle: 'Accès', contactTitle: 'Contact',
  },
};

/** Per trade. items = [category, generic sub-categories]. */
export const TRADE_COPY = {
  coiffeur: {
    label: 'Salon de coiffure', tagline: 'Coupes, couleurs et soins, à deux pas de chez vous.',
    items: [
      ['Coupe & coiffage', 'Femme · Homme · Enfant'],
      ['Couleur & balayage', 'Coloration · Mèches · Patine'],
      ['Soins du cheveu', 'Soin profond · Rituel · Conseil'],
      ['Barbe & contours', 'Taille · Entretien'],
      ['Coiffure d’événement', 'Mariage · Chignon · Essai'],
    ],
  },
  beaute: {
    label: 'Institut de beauté', tagline: 'Un moment rien que pour vous.',
    items: [
      ['Soins du visage', 'Nettoyage · Hydratation · Éclat'],
      ['Épilations', 'Visage · Corps'],
      ['Mains & pieds', 'Manucure · Pose de vernis · Beauté des pieds'],
      ['Regard', 'Cils · Sourcils'],
      ['Modelages & détente', 'Dos · Corps · Duo'],
    ],
  },
  tatoueur: {
    label: 'Studio de tatouage', tagline: 'Votre projet, du croquis à la peau.',
    items: [
      ['Projets sur mesure', 'Échange · Croquis · Séance'],
      ['Flashs', 'Motifs prêts à tatouer'],
      ['Retouches & recouvrements', 'Reprise · Cover'],
      ['Soins & suivi', 'Conseils de cicatrisation'],
      ['Rendez-vous', 'Par téléphone ou par message'],
    ],
  },
  restaurant: {
    label: 'Restaurant', tagline: 'La table vous attend.',
    items: [
      ['Entrées', 'Pour commencer'],
      ['Plats', 'Le cœur de la carte'],
      ['Desserts', 'Pour finir en douceur'],
      ['Formules', 'Midi · Soir'],
      ['Vins & boissons', 'La sélection de la maison'],
    ],
  },
  bar: {
    label: 'Bar', tagline: 'On se retrouve au comptoir ?',
    items: [
      ['Bières', 'Pression · Bouteilles'],
      ['Cocktails', 'Classiques · Créations'],
      ['Vins', 'Au verre · À la bouteille'],
      ['Sans alcool', 'Softs · Mocktails'],
      ['À grignoter', 'Planches · Tapas'],
    ],
  },
  cafe: {
    label: 'Café', tagline: 'Une pause, un café, et le reste attendra.',
    items: [
      ['Cafés & boissons chaudes', 'Espresso · Crème · Thé · Chocolat'],
      ['Boissons fraîches', 'Jus · Sodas · Sirops'],
      ['Petit-déjeuner', 'Viennoiseries · Tartines'],
      ['Sur le pouce', 'Salé · Sucré'],
      ['Apéritif', 'Vins · Bières'],
    ],
  },
  fastfood: {
    label: 'Snack', tagline: 'Une petite faim ? C’est par ici.',
    items: [
      ['À la carte', 'Vos recettes phares'],
      ['Menus', 'Formules complètes'],
      ['Accompagnements', 'Frites · Salades'],
      ['Boissons', 'Fraîches · Chaudes'],
      ['Desserts', 'Pour la route'],
    ],
  },
  boulangerie: {
    label: 'Boulangerie', tagline: 'Le pain du quartier, tout simplement.',
    items: [
      ['Pains', 'Tradition · Campagne · Spéciaux'],
      ['Viennoiseries', 'Croissants · Pains au chocolat · Brioches'],
      ['Pâtisseries', 'Tartes · Entremets · Classiques'],
      ['Snacking', 'Sandwichs · Salades · Quiches'],
      ['Sur commande', 'Gâteaux · Pièces montées'],
      ['Pour vos événements', 'Buffets · Plateaux'],
    ],
  },
  boucherie: {
    label: 'Boucherie · Traiteur', tagline: 'Votre boucher, tout près de chez vous.',
    items: [
      ['Boucherie', 'Bœuf · Veau · Agneau · Porc'],
      ['Volailles', 'Entières · Découpes'],
      ['Charcuterie', 'Jambons · Terrines · Saucisses'],
      ['Rayon traiteur', 'Plats cuisinés · Entrées'],
      ['Sur commande', 'Plateaux · Pièces festives'],
      ['Pour le barbecue', 'Brochettes · Grillades'],
    ],
  },
  epicerie: {
    label: 'Épicerie', tagline: 'De bonnes choses, près de chez vous.',
    items: [
      ['Épicerie salée', 'Conserves · Huiles · Condiments'],
      ['Épicerie sucrée', 'Confitures · Biscuits · Chocolats'],
      ['Cave & boissons', 'Vins · Bières · Jus'],
      ['Produits frais', 'Fromages · Charcuteries'],
      ['Coffrets cadeaux', 'À composer en boutique'],
      ['Arrivages', 'Les nouveautés du moment'],
    ],
  },
  fleuriste: {
    label: 'Fleuriste', tagline: 'Des fleurs pour le dire.',
    items: [
      ['Bouquets', 'De saison · Sur mesure'],
      ['Plantes', 'Intérieur · Extérieur'],
      ['Compositions', 'Centres de table · Cadeaux'],
      ['Mariages & événements', 'Bouquet de mariée · Décor'],
      ['Deuil', 'Gerbes · Coussins · Hommages'],
      ['Commandes', 'Par téléphone ou en boutique'],
    ],
  },
  garage: {
    label: 'Garage', tagline: 'Entretien et réparation, sans détour.',
    items: [
      ['Entretien & révision', 'Vidange · Filtres · Contrôles'],
      ['Freinage & pneumatiques', 'Disques · Plaquettes · Montage'],
      ['Diagnostic', 'Électronique · Voyants'],
      ['Mécanique', 'Distribution · Embrayage'],
      ['Avant contrôle technique', 'Préparation · Contre-visite'],
    ],
  },
  artisan: {
    label: 'Artisan', tagline: 'Un savoir-faire, près de chez vous.',
    items: [
      ['Sur mesure', 'Votre projet, étudié avec vous'],
      ['Réparation', 'Remise en état · Entretien'],
      ['Dépannage', 'Interventions ponctuelles'],
      ['Conseil & devis', 'Sur simple appel'],
      ['Réalisations', 'Vos photos de travaux ici'],
    ],
  },
  mode: {
    label: 'Boutique', tagline: 'Votre boutique, à portée de main.',
    items: [
      ['Nouveautés', 'Les arrivages de la saison'],
      ['Sélection du moment', 'Les pièces mises en avant'],
      ['Accessoires', 'Pour compléter la tenue'],
      ['Idées cadeaux', 'À offrir ou à s’offrir'],
      ['Conseil en boutique', 'Tailles · Retouches · Commandes'],
    ],
  },
  commerce: {
    label: 'Commerce', tagline: 'Votre commerce de proximité.',
    items: [
      ['Nouveautés', 'Les dernières arrivées en boutique'],
      ['Sélection du moment', 'Les coups de cœur de la maison'],
      ['Idées cadeaux', 'Pour toutes les occasions'],
      ['Commandes', 'Sur demande, en boutique ou par téléphone'],
      ['Conseil', 'On vous guide sur place'],
    ],
  },
};

// The 15 trade keys are coarse (a chocolatier is filed under "boulangerie", a bookshop under
// "commerce"). When the shop NAME says what it is, trust the name: a wrong label would be an invented claim.
const REFINE = {
  boulangerie: [
    [/boulang.*patiss|patiss.*boulang/, { label: 'Boulangerie · Pâtisserie' }],
    [/boulang/, {}],
    [/chocolat/, { label: 'Chocolaterie', tagline: 'Le chocolat, tout simplement.', items: [['Tablettes', 'Noir · Lait · Blanc'], ['Bonbons de chocolat', 'Ganaches · Pralinés'], ['Confiseries', 'Pâtes de fruits · Caramels'], ['Coffrets', 'À composer en boutique'], ['Fêtes', 'Pâques · Noël'], ['Sur commande', 'Cadeaux · Événements']] }],
    [/glac(e|ier)|gelat/, { label: 'Glacier', tagline: 'Une boule, deux boules ?', items: [['Glaces', 'Vos parfums ici'], ['Sorbets', 'Vos parfums ici'], ['Coupes', 'À déguster sur place'], ['À emporter', 'Pots · Bacs'], ['Boissons', 'Fraîches · Chaudes'], ['Sur commande', 'Desserts glacés']] }],
    [/confiser/, { label: 'Confiserie' }],
    [/patisser|patiss/, { label: 'Pâtisserie' }],
  ],
  boucherie: [
    [/boucher/, {}],
    [/fromage|cremerie/, { label: 'Fromagerie', tagline: 'Le plateau commence ici.', items: [['Fromages de vache', 'Votre sélection'], ['Fromages de chèvre', 'Votre sélection'], ['Fromages de brebis', 'Votre sélection'], ['Crèmerie', 'Beurre · Crème · Œufs'], ['Plateaux', 'Sur commande'], ['Cave & épicerie', 'Pour accompagner']] }],
    [/poisson|maree|ecaill|coquillage/, { label: 'Poissonnerie', tagline: 'La marée, près de chez vous.', items: [['Poissons', 'Entiers · Filets'], ['Coquillages', 'Huîtres · Moules'], ['Crustacés', 'Selon arrivage'], ['Rayon traiteur', 'Vos préparations à présenter ici'], ['Plateaux', 'Sur commande'], ['Conseil', 'Préparation · Cuisson']] }],
    [/traiteur|delicatess/, { label: 'Traiteur' }],
    [/charcut/, { label: 'Charcuterie · Traiteur' }],
  ],
  epicerie: [
    [/\bcaves?\b|caviste|\bvins?\b|vignoble/, { label: 'Cave', tagline: 'La bonne bouteille, au bon moment.', items: [['Vins rouges', 'Votre sélection'], ['Vins blancs & rosés', 'Votre sélection'], ['Bulles', 'Champagnes · Crémants'], ['Bières & spiritueux', 'Votre sélection'], ['Coffrets', 'À offrir'], ['Conseil', 'Accords · Événements']] }],
    [/primeur|fruits|legumes|verger|potager/, { label: 'Primeur', tagline: 'Fruits et légumes, près de chez vous.', items: [['Fruits', 'Au fil des saisons'], ['Légumes', 'Au fil des saisons'], ['Herbes & aromates', 'Votre sélection'], ['Épicerie', 'Pour accompagner'], ['Paniers', 'Sur commande'], ['Arrivages', 'Les nouveautés du moment']] }],
    [/torref|brulerie/, { label: 'Torréfacteur' }],
    [/herbor/, { label: 'Herboristerie' }],
    [/\bbio\b/, { label: 'Épicerie bio' }],
    [/\bfine\b|delices|saveur|gourm/, { label: 'Épicerie fine' }],
  ],
  fleuriste: [
    [/jardin|pepinier/, { label: 'Jardinerie' }],
  ],
  garage: [
    [/moto|scoot|2 ?roues|deux roues/, { label: 'Atelier moto' }],
    [/velo|cycle|bike/, { label: 'Atelier vélo', tagline: 'Vente, entretien, réparation.', items: [['Entretien', 'Réglages · Révision'], ['Réparation', 'Freins · Transmission · Roues'], ['Vélos', 'Ville · Route · Tout-terrain'], ['Assistance électrique', 'Conseil · Diagnostic'], ['Accessoires', 'Casques · Antivols · Éclairage']] }],
    [/pneu/, { label: 'Pneumatiques' }],
    [/carross/, { label: 'Carrosserie' }],
  ],
  artisan: [
    [/cordonn/, { label: 'Cordonnerie' }], [/serrur|clef|cles\b/, { label: 'Serrurerie' }], [/menuis|ebenist/, { label: 'Menuiserie' }],
    [/plomb/, { label: 'Plomberie' }], [/electri/, { label: 'Électricité' }], [/coutur|retouch/, { label: 'Couture · Retouches' }],
    [/tapiss/, { label: 'Tapisserie' }], [/horlog/, { label: 'Horlogerie' }], [/bijou|joaill/, { label: 'Bijouterie' }],
    [/ceram|poterie/, { label: 'Céramique' }], [/encadr/, { label: 'Encadrement' }], [/photo/, { label: 'Photographe' }],
    [/repar/, { label: 'Atelier de réparation' }],
  ],
  mode: [
    [/bijou|joaill/, { label: 'Bijouterie' }], [/chauss|soulier/, { label: 'Chaussures' }], [/maroquin|\bsacs?\b/, { label: 'Maroquinerie' }],
    [/friperie|vintage|seconde main|depot/, { label: 'Friperie' }], [/horlog|montre/, { label: 'Horlogerie' }],
    [/lingerie/, { label: 'Lingerie' }], [/enfant|bebe|kids/, { label: 'Mode enfant' }], [/retouch|tailleur|coutur/, { label: 'Tailleur · Retouches' }],
    [/pret a porter|\bmode\b|vetement|dressing/, { label: 'Prêt-à-porter' }],
  ],
  commerce: [
    [/librair|livres?\b|bouquin/, { label: 'Librairie', tagline: 'Des livres, et quelqu’un pour en parler.', items: [['Littérature', 'Romans · Poches'], ['Jeunesse', 'Albums · Premières lectures'], ['Bande dessinée', 'BD · Mangas · Comics'], ['Essais & beaux livres', 'Votre sélection'], ['Commandes', 'Sur demande, en boutique']] }],
    [/jouet|jeux|ludi/, { label: 'Jeux & jouets' }], [/\bdeco|decoration|interieur/, { label: 'Décoration' }], [/meuble|literie/, { label: 'Ameublement' }],
    [/antiq|brocant/, { label: 'Antiquités · Brocante' }], [/galerie|\bart\b/, { label: 'Galerie' }], [/musique|disque|vinyl/, { label: 'Musique' }],
    [/pressing|laverie|blanchiss/, { label: 'Pressing' }], [/toilett|animal|canin/, { label: 'Animalerie · Toilettage' }],
    [/mercerie|tissu|laine/, { label: 'Mercerie' }], [/papeter/, { label: 'Papeterie' }], [/quincaill|bricol|droguer/, { label: 'Quincaillerie' }],
    [/sport/, { label: 'Articles de sport' }], [/cadeau|souvenir/, { label: 'Cadeaux' }], [/informat|telephon|\bmobile/, { label: 'Informatique · Téléphonie' }],
    [/concept/, { label: 'Concept store' }],
  ],
  restaurant: [
    [/pizz/, { label: 'Pizzeria' }], [/creper/, { label: 'Crêperie' }], [/brasserie/, { label: 'Brasserie' }], [/bistro/, { label: 'Bistrot' }],
    [/sushi/, { label: 'Restaurant japonais' }], [/auberge/, { label: 'Auberge' }],
  ],
  bar: [
    [/\bcaves?\b|\bvins?\b/, { label: 'Bar à vins' }], [/pub\b/, { label: 'Pub' }], [/brasserie/, { label: 'Brasserie' }], [/cocktail/, { label: 'Bar à cocktails' }],
    [/tabac/, { label: 'Bar · Tabac' }],
  ],
  cafe: [
    [/salon de the/, { label: 'Salon de thé' }], [/coffee/, { label: 'Coffee shop' }],
  ],
  fastfood: [
    [/pizz/, { label: 'Pizzeria' }], [/kebab/, { label: 'Kebab' }], [/burger/, { label: 'Burgers' }], [/tacos/, { label: 'Tacos' }],
    [/sushi/, { label: 'Sushi' }], [/sandwich/, { label: 'Sandwicherie' }], [/friterie|frite/, { label: 'Friterie' }], [/poulet|chicken/, { label: 'Poulet' }],
  ],
  coiffeur: [[/barb(i|e)er|barber/, { label: 'Barbier', items: [['Coupe homme', 'Ciseaux · Tondeuse'], ['Barbe', 'Taille · Rasage · Contours'], ['Coupe + barbe', 'La formule complète'], ['Soins', 'Visage · Cheveux'], ['Enfants', 'Coupe junior']] }]],
  beaute: [[/ongl|nail/, { label: 'Onglerie' }], [/spa\b|massage|bien.etre/, { label: 'Spa · Bien-être' }], [/parfum/, { label: 'Parfumerie' }], [/barb/, { label: 'Barbier' }]],
  tatoueur: [[/pierc/, { label: 'Tatouage · Piercing' }]],
};

function plain(s) { return String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); }

/** Trade copy, refined by what the shop name says. Always returns { label, tagline, items }. */
export function copyFor(trade, name) {
  const base = TRADE_COPY[trade] || TRADE_COPY.commerce;
  const n = plain(name || '');
  for (const [re, patch] of REFINE[trade] || []) if (re.test(n)) return { ...base, ...patch };
  return base;
}

const CUISINE = {
  french: 'Cuisine française', italian: 'Cuisine italienne', pizza: 'Pizzas', pasta: 'Pâtes', japanese: 'Cuisine japonaise',
  sushi: 'Sushis', ramen: 'Ramen', chinese: 'Cuisine chinoise', vietnamese: 'Cuisine vietnamienne', thai: 'Cuisine thaïe',
  korean: 'Cuisine coréenne', asian: 'Cuisine asiatique', indian: 'Cuisine indienne', lebanese: 'Cuisine libanaise',
  turkish: 'Cuisine turque', kebab: 'Kebab', moroccan: 'Cuisine marocaine', couscous: 'Couscous', oriental: 'Cuisine orientale',
  african: 'Cuisine africaine', mexican: 'Cuisine mexicaine', tacos: 'Tacos', spanish: 'Cuisine espagnole', tapas: 'Tapas',
  portuguese: 'Cuisine portugaise', greek: 'Cuisine grecque', mediterranean: 'Cuisine méditerranéenne', american: 'Cuisine américaine',
  burger: 'Burgers', steak_house: 'Grillades', barbecue: 'Grillades', grill: 'Grillades', chicken: 'Poulet', seafood: 'Fruits de mer',
  fish: 'Poissons', fish_and_chips: 'Fish & chips', regional: 'Cuisine régionale', crepe: 'Crêpes & galettes', breton: 'Cuisine bretonne',
  basque: 'Cuisine basque', corsican: 'Cuisine corse', alsatian: 'Cuisine alsacienne', savoyard: 'Cuisine savoyarde', creole: 'Cuisine créole',
  caribbean: 'Cuisine antillaise', sandwich: 'Sandwichs', bagel: 'Bagels', salad: 'Salades', vegetarian: 'Cuisine végétarienne',
  vegan: 'Cuisine végétale', international: 'Cuisine du monde', bistro: 'Cuisine de bistrot', brasserie: 'Brasserie', brunch: 'Brunch',
  coffee_shop: 'Coffee shop', ice_cream: 'Glaces', dessert: 'Desserts', cake: 'Pâtisseries', tea: 'Thés', friture: 'Friterie',
  noodle: 'Nouilles', poke: 'Poke bowls', lyonnaise: 'Cuisine lyonnaise', provencal: 'Cuisine provençale',
};

/** OSM cuisine value ("italian", "steak house") -> French label, or '' when unknown (then we show nothing). */
export function cuisineLabel(cu) {
  if (typeof cu !== 'string') return '';
  const k = plain(cu).trim().split(/[;,]/)[0].trim().replace(/[\s-]+/g, '_');
  return Object.hasOwn(CUISINE, k) ? CUISINE[k] : '';
}

const STOP = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'de', 'du', 'des', 'd', 'chez', 'au', 'aux', 'a', 'et', 'en', 'the', 'and', 'o']);

/** "Boulangerie Martin" -> "BM", "Chez Léa" -> "L", "L'Atelier du Pain" -> "AP". */
export function monogram(name, fallback = 'R') {
  const words = String(name || '').split(/[\s'’\-_/.,&+]+/u).filter(Boolean);
  const strong = words.filter((w) => !STOP.has(plain(w)) && /^[\p{L}\p{N}]/u.test(w));
  const pick = (strong.length ? strong : words).slice(0, 2);
  const out = pick.map((w) => Array.from(w)[0].toUpperCase()).join('');
  return out || fallback;
}

/** Built-in shops for previews (?sample=...). Fictional names; phone numbers from the ARCEP range reserved for fiction. */
export const SAMPLE_BY_FAMILY = { salon: 'coiffeur', table: 'restaurant', fournil: 'boulangerie', atelier: 'garage' };

const TOURS = { c: 'Tours', by: 'Noan' };
export const SAMPLES = {
  coiffeur:    { ...TOURS, n: 'Maison Léonie', a: '14 Rue des Halles, 37000 Tours', p: '02 61 91 00 14', h: 'Tu-Fr 09:30-19:00; Sa 09:00-17:00', la: 47.3936, lo: 0.6822, ig: 'https://www.instagram.com/maison.leonie', d: 'maison-leonie-tours.fr' },
  beaute:      { ...TOURS, n: 'L’Écrin', a: '6 Rue de la Scellerie, 37000 Tours', p: '02 61 91 00 22', h: 'Tu-Sa 10:00-19:00', la: 47.3951, lo: 0.6889, ig: 'https://www.instagram.com/lecrin.institut', d: 'institut-ecrin-tours.fr' },
  tatoueur:    { ...TOURS, n: 'Encre Noire', a: '31 Rue Colbert, 37000 Tours', p: '02 61 91 00 31', h: 'Tu-Sa 11:00-19:00', la: 47.3958, lo: 0.6905, ig: 'https://www.instagram.com/encrenoire.tattoo', d: 'encre-noire-tours.fr' },
  restaurant:  { ...TOURS, n: 'Le Comptoir des Halles', cu: 'french', a: '3 Place Gaston Paillhou, 37000 Tours', p: '02 61 91 00 03', h: 'Tu-Sa 12:00-14:00,19:00-22:00; Su 12:00-14:30', la: 47.3932, lo: 0.6806, fb: 'https://www.facebook.com/lecomptoirdeshalles', e: 'bonjour@comptoir-des-halles.fr', d: 'comptoir-des-halles-tours.fr' },
  bar:         { ...TOURS, n: 'Le Zinc', a: '9 Place Plumereau, 37000 Tours', p: '02 61 91 00 09', h: 'Tu-Th 17:00-01:00; Fr-Sa 17:00-02:00', la: 47.3946, lo: 0.6816, ig: 'https://www.instagram.com/lezinc.tours', d: 'le-zinc-tours.fr' },
  cafe:        { ...TOURS, n: 'Café Marcelle', a: '22 Rue Nationale, 37000 Tours', p: '02 61 91 00 22', h: 'Mo-Sa 08:00-18:30', la: 47.3929, lo: 0.6885, ig: 'https://www.instagram.com/cafe.marcelle', d: 'cafe-marcelle-tours.fr' },
  fastfood:    { ...TOURS, n: 'Chez Momo', cu: 'burger', a: '48 Rue du Grand Marché, 37000 Tours', p: '02 61 91 00 48', h: 'Mo-Su 11:30-14:30,18:30-23:00', la: 47.3940, lo: 0.6790, d: 'chez-momo-tours.fr' },
  boulangerie: { ...TOURS, n: 'Au Pain Doré', a: '27 Avenue de Grammont, 37000 Tours', p: '02 61 91 00 27', h: 'Mo-Sa 06:30-19:30; Su 07:00-13:00; We off', la: 47.3869, lo: 0.6899, fb: 'https://www.facebook.com/aupaindore.tours', d: 'au-pain-dore-tours.fr' },
  boucherie:   { ...TOURS, n: 'Boucherie Marchand', a: '5 Rue Bernard Palissy, 37000 Tours', p: '02 61 91 00 05', h: 'Tu-Sa 08:00-12:45,15:00-19:15; Su 08:00-12:30', la: 47.3912, lo: 0.6930, d: 'boucherie-marchand-tours.fr' },
  epicerie:    { ...TOURS, n: 'La Petite Réserve', a: '11 Rue du Commerce, 37000 Tours', p: '02 61 91 00 11', h: 'Tu-Sa 10:00-19:00', la: 47.3949, lo: 0.6846, ig: 'https://www.instagram.com/lapetitereserve', d: 'la-petite-reserve-tours.fr' },
  fleuriste:   { ...TOURS, n: 'Pétales & Compagnie', a: '18 Rue Marceau, 37000 Tours', p: '02 61 91 00 18', h: 'Tu-Sa 09:00-19:30; Su 09:00-13:00', la: 47.3921, lo: 0.6861, ig: 'https://www.instagram.com/petales.compagnie', d: 'petales-et-compagnie.fr' },
  garage:      { ...TOURS, n: 'Garage Bellier', a: '112 Rue Édouard Vaillant, 37000 Tours', p: '02 61 91 01 12', h: 'Mo-Fr 08:00-12:00,14:00-18:30; Sa 08:30-12:00', la: 47.3853, lo: 0.7008, fb: 'https://www.facebook.com/garagebellier', e: 'contact@garage-bellier.fr', d: 'garage-bellier-tours.fr' },
  artisan:     { ...TOURS, n: 'Atelier Rivière', a: '40 Rue Lamartine, 37000 Tours', p: '02 61 91 00 40', h: 'Mo-Fr 09:00-18:00', la: 47.3925, lo: 0.6772, d: 'atelier-riviere-tours.fr' },
  mode:        { ...TOURS, n: 'Rue Blanche', a: '8 Rue des Orfèvres, 37000 Tours', p: '02 61 91 00 08', h: 'Tu-Sa 10:30-19:00', la: 47.3953, lo: 0.6829, ig: 'https://www.instagram.com/rueblanche.boutique', d: 'rue-blanche-tours.fr' },
  commerce:    { ...TOURS, n: 'Librairie du Passage', a: '2 Passage du Pèlerin, 37000 Tours', p: '02 61 91 00 02', h: 'Tu-Sa 10:00-19:00', la: 47.3944, lo: 0.6853, ig: 'https://www.instagram.com/librairiedupassage', d: 'librairie-du-passage.fr' },
};
