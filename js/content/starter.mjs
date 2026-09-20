// "Vendre ton premier site légalement en France" : an ordered checklist for an 18-30 beginner.
// Pure data. Each item = { title, body, link?, linkLabel? }. `link` is always an official or first-party URL.
//
// Every legal statement below was checked in September 2026 against service-public.fr (entreprendre.service-public.gouv.fr),
// cnil.fr, impots.gouv.fr, urssaf.fr, inpi.fr, afnic.fr and legifrance.gouv.fr, then fact-checked a second time
// (19 Sept 2026). Thresholds and rates move every year: when you edit a number, re-check it and bump STARTER_CHECKED.
// Source pages per claim:
//   registration free / 83 600 € ceiling ........ entreprendre.service-public.gouv.fr/vosdroits/F23961
//   contribution rates, declaration at 0 € ...... /vosdroits/F36232
//   cumul salarié / étudiant / agent public ..... /vosdroits/F23264, F36612, F36610
//   invoice mentions + 4 new e-invoicing ones ... /vosdroits/F31808 ; invoicing rules, 10 years: F23208
//   VAT franchise 37 500 / 41 250 € ............. /vosdroits/F21746
//   293 B -> CIBS moved to 1 Jan 2027 ........... legifrance.gouv.fr/jorf/id/JORFTEXT000054497139 (ordonnance 2026-671)
//     (impots.gouv.fr and Légifrance do not show the same new article number yet: we deliberately print none)
//   devis mandatory only in listed sectors ...... /vosdroits/F31144
//   site legal notices + 1 an / 75 000 € ........ /vosdroits/F31228
//   RC Pro depends on the activity .............. /vosdroits/F23668
//   bookkeeping, bank account 10 000 € x 2 ...... /vosdroits/F23266
//   B2B e-mail / phone prospecting .............. the two "prospection commerciale" pages on cnil.fr
//   phone canvassing of consumers, 11 Aug 2026 .. entreprendre.service-public.gouv.fr/actualites/A18384
//   undeclared activity = travail dissimulé ..... urssaf.fr/accueil/travail-illegal.html

export const STARTER_CHECKED = '2026-09';

/** Suggested price grid. Market habits for a beginner, NOT an official scale and NOT an income promise. */
export const PRICE_GRID = {
  site: { label: 'Site vitrine une page, mis en ligne sur le domaine du client', price: 490, unit: '€' },
  maintenance: { label: 'Maintenance (petites modifications, surveillance du site et du domaine)', price: 29, unit: '€/mois' },
  options: [
    { label: 'Page supplémentaire', price: 90, unit: '€' },
    { label: 'Formulaire de commande ou de demande de devis', price: 90, unit: '€' },
    { label: 'Prise de rendez-vous en ligne via un outil tiers (avec rappel par SMS si l\'outil le permet)', price: 120, unit: '€' },
    { label: 'Séance photo sur place', price: 120, unit: '€' },
  ],
  note: "Exemples de prix pratiqués par des débutants, à adapter : tu fixes librement tes tarifs. Ce n'est ni un barème officiel ni un revenu garanti.",
};

