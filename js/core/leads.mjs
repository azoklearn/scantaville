// Shared by the browser app AND the Node build script (scripts/build-cities.mjs).
// No DOM, no Node-only API in here: only fetch + plain JS.
//
// Pipeline: Overpass elements -> whitelisted independent shops -> "no own website" candidates
// -> domain-guess check (DNS over HTTPS) -> tier:
//   gold   = no website tag, no social tag, no guessed domain registered  ("Aucun site détecté")
//   social = only Facebook / Instagram / directory page                   ("Seulement Insta/Facebook")
//   silver = a guessed domain is registered -> maybe has a site            ("À vérifier", never counted)

export const BRAND = 'ScanTaVille'; // display name lives in js/brand.mjs

// tpl = demo-site template family used by demo.html
export const TRADES = {
  coiffeur:    { label: 'Coiffeur',          plural: 'coiffeurs',           tpl: 'salon',   word: 'salon' },
  beaute:      { label: 'Institut de beauté', plural: 'instituts de beauté', tpl: 'salon',   word: 'institut' },
  tatoueur:    { label: 'Tatoueur',          plural: 'tatoueurs',           tpl: 'salon',   word: 'tattoo' },
  restaurant:  { label: 'Restaurant',        plural: 'restaurants',         tpl: 'table',   word: 'restaurant' },
  bar:         { label: 'Bar',               plural: 'bars',                tpl: 'table',   word: 'bar' },
  cafe:        { label: 'Café',              plural: 'cafés',               tpl: 'table',   word: 'cafe' },
  fastfood:    { label: 'Snack',             plural: 'snacks',              tpl: 'table',   word: 'snack' },
  boulangerie: { label: 'Boulangerie',       plural: 'boulangeries',        tpl: 'fournil', word: 'boulangerie' },
  boucherie:   { label: 'Boucherie / traiteur', plural: 'bouchers & traiteurs', tpl: 'fournil', word: 'boucherie' },
  epicerie:    { label: 'Épicerie fine',     plural: 'épiceries',           tpl: 'fournil', word: 'epicerie' },
  fleuriste:   { label: 'Fleuriste',         plural: 'fleuristes',          tpl: 'fournil', word: 'fleuriste' },
  garage:      { label: 'Garage',            plural: 'garages',             tpl: 'atelier', word: 'garage' },
  artisan:     { label: 'Artisan',           plural: 'artisans',            tpl: 'atelier', word: 'artisan' },
  mode:        { label: 'Boutique de mode',  plural: 'boutiques de mode',   tpl: 'salon',   word: 'boutique' },
  commerce:    { label: 'Commerce',          plural: 'commerces',           tpl: 'fournil', word: 'boutique' },
};

const SHOP_TO_TRADE = {
  hairdresser: 'coiffeur',
  beauty: 'beaute', massage: 'beaute', cosmetics: 'beaute', perfumery: 'beaute',
  tattoo: 'tatoueur', piercing: 'tatoueur',
  bakery: 'boulangerie', pastry: 'boulangerie', confectionery: 'boulangerie', chocolate: 'boulangerie',
  butcher: 'boucherie', deli: 'boucherie', seafood: 'boucherie', cheese: 'boucherie',
  greengrocer: 'epicerie', wine: 'epicerie', alcohol: 'epicerie', tea: 'epicerie', coffee: 'epicerie',
  farm: 'epicerie', health_food: 'epicerie', spices: 'epicerie',
  florist: 'fleuriste', garden_centre: 'fleuriste',
  car_repair: 'garage', motorcycle_repair: 'garage', motorcycle: 'garage', bicycle: 'garage', tyres: 'garage', car_parts: 'garage',
  clothes: 'mode', shoes: 'mode', jewelry: 'mode', boutique: 'mode', bag: 'mode', fashion_accessories: 'mode',
  leather: 'mode', tailor: 'mode', second_hand: 'mode', watches: 'mode',
  gift: 'commerce', books: 'commerce', toys: 'commerce', furniture: 'commerce', interior_decoration: 'commerce',
  antiques: 'commerce', art: 'commerce', frame: 'commerce', music: 'commerce', musical_instrument: 'commerce',
  games: 'commerce', craft: 'commerce', fabric: 'commerce', sewing: 'commerce', pet: 'commerce', pet_grooming: 'commerce',
  hardware: 'commerce', houseware: 'commerce', sports: 'commerce', stationery: 'commerce', photo: 'commerce',
  dry_cleaning: 'commerce', laundry: 'commerce', locksmith: 'artisan', shoe_repair: 'artisan',
  electronics_repair: 'artisan', computer: 'commerce', mobile_phone: 'commerce', video_games: 'commerce',
  bed: 'commerce', kitchen: 'commerce', lighting: 'commerce', carpet: 'commerce', curtain: 'commerce',
  herbalist: 'epicerie', ice_cream: 'boulangerie',
};

