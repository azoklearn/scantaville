# ScanTaVille (MVP)

> Tape ta ville : la brume se lève, chaque commerce sans site web apparaît en bleu sur la carte.
> Clique : son site est déjà fait. Il ne reste qu'à le vendre. **1 oui = 490 €.**

Prototype statique, zéro backend, zéro API payante, zéro IA à l'exécution.

## Lancer

```bash
node scripts/serve.mjs 5180
```

Puis http://localhost:5180 · lien direct vers une ville : `/?v=37261` (code INSEE) · simuler l'offre payante : `/?pro=1` (et `/?pro=0`).

## Le produit en 20 secondes (la vidéo TikTok)

1. **La brume se lève** sur la carte de TA ville, les points bleus apparaissent, le compteur grimpe : « 185 commerces sans site web à Tours ».
2. **Tu cliques un point** : fiche du commerce, puis « Générer son site » : une vraie maquette de site (nom, horaires, adresse, plan, bouton d'appel) en moins d'une seconde, sans IA.
3. **Tu montres ça au patron** (script fourni). 1 oui = 490 €.
4. **La carte 9:16 de ta ville** à poster, avec son rang par habitant : « commente ta ville, je la scanne ».

## Architecture

| Fichier | Rôle |
| --- | --- |
| `index.html`, `css/app.css`, `js/app.mjs` | L'app : recherche de ville, scan, liste, fiche, maquette, scripts, carte à partager, paywall simulé |
| `js/brand.mjs` | **Le nom du produit, à un seul endroit** (logo, titre, carte à partager, domaine) |
| `js/fog.mjs` | Brume + pins (2 canvas au-dessus de MapLibre) |
| `js/card.mjs` | Carte 9:16 (constellation de la ville) en PNG, côté client |
| `js/city.mjs` | Autocomplete (geo.api.gouv.fr), chargement d'une ville pré-calculée ou scan en direct |
| `js/core/leads.mjs` | **Cœur partagé navigateur + Node** : requête Overpass, tri des commerces, exclusions (chaînes, etc.), vérification de domaines par DNS-over-HTTPS |
| `js/core/payload.mjs` | Données de la maquette encodées dans l'URL (pas de base de données) |
| `demo.html`, `css/demo.css`, `js/demo/*` | Le site de démo généré : 4 familles de templates, et pour chacun des 15 métiers sa palette, son pictogramme, son bouton d'action, ses textes et un bloc dédié (`js/demo/trade-kit.mjs`, `js/demo/content.mjs`) |
| `js/content/*` | Scripts de vente par métier, objections, kit légal |
| `scripts/build-cities.mjs` | Pré-calcul des villes vers `data/cities/{insee}.json` + `data/index.json` |
| `scripts/serve.mjs` | Serveur statique local |

## Données (toutes gratuites, sans clé)

- **OpenStreetMap / Overpass** : commerces, téléphone, horaires, réseaux (ODbL, attribution obligatoire).
- **geo.api.gouv.fr** : communes, population, contour. **Base Adresse Nationale** : adresse manquante par géocodage inverse.
- **Cloudflare DNS-over-HTTPS** : un commerce dont un nom de domaine plausible est déjà enregistré passe en « à vérifier » et sort du compteur.
- **OpenFreeMap + MapLibre GL** : fond de carte.

Niveaux : `gold` aucun site détecté (point bleu plein) · `social` seulement Insta / Facebook / annuaire (anneau bleu) · `silver` à vérifier (jamais compté).

Design : bleu `#1d5bff` + blanc, encre marine `#0b1b3f`, polices Archivo / Schibsted Grotesk / Martian Mono. Tout est en variables CSS en tête de `css/app.css`.

```bash
node scripts/build-cities.mjs            # toutes les villes de la liste
node scripts/build-cities.mjs 37261      # une seule (réponses Overpass en cache dans scripts/.cache)
```

## Coût de fonctionnement

Hébergement statique gratuit (Cloudflare Pages / Netlify / Vercel) + nom de domaine ≈ **1 à 2 €/mois**. Rien ne coûte à l'usage.

## Avant la mise en production

1. **Données** : ne jamais interroger Overpass par visiteur. Pré-calculer toutes les communes chaque semaine depuis un extrait Geofabrik (GitHub Action), enrichir avec Overture Places et SIRENE.
2. **Liens courts** pour les maquettes (`/d/abc123`, un Worker + KV gratuit) avec « le patron a ouvert ta maquette », expiration à 30 jours.
3. **Paiement** (Stripe ou Whop) + compte. Le paywall porte sur l'atelier, pas sur les données (ODbL).
4. **Signalements partagés** (« il a déjà un site ») : c'est le seul vrai fossé défensif, une base vérifiée par les utilisateurs.
5. **Conformité** : page de retrait pour les commerçants, mentions RGPD (art. 14), CGU (interdiction de réserver le domaine d'un commerçant à son nom, pas d'envoi automatisé), vérification INPI du nom.

## Règles de communication (TikTok)

- Jamais de compteur « marché en euros » ni de promesse de revenu : uniquement « 1 oui = 490 € » et « compte ~50 contacts pour une vente ».
- Dire « sans site web référencé », garder le bouton « vérifier sur Google ».
- Filmer avec le **mode tournage** (numéros masqués).