export const STARTER = [
  {
    title: 'Déclare ta micro-entreprise (en ligne, gratuit)',
    body: "Pour vendre un site, il te faut un statut. Le plus simple pour démarrer : micro-entrepreneur. La déclaration de début d'activité se fait en ligne sur le guichet unique des formalités d'entreprises (formalites.entreprises.gouv.fr, géré par l'INPI). D'après service-public.fr, l'immatriculation d'une micro-entreprise est gratuite (seule exception : les agents commerciaux). Méfie-toi des sites privés qui font payer la même démarche. Ensuite, tu déclares ton chiffre d'affaires chaque mois ou chaque trimestre sur autoentrepreneur.urssaf.fr, même quand il est de 0 €. Tes cotisations sociales sont un pourcentage de ce que tu encaisses vraiment : en 2026, 25,6 % pour une activité libérale non réglementée ou 21,2 % pour une prestation de services commerciale ou artisanale, selon la catégorie dans laquelle ton activité est classée. Pas de vente, pas de cotisations. L'impôt sur le revenu n'est pas compris dans ces taux : il s'ajoute (sauf si tu as droit au versement libératoire et que tu le choisis, avec un taux un peu plus élevé). Cumul : d'après service-public.fr, un étudiant majeur peut être micro-entrepreneur, et un salarié aussi, à condition que son contrat n'ait pas de clause d'exclusivité, de travailler hors de son temps de travail et de ne pas concurrencer son employeur. Un agent public doit d'abord demander une autorisation écrite à sa hiérarchie.",
    link: 'https://formalites.entreprises.gouv.fr/',
    linkLabel: "Guichet unique des formalités d'entreprises",
  },
  {
    title: 'Pas de SIRET, pas de facture',
    body: "Une fois ta déclaration validée, l'Insee t'attribue un numéro SIREN (9 chiffres) et un SIRET (14 chiffres). Le délai varie : anticipe. Entre professionnels, la facture est obligatoire pour chaque prestation, et elle doit porter ton numéro SIREN : sans numéro, pas de facture conforme. Exercer une activité payée sans être immatriculé, c'est du travail dissimulé (dissimulation d'activité), et c'est sanctionné pénalement. Concrètement : tu peux préparer tes maquettes quand tu veux, mais fais ta déclaration avant de signer ton premier devis (tu choisis ta date de début d'activité dans le formulaire). Ton SIRET figure ensuite sur tes devis, tes factures et les mentions légales de ton propre site.",
    link: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23961',
    linkLabel: 'Comment devenir micro-entrepreneur (service-public.fr)',
  },
  {
    title: 'Un devis signé, puis un acompte',
    body: "La création de sites ne fait pas partie des activités pour lesquelles service-public.fr liste un devis obligatoire (dépannage, déménagement, services à la personne...), mais fais-en toujours un : c'est lui qui te protège, et qui protège le commerçant. Écris ce que tu livres (nombre de pages, qui fournit les textes et les photos, nombre d'allers-retours, délai), le prix, et ce qui n'est pas compris. Une fois daté et signé par le client avec la mention « Bon pour accord », il vous engage tous les deux. Mets-y les mêmes informations d'identité que sur tes factures (nom, « EI », SIREN, mention de TVA). Demande un acompte à la commande et le solde à la mise en ligne (30 à 50 % d'acompte est une habitude courante, pas une règle). Écris bien le mot « acompte » : un acompte est un engagement ferme des deux côtés, alors que des arrhes permettent à chacun de se désister. Chaque acompte encaissé donne lieu à une facture d'acompte, et la facture finale le déduit.",
    link: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F31187',
    linkLabel: 'Acompte, avance, arrhes : les différences (service-public.fr)',
  },
  {
    title: 'Ta facture : les mentions obligatoires',
    body: "Une facture conforme contient : un numéro unique dans une suite continue (pas de trou, pas de doublon), la date d'émission, la date de la prestation, ton nom et ton prénom suivis de « EI » ou « Entrepreneur individuel », ton adresse et ton numéro SIREN, le nom et l'adresse du client, le détail de chaque prestation (désignation précise, quantité, prix unitaire hors taxes), le total, la date d'échéance du paiement, le taux des pénalités de retard, l'indemnité forfaitaire de 40 € pour frais de recouvrement (client professionnel) et les conditions d'escompte (« Escompte pour paiement anticipé : néant » si tu n'en fais pas). En micro-entreprise, tu es en franchise en base de TVA tant que ton chiffre d'affaires reste sous les seuils (37 500 € par an en prestation de services en 2026, avec un seuil majoré à 41 250 €) : tu ne factures pas de TVA, ton prix est net, et tu dois écrire « TVA non applicable, art. 293 B du CGI ». Attention, cette référence va changer : les règles de TVA sont transférées dans un nouveau code (le CIBS) au 1er janvier 2027, date repoussée par une ordonnance du 27 juillet 2026 (elle était d'abord prévue au 1er septembre 2026). Avant d'éditer tes factures, vérifie la formule à jour sur impots.gouv.fr ou service-public.fr. Garde toutes tes factures 10 ans.",
    link: 'https://entreprendre.service-public.gouv.fr/vosdroits/F31808',
    linkLabel: 'Mentions obligatoires sur une facture (service-public.fr)',
  },
  {
    title: 'Facture électronique : prépare 2027',
    body: "La réforme de la facturation électronique concerne aussi les micro-entrepreneurs, même en franchise de TVA. Depuis le 1er septembre 2026, toute entreprise doit pouvoir recevoir des factures électroniques, la tienne comprise : dès ta création, choisis une plateforme agréée pour les recevoir (compare les offres, leurs tarifs varient). À partir du 1er septembre 2027, les micro-entreprises devront aussi émettre les leurs, pour leurs clients professionnels, en passant par une plateforme agréée par l'État : un PDF ordinaire envoyé par e-mail ne sera plus conforme. Quatre mentions deviennent obligatoires avec la réforme (au 1er septembre 2027 pour les micro-entreprises), dont le numéro SIREN du client et la nature de l'opération (ici : prestation de services) : prends l'habitude de les mettre dès maintenant. Calendrier et liste des plateformes à vérifier sur impots.gouv.fr.",
    link: 'https://www.impots.gouv.fr/professionnel/je-decouvre-la-facturation-electronique',
    linkLabel: 'La facturation électronique (impots.gouv.fr)',
  },
  {
    title: 'Le nom de domaine est au nom du client. Toujours.',
    body: "Règle d'or, et règle de ScanTaVille : tu n'enregistres jamais le nom de domaine d'un commerce à ton nom, ni « pour le lui garder », ni pour le revendre, ni pour faire pression. C'est du cybersquattage : nos conditions d'utilisation l'interdisent, ton compte serait fermé, et le commerçant peut récupérer un .fr enregistré de mauvaise foi par une procédure de l'Afnic (Syreli). La bonne méthode : le commerçant crée son propre compte chez un bureau d'enregistrement (OVHcloud, Gandi, Infomaniak...) avec son e-mail, paie le domaine avec sa carte (de l'ordre de 10 € par an pour un .fr, selon le prestataire) et te donne un accès technique. Le titulaire du domaine, c'est lui. Si vous arrêtez de travailler ensemble, il garde son nom et son site. Quand ScanTaVille affiche un domaine « libre », c'est une simple vérification technique : rien n'est réservé, et la disponibilité réelle se confirme chez le bureau d'enregistrement.",
    link: 'https://www.afnic.fr/wp-media/uploads/2024/07/Afnic-Guide-pratique-du-Titulaire.pdf',
    linkLabel: "Guide pratique du titulaire d'un nom de domaine en .fr (Afnic)",
  },
  {
    title: 'Mentions légales obligatoires sur le site livré',
    body: "Tout site professionnel doit afficher des mentions légales, et c'est à toi d'y penser avant la mise en ligne. Pour un entrepreneur individuel : nom et prénom suivis de « EI », adresse, e-mail et téléphone, numéro d'immatriculation (RCS ou RNE selon son activité), numéro de TVA s'il en a un. Pour une société : dénomination, forme juridique, adresse du siège et capital social en plus (liste complète sur service-public.fr). Et dans tous les cas : le nom, l'adresse et le téléphone de l'hébergeur. Ce sont les informations du commerçant, pas les tiennes : demande-les-lui et crée une page « Mentions légales ». L'oubli est sanctionné pénalement (jusqu'à un an d'emprisonnement et 75 000 € d'amende pour une personne physique, d'après service-public.fr). Si le site a un formulaire de contact, ajoute une page sur les données personnelles (qui les reçoit, pourquoi, combien de temps, comment exercer ses droits). Évite les traceurs et les outils tiers qui déposent des cookies : sans traceur soumis à consentement, pas de bandeau cookies à gérer.",
    link: 'https://entreprendre.service-public.gouv.fr/vosdroits/F31228',
    linkLabel: 'Mentions obligatoires sur un site internet (service-public.fr)',
  },
  {
    title: "Hébergement gratuit, et ce qu'une maintenance t'engage à faire",
    body: "Un site vitrine statique s'héberge gratuitement sur Cloudflare Pages ou Netlify : leurs offres gratuites incluent le HTTPS et un nom de domaine personnalisé, dans certaines limites (nombre de déploiements, trafic, crédits mensuels). Ces conditions changent : relis-les avant de t'engager. Idéalement le compte d'hébergement est ouvert au nom du client, ou tu lui remets une copie des fichiers. Sois transparent : ne facture pas un « hébergement » que tu ne paies pas. Ce que tu peux facturer chaque mois, c'est ton temps. Un forfait de maintenance est un engagement : faire les modifications demandées (horaires, carte, photos) dans le délai annoncé, surveiller que le site reste en ligne et que le domaine est bien renouvelé par son titulaire, répondre quand quelque chose casse. Écris noir sur blanc ce qui est inclus (par exemple 30 minutes de modifications par mois), ton délai de réponse, et comment le client peut arrêter (par exemple un mois de préavis, avec remise des fichiers). Si tu ne veux pas de cet engagement, vends le site seul et facture les modifications à la demande.",
    link: 'https://pages.cloudflare.com/',
    linkLabel: 'Cloudflare Pages (voir aussi netlify.com/pricing)',
  },
  {
    title: 'Prospecter proprement : les règles du jeu entre pros',
    body: "Tu contactes un professionnel au sujet de son activité : c'est de la prospection entre professionnels. D'après la CNIL, elle ne demande pas d'accord préalable, à trois conditions : ton message est en rapport avec sa profession, la personne est informée de l'utilisation de ses coordonnées, et elle peut s'y opposer simplement et gratuitement. Chaque message doit dire qui l'envoie et permettre de refuser la suite. Donc : 1) Dis qui tu es dès la première phrase, et si on te le demande, dis où tu as trouvé ses coordonnées (sa vitrine, son compte public, une carte en ligne). Ne te fais jamais passer pour un client et ne dis jamais que le site est en ligne : c'est une maquette gratuite. 2) Propose toujours une sortie (« dites-le-moi et je ne vous relance pas ») et respecte-la : un non est définitif, note-le pour ne jamais recontacter ce commerce. Une seule relance, pas plus. 3) N'automatise jamais l'envoi : pas de robot, pas d'envoi en masse, pas de copier-coller à 200 comptes. Un message = un commerce que tu as vraiment regardé. C'est interdit par nos conditions, et les plateformes comme Instagram sanctionnent le spam. 4) Utilise uniquement les coordonnées professionnelles que le commerce a rendues publiques (compte Insta du commerce, contact@, téléphone de la boutique). Beaucoup de commerçants sont entrepreneurs individuels : évite les e-mails et les SMS à froid vers une adresse ou un portable qui a l'air personnel, et dans le doute, passe en boutique. 5) Téléphone : depuis le 11 août 2026, démarcher un consommateur par téléphone sans son consentement préalable est interdit. D'après la CNIL, l'appel à un professionnel reste possible sans consentement s'il porte sur son activité et s'il peut s'y opposer : appelle uniquement le numéro du commerce (jamais un numéro personnel), aux heures d'ouverture, hors rush, présente-toi tout de suite, et s'il dit non, ne rappelle pas. 6) Avant tout contact, vérifie toi-même sur Google que le commerce n'a vraiment pas de site : nos données viennent d'OpenStreetMap et peuvent être incomplètes ou datées. Les règles détaillées (e-mail, SMS, téléphone) sont dans les fiches « prospection commerciale » de cnil.fr.",
    link: 'https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique-sms-mms-et-automate-dappel',
    linkLabel: 'Prospection par e-mail et SMS : les règles (CNIL)',
  },
  {
    title: 'Une grille de prix pour démarrer',
    body: "Ce sont des habitudes de marché pour un débutant, pas un barème officiel ni un revenu garanti : tu fixes librement tes prix. Site vitrine une page (la maquette finalisée avec le commerçant : textes relus, ses photos, ses mentions légales, mise en ligne sur son nom de domaine) : 490 €. Options courantes : page supplémentaire 90 €, formulaire de commande ou de demande de devis 90 €, prise de rendez-vous en ligne via un outil tiers 120 €, séance photo sur place 120 €. Maintenance : 29 € par mois, sans durée minimale. Ce sont des prix nets : pas de TVA tant que tu es en franchise en base. Garde la tête froide : sur 490 € encaissés, entre un cinquième et un quart part en cotisations sociales selon ta catégorie, l'impôt sur le revenu vient en plus, un site demande plusieurs heures de vrai travail avec le commerçant, et la plupart des commerces que tu contacteras diront non. Aucun revenu n'est garanti, tout dépend du temps et du sérieux que tu y mets.",
  },
  {
    title: 'Le minimum de gestion',
    body: "En micro-entreprise, ta comptabilité tient en peu de choses : un livre des recettes tenu dans l'ordre chronologique (date, client, montant, mode de paiement, numéro de facture) et tes factures conservées 10 ans. Un compte bancaire dédié à ton activité devient obligatoire si ton chiffre d'affaires dépasse 10 000 € deux années de suite. Avant ce seuil, c'est facultatif, mais séparer tes comptes dès le début te simplifie la vie. Le régime micro s'applique jusqu'à 83 600 € de chiffre d'affaires annuel en prestation de services (plafond 2026). Assurance : d'après service-public.fr, l'obligation dépend de l'activité (professions réglementées, bâtiment, santé...). La création de sites n'est pas une profession réglementée, donc rien ne t'y oblige, mais une responsabilité civile professionnelle reste recommandée dès que tu as des clients.",
    link: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23266',
    linkLabel: 'Obligations comptables du micro-entrepreneur (service-public.fr)',
  },
  {
    title: "Ce n'est pas un conseil juridique",
    body: "Cette liste est un aide-mémoire, vérifié en septembre 2026 sur des sources officielles (service-public.fr, CNIL, impots.gouv.fr, Urssaf, INPI, Afnic). Les règles, les seuils et les taux changent : vérifie toujours sur service-public.fr avant d'agir, et en cas de doute demande à un professionnel (expert-comptable, avocat) ou à ta chambre de commerce ou de métiers, qui proposent un accompagnement aux créateurs. ScanTaVille est un outil de prospection : il ne remplace ni un juriste ni un comptable, et il ne te garantit aucun revenu.",
    link: 'https://www.service-public.gouv.fr/',
    linkLabel: 'service-public.fr',
  },
];