const AMENITY_TO_TRADE = {
  restaurant: 'restaurant', bar: 'bar', pub: 'bar', cafe: 'cafe', fast_food: 'fastfood', ice_cream: 'boulangerie',
};

// Hosts that are NOT "a website of their own": social networks, directories, booking / delivery platforms.
const SOCIAL_HOSTS = [
  'facebook.com', 'fb.com', 'fb.me', 'instagram.com', 'tiktok.com', 'linktr.ee', 'twitter.com', 'x.com',
  'business.site', 'pagesjaunes.fr', 'tripadvisor.', 'thefork.', 'lafourchette.com', 'planity.com', 'treatwell.',
  'ubereats.com', 'deliveroo.', 'just-eat.', 'google.com', 'goo.gl', 'g.page', 'yelp.', 'petitfute.com',
  'wixsite.com', 'eatbu.com', 'snapchat.com', 'youtube.com', 'kiute.', 'resalib.fr', 'mappy.com',
];

// Chains / franchises that slip through without a brand tag. Matched on the WHOLE name or its start
// ("Paul", "Paul Gare de Tours") so independents like "Chez Paul" or "Boucherie Nicolas" survive.
const CHAINS = [
  'mcdonald', 'mcdonalds', 'burger king', 'kfc', 'quick', 'subway', 'domino', 'dominos pizza', 'pizza hut', 'starbucks', 'paul',
  'brioche doree', 'marie blachere', 'ange', 'la mie caline', 'columbus cafe', 'o tacos', 'pitaya', 'sushi shop', 'bagelstein',
  'franck provost', 'jean louis david', 'saint algue', 'dessange', 'tchip', 'vog', 'yves rocher', 'sephora', 'nocibe',
  'marionnaud', 'body minute', 'norauto', 'midas', 'speedy', 'feu vert', 'point s', 'euromaster', 'carglass',
  'interflora', 'monceau fleurs', 'au nom de la rose', 'nicolas', 'v and b', 'cavavin', 'picard', 'biocoop',
  'naturalia', 'la vie claire', 'celio', 'jules', 'zara', 'h et m', 'kiabi', 'promod', 'camaieu', 'etam', 'pimkie',
  'bonobo', 'jennyfer', 'okaidi', 'du pareil au meme', 'eram', 'san marina', 'minelli', 'courir', 'foot locker',
  'decathlon', 'intersport', 'go sport', 'fnac', 'darty', 'boulanger', 'cultura', 'maisons du monde', 'histoire d or',
  'pandora', 'swarovski', 'leonidas', 'jeff de bruges', 'de neuville', 'king jouet', 'joueclub',
  'micromania', 'bureau vallee', 'orange', 'sfr', 'bouygues telecom', 'free', '5 a sec', 'cordonnerie minute', 'mister minit',
  'del arte', 'hippopotamus', 'buffalo grill', 'courtepaille', 'flunch', 'leon', 'leon de bruxelles', 'au bureau',
  'bistro regent', 'big fernand', 'five guys', 'class croute', 'pomme de pain', 'la croissanterie',
  'carrefour', 'casino', 'franprix', 'monoprix', 'auchan', 'leclerc', 'intermarche', 'lidl', 'aldi', 'spar', 'vival', 'proxi',
];

