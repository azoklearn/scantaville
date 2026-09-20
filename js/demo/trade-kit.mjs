// What makes each TRADE's demo site its own, beyond the palette and the services list:
//   ico    a line pictogram, shown in the hero and in the signature block
//   cta    the label of the main call button ("Réserver", "Prendre RDV", "Commander", "Demander un devis"...)
//   ui     wording overrides for the family's section titles (a fashion shop has no "carte du salon")
//   sig    one block only this trade has (booking, order, quote, project steps...)
// Honesty rules are the same as content.mjs: no prices, no invented service. The signature block only says
// what is true of any shop of that trade ("appelez pour réserver"), and carries an "exemple" note.
import { s } from './dom.mjs';

// Static shapes on a 24 x 24 grid: ['p', d] path · ['c', cx, cy, r] circle. Nothing from the payload.
const SHAPES = {
  scissors: [['c', 6, 6, 3], ['c', 6, 18, 3], ['p', 'M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12']],
  lotus: [['p', 'M12 4c2.6 3.2 2.6 8.6 0 12-2.6-3.4-2.6-8.8 0-12z'], ['p', 'M4 9.5c3.8.4 6.4 3 8 6.5-4.2.2-7.4-2.2-8-6.5z'], ['p', 'M20 9.5c-3.8.4-6.4 3-8 6.5 4.2.2 7.4-2.2 8-6.5z'], ['p', 'M6 20h12']],
  dagger: [['p', 'M12 2l2.4 11H9.6z'], ['p', 'M7 13h10M12 13v6'], ['c', 12, 20.5, 1.5]],
  cutlery: [['p', 'M6 3v6a3 3 0 0 0 3 3v9M9 3v6M12 3v6a3 3 0 0 1-3 3'], ['p', 'M18 3c-2.2 2-3.2 5-3.2 9H18v9M18 3v9']],
  cocktail: [['p', 'M4 4h16l-8 9z'], ['p', 'M12 13v7M8 20h8M7 7.5h10'], ['c', 15.5, 3.2, 1.2]],
  cup: [['p', 'M4 10h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z'], ['p', 'M17 11h1.5a2.5 2.5 0 0 1 0 5H17'], ['p', 'M8 3c1 1.2-1 2.3 0 3.5M12 3c1 1.2-1 2.3 0 3.5M3 22h15']],
  burger: [['p', 'M4 11a8 6.5 0 0 1 16 0z'], ['p', 'M3.5 14.2c1.4 1.2 2.8 1.2 4.2 0s2.9-1.2 4.3 0 2.9 1.2 4.3 0 2.8-1.2 4.2 0'], ['p', 'M4.5 17.5h15v.5a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3z'], ['p', 'M9 7.5h.01M12.5 6.5h.01M15 8h.01']],
  bread: [['p', 'M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4c0 1.2-.6 2-1.5 2.5V18a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-5.5C5.6 12 5 11.2 5 10z'], ['p', 'M10 9.5l-1 3M13 9.5l-1 3M16 9.5l-1 3']],
  cleaver: [['p', 'M3 5h11a3 3 0 0 1 3 3v6H3z'], ['c', 13.5, 8.5, 1], ['p', 'M17 9.5h4.5v3H17M3 17.5h9']],
  jar: [['p', 'M8 3h8v3H8z'], ['p', 'M7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z'], ['p', 'M8.5 11.5h7v5h-7z']],
  tulip: [['p', 'M12 3c1.5 1.5 2 3 2 3s1.5-1.5 3-1.5c0 5-2 8-5 8s-5-3-5-8c1.5 0 3 1.5 3 1.5s.5-1.5 2-3z'], ['p', 'M12 12.5V21M12 18c0-3 2-4.6 5-5 0 3-2 4.8-5 5z']],
  wrench: [['p', 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z']],
  hammer: [['p', 'M6 3h9l3 3v3h-3V7H6z'], ['p', 'M9.5 7v13a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V7']],
  hanger: [['p', 'M12 8V6.6a2 2 0 1 0-2-2'], ['p', 'M12 8l8.8 7.6a1.6 1.6 0 0 1-1 2.9H4.2a1.6 1.6 0 0 1-1-2.9z']],
  bag: [['p', 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z'], ['p', 'M3 6h18M16 10a4 4 0 0 1-8 0']],
};

export function tradeIcon(name, cls = 'tico') {
  const shapes = SHAPES[name] || SHAPES.bag;
  return s('svg', { class: cls, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    shapes.map((sh) => (sh[0] === 'c' ? s('circle', { cx: sh[1], cy: sh[2], r: sh[3] }) : s('path', { d: sh[1] }))));
}

const NOTE = 'Exemple de bloc, à adapter avec le commerce.';

export const TRADE_KIT = {
  coiffeur: {
    ico: 'scissors', cta: 'Prendre RDV',
    ui: { servicesKicker: 'La carte du salon' },
    sig: { kicker: 'Rendez-vous', title: 'On vous garde une place ?', text: 'Un appel suffit pour réserver votre créneau, aux horaires d’ouverture du salon.', points: ['Coupe', 'Couleur', 'Coiffure d’événement'], action: 'Appeler le salon' },
  },
  beaute: {
    ico: 'lotus', cta: 'Prendre RDV',
    ui: { servicesTitle: 'Les soins', servicesKicker: 'La carte de l’institut' },
    sig: { kicker: 'Prendre soin de soi', title: 'Votre moment, sur rendez-vous', text: 'Dites-nous ce qui vous ferait du bien : on vous propose le soin et le créneau qui conviennent.', points: ['Visage', 'Corps', 'Mains & pieds'], action: 'Appeler l’institut' },
  },
  tatoueur: {
    ico: 'dagger', cta: 'Parler du projet',
    ui: { servicesTitle: 'Le studio', servicesKicker: 'Comment on travaille', slot: 'Sur devis' },
    sig: { kicker: 'Votre projet', title: 'Du croquis à la peau, en trois temps', text: 'On commence toujours par en parler. Le reste suit.', steps: ['On échange sur votre idée', 'On dessine, on ajuste', 'On fixe la séance'], action: 'Appeler le studio' },
  },
  restaurant: {
    ico: 'cutlery', cta: 'Réserver',
    sig: { kicker: 'Réservation', title: 'Une table pour ce soir ?', text: 'Réservez par téléphone, en précisant le nombre de couverts et l’heure souhaitée.', points: ['Midi', 'Soir', 'Groupes'], action: 'Réserver une table' },
  },
  bar: {
    ico: 'cocktail', cta: 'Appeler',
    ui: { servicesKicker: 'Au comptoir' },
    sig: { kicker: 'On se retrouve ?', title: 'Un verre, une tablée, une occasion', text: 'Pour venir nombreux ou fêter quelque chose, passez un coup de fil avant : on s’organise.', points: ['Entre amis', 'Après le travail', 'Grandes tablées'], action: 'Appeler le bar' },
  },
  cafe: {
    ico: 'cup', cta: 'Appeler',
    ui: { servicesTitle: 'Au comptoir', servicesKicker: 'À toute heure' },
    sig: { kicker: 'La pause', title: 'Sur place ou sur le pouce', text: 'Un café au comptoir, une table pour travailler, ou juste un bonjour en passant.', points: ['Le matin', 'Le midi', 'Le goûter'], action: 'Appeler le café' },
  },
  fastfood: {
    ico: 'burger', cta: 'Commander',
    ui: { servicesTitle: 'Le menu', servicesKicker: 'Ce qu’on sert' },
    sig: { kicker: 'Commande', title: 'Une petite faim ? Appelez, c’est prêt', text: 'Passez commande par téléphone et venez la récupérer sans attendre.', points: ['Sur place', 'À emporter'], action: 'Commander par téléphone' },
  },
  boulangerie: {
    ico: 'bread', cta: 'Commander',
    sig: { kicker: 'Sur commande', title: 'Un gâteau, des plateaux, une fête ?', text: 'Anniversaire, repas de famille, pot au bureau : commandez quelques jours avant par téléphone.', points: ['Gâteaux', 'Pièces montées', 'Plateaux'], action: 'Passer commande' },
  },
  boucherie: {
    ico: 'cleaver', cta: 'Commander',
    ui: { servicesTitle: 'À l’étal', servicesKicker: 'En boutique' },
    sig: { kicker: 'Sur commande', title: 'Un repas à préparer ? On s’en occupe', text: 'Pièces à rôtir, plateaux, barbecue : appelez pour réserver, on vous conseille les quantités.', points: ['Repas de fête', 'Barbecue', 'Plateaux'], action: 'Passer commande' },
  },
  epicerie: {
    ico: 'jar', cta: 'Appeler',
    ui: { servicesTitle: 'Nos rayons', servicesKicker: 'En boutique' },
    sig: { kicker: 'À offrir', title: 'Un coffret composé pour vous', text: 'Dites-nous pour qui et pour quelle occasion : on compose le panier en boutique.', points: ['Coffrets', 'Paniers', 'Idées cadeaux'], action: 'Appeler la boutique' },
  },
  fleuriste: {
    ico: 'tulip', cta: 'Commander',
    ui: { servicesTitle: 'Nos créations', servicesKicker: 'En boutique' },
    sig: { kicker: 'Sur mesure', title: 'Un bouquet pour le dire', text: 'Donnez-nous l’occasion, les couleurs et votre budget : on compose le bouquet.', points: ['Anniversaire', 'Mariage', 'Remerciement', 'Deuil'], action: 'Commander un bouquet' },
  },
  garage: {
    ico: 'wrench', cta: 'Prendre RDV',
    sig: { kicker: 'Devis', title: 'Un bruit, un voyant, une révision ?', text: 'Décrivez le souci par téléphone : on vous dit ce qu’il faut regarder et on fixe un passage à l’atelier.', steps: ['Vous appelez', 'On regarde le véhicule', 'Devis avant travaux'], action: 'Demander un devis' },
  },
  artisan: {
    ico: 'hammer', cta: 'Demander un devis',
    ui: { servicesTitle: 'Savoir-faire', servicesKicker: 'Ce que nous faisons' },
    sig: { kicker: 'Votre projet', title: 'Parlons de ce que vous voulez faire', text: 'Un appel pour comprendre le besoin, puis un devis clair avant de commencer.', steps: ['Vous décrivez le besoin', 'On se déplace ou on regarde en atelier', 'Devis écrit'], action: 'Demander un devis' },
  },
  mode: {
    ico: 'hanger', cta: 'Appeler',
    ui: { servicesTitle: 'La sélection', servicesKicker: 'En boutique', slot: 'En boutique', note: 'Exemple de présentation : vos collections et vos marques prendront place ici.', hoursKicker: 'Passez nous voir', contactKicker: 'Une question, une taille ?' },
    sig: { kicker: 'En boutique', title: 'Une pièce vous a tapé dans l’œil ?', text: 'Appelez pour vérifier une taille ou faire mettre un article de côté avant de passer.', points: ['Nouveautés', 'Tailles', 'Mise de côté'], action: 'Appeler la boutique' },
  },
  commerce: {
    ico: 'bag', cta: 'Appeler',
    ui: { servicesTitle: 'Nos rayons', servicesKicker: 'En boutique' },
    sig: { kicker: 'Un renseignement ?', title: 'Vous cherchez quelque chose de précis', text: 'Appelez avant de vous déplacer : on vous dit si on l’a, ou si on peut le commander.', points: ['Disponibilité', 'Commande', 'Conseil'], action: 'Appeler la boutique' },
  },
};

export function kitFor(trade) {
  const kit = Object.hasOwn(TRADE_KIT, trade) ? TRADE_KIT[trade] : TRADE_KIT.commerce;
  return { ...kit, sig: { ...kit.sig, note: NOTE } };
}