function normName(s) {
  return stripAccents(String(s).toLowerCase()).replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function isChainName(name) {
  const n = normName(name);
  return CHAINS.some((c) => n === c || n.startsWith(c + ' '));
}

export function stripAccents(s) { return String(s).normalize('NFD').replace(/\p{M}/gu, ''); }

export function buildOverpassQuery(insee) {
  return `[out:json][timeout:90];
area["ref:INSEE"="${insee}"]["boundary"="administrative"]->.a;
(
  nwr["name"]["shop"](area.a);
  nwr["name"]["amenity"~"^(restaurant|bar|pub|cafe|fast_food|ice_cream)$"](area.a);
  nwr["name"]["craft"](area.a);
);
out tags center;`;
}

export function tradeOf(tags) {
  if (tags.shop && SHOP_TO_TRADE[tags.shop]) return SHOP_TO_TRADE[tags.shop];
  if (tags.amenity && AMENITY_TO_TRADE[tags.amenity]) return AMENITY_TO_TRADE[tags.amenity];
  if (tags.craft && !tags.shop && !tags.amenity) return 'artisan';
  return null;
}

function isChain(tags) {
  if (tags.brand || tags['brand:wikidata'] || tags['operator:wikidata'] || tags.network) return true;
  return isChainName(tags.name || '');
}

function hostOf(url) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

function isSocialUrl(url) {
  const h = hostOf(url);
  if (!h) return true;
  // Entries ending with '.' are TLD-agnostic prefixes ("tripadvisor." -> tripadvisor.fr, fr.tripadvisor.com).
  // The others must be the host itself or a parent domain: a plain includes() made "x.com" match
  // armorlux.com, geox.com, anything-bordeaux.com… and turned shops WITH a real site into "social" leads.
  return SOCIAL_HOSTS.some((s) => (s.endsWith('.') ? h.startsWith(s) || h.includes('.' + s) : h === s || h.endsWith('.' + s)));
}

export function formatPhone(raw) {
  if (!raw) return null;
  const first = String(raw).split(/[;,/]/)[0].trim();
  let d = first.replace(/[^\d+]/g, '');
  if (d.startsWith('+33')) d = '0' + d.slice(3);
  else if (d.startsWith('0033')) d = '0' + d.slice(4);
  if (/^0\d{9}$/.test(d)) return d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  return first || null;
}

function addrOf(tags) {
  const street = tags['addr:street'] || tags['contact:street'];
  if (!street) return null;
  const num = tags['addr:housenumber'] || tags['contact:housenumber'] || '';
  const pc = tags['addr:postcode'] || tags['contact:postcode'] || '';
  const city = tags['addr:city'] || tags['contact:city'] || '';
  return `${num ? num + ' ' : ''}${street}${pc || city ? ', ' : ''}${pc}${pc && city ? ' ' : ''}${city}`.trim();
}

function socialOf(tags) {
  const out = {};
  const candidates = [
    tags['contact:facebook'], tags.facebook, tags['contact:instagram'], tags.instagram,
    tags.website, tags['contact:website'], tags.url,
  ].filter(Boolean);
  for (const c of candidates) {
    const v = String(c).trim();
    const h = hostOf(v);
    if (!out.facebook && (h.includes('facebook.com') || h === 'fb.com' || h === 'fb.me')) out.facebook = normUrl(v);
    if (!out.instagram && h.includes('instagram.com')) out.instagram = normUrl(v);
  }
  // bare handles like contact:instagram=monsalon
  const ig = tags['contact:instagram'] || tags.instagram;
  if (ig && !out.instagram && /^@?[\w.]{2,30}$/.test(ig.trim())) out.instagram = 'https://instagram.com/' + ig.trim().replace(/^@/, '');
  const fb = tags['contact:facebook'] || tags.facebook;
  if (fb && !out.facebook && /^[\w.\-]{2,60}$/.test(fb.trim())) out.facebook = 'https://facebook.com/' + fb.trim();
  return out;
}

function normUrl(u) { return /^https?:\/\//i.test(u) ? u : 'https://' + u; }

/**
 * Overpass elements -> { leads, stats }.
 * Leads come out with tier 'social' or 'pending' ('pending' = needs the domain check to become gold/silver).
 */
export function elementsToLeads(elements) {
  const leads = [];
  const seen = new Set();
  const stats = { poisTotal: 0, withWebsite: 0, chains: 0, tooThin: 0, byTrade: {} };

  for (const el of elements) {
    const tags = el.tags || {};
    const name = (tags.name || '').trim();
    if (!name || name.length < 2) continue;
    if (tags.disused || tags['disused:shop'] || tags['disused:amenity'] || tags.abandoned || tags.opening_hours === 'closed') continue;
    const trade = tradeOf(tags);
    if (!trade) continue;
    stats.poisTotal++;
    if (isChain(tags)) { stats.chains++; continue; }

    const sites = [tags.website, tags['contact:website'], tags.url].filter(Boolean);
    if (sites.some((u) => !isSocialUrl(u))) { stats.withWebsite++; continue; }

    const social = socialOf(tags);
    const hasSocial = !!(social.facebook || social.instagram) || sites.length > 0; // sites here are all social/directory pages
    const phone = formatPhone(tags.phone || tags['contact:phone'] || tags['contact:mobile'] || tags.mobile);
    const email = tags.email || tags['contact:email'] || null;
    // Richness rule: someone mapped contact details for this shop and still found no website.
    // A bare name with nothing else tells us nothing, so it is not a lead.
    if (!phone && !hasSocial && !email) { stats.tooThin++; continue; }

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const key = stripAccents(name).toLowerCase() + '|' + lat.toFixed(4) + '|' + lon.toFixed(4);
    if (seen.has(key)) continue;
    seen.add(key);

    leads.push({
      id: el.type[0] + el.id,
      name,
      trade,
      lat: +lat.toFixed(6),
      lon: +lon.toFixed(6),
      addr: addrOf(tags),
      phone,
      hours: tags.opening_hours || null,
      email,
      social,
      cuisine: tags.cuisine ? tags.cuisine.split(';')[0].replace(/_/g, ' ') : null,
      siret: tags['ref:FR:SIRET'] || null,
      tier: hasSocial ? 'social' : 'pending',
      domain: null,
    });
  }
  return { leads, stats };
}

const ARTICLES = /^(le|la|les|l|au|aux|chez|a|du|de|des|d|the)-/;

export function slugify(s) {
  return stripAccents(String(s).toLowerCase())
    .replace(/&/g, ' et ')
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** Domain names this shop would most plausibly own. First .fr entry is also the "domain to suggest". */
export function domainCandidates(name, city, trade) {
  const base = slugify(name);
  if (!base || base.length < 3) return [];
  const citySlug = slugify(city || '');
  const word = TRADES[trade]?.word;
  const noArticle = base.replace(ARTICLES, '');
  const stems = new Set([base, base.replace(/-/g, '')]);
  // a bare one-word stem ("paul", "central") is always registered by someone else: it proves nothing
  if (noArticle.includes('-') || noArticle.length >= 9) { stems.add(noArticle); stems.add(noArticle.replace(/-/g, '')); }
  if (citySlug) { stems.add(`${base}-${citySlug}`); stems.add(`${noArticle}-${citySlug}`); }
  if (word && !base.includes(word)) { stems.add(`${word}-${noArticle}`); if (citySlug) stems.add(`${word}-${noArticle}-${citySlug}`); }
  const out = [];
  for (const s of stems) {
    if (s.length < 4 || s.length > 50) continue;
    out.push(`${s}.fr`, `${s}.com`);
  }
  return out.slice(0, 14);
}

/** true = registered (someone owns it), false = NXDOMAIN (free), null = lookup failed. */
export async function isDomainRegistered(domain, { signal } = {}) {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`, {
      headers: { accept: 'application/dns-json' }, signal,
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.Status !== 3;
  } catch { return null; }
}

/**
 * Runs the domain-guess check for one lead and returns the verdict without mutating.
 * { tier, domain, taken[] }  domain = a free .fr we can suggest "à réserver au nom du commerçant".
 */
export async function verifyLead(lead, city, opts = {}) {
  const cands = domainCandidates(lead.name, city, lead.trade);
  if (!cands.length) return { tier: lead.tier === 'social' ? 'social' : 'silver', domain: null, taken: [] };
  const results = await mapLimit(cands, opts.concurrency || 6, (d) => isDomainRegistered(d, opts));
  const taken = cands.filter((_, i) => results[i] === true);
  const unknown = results.filter((r) => r === null).length;
  const free = cands.filter((d, i) => results[i] === false && d.endsWith('.fr'));
  if (taken.length) return { tier: 'silver', domain: null, taken };
  if (unknown > cands.length / 2) return { tier: lead.tier === 'social' ? 'social' : 'pending', domain: null, taken };
  return { tier: lead.tier === 'social' ? 'social' : 'gold', domain: free[0] || null, taken };
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers);
  return out;
}

/** Reverse geocoding with the French national address base (free, keyless, CORS-open). */
export async function reverseAddress(lat, lon, { signal } = {}) {
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}&limit=1`, { signal });
    if (!r.ok) return null;
    const j = await r.json();
    const p = j.features?.[0]?.properties;
    if (!p || (p.distance != null && p.distance > 60)) return null;
    return p.label || null;
  } catch { return null; }
}

export function summarize(leads) {
  const s = { leads: 0, gold: 0, social: 0, silver: 0, pending: 0, byTrade: {} };
  for (const l of leads) {
    s[l.tier] = (s[l.tier] || 0) + 1;
    if (l.tier === 'silver') continue;
    s.leads++;
    s.byTrade[l.trade] = (s.byTrade[l.trade] || 0) + 1;
  }
  return s;
}
