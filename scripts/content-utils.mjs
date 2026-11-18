// Fonctions pures utilisées par l'extraction des contenus (testées dans content-utils.test.mjs).

/** Normalise un texte pour détecter les doublons : casse, apostrophes, espaces et ponctuation finale. */
export function normalizeKey(text) {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/[\s.!?]+$/u, '')
    .trim();
}

/**
 * Sépare une précision finale entre parenthèses (« (Friends) », « (contrepèterie) », « (101 Dalmatiens) »)
 * pour l'afficher en plus petit. Ne touche pas aux parenthèses internes ni aux marques de genre « content(e) ».
 */
export function splitNote(raw) {
  const m = raw.match(/^(.*\S)\s+\(([^()]{2,60})\)\s*$/u);
  if (!m || !m[1] || !m[2]) return { text: raw };
  return { text: m[1], note: m[2].trim() };
}

/** Hash FNV-1a 32 bits en base 36 : identifiant stable tant que le texte ne change pas. */
export function stableId(prefix, kind, key) {
  let h = 0x811c9dc5;
  for (const ch of `${kind}|${key}`) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${prefix}${kind[0]}-${h.toString(36).padStart(7, '0')}`;
}

// Limites de mot compatibles avec les lettres accentuées (\b ne les gère pas).
const W = (body) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'iu');

/** Thèmes qui rendent une entrée « adulte » (sexe, drogue, haine, mort violente). */
const ADULT_RULES = [
  ['sexe', W('sexe|sexuel(?:le)?s?|porno\\w*|partouze\\w*|orgasm\\w*|sodom\\w*|masturb\\w*|godemich\\w*|capotes?|préservatifs?|fellation\\w*|sucer?|suce(?:s|nt)?|branl\\w*|baise[sz]?|enculé\\w*|nichons?|seins?|couilles?|bites?|pénis|vagins?|chattes?|zizis?|érotique\\w*|strip\\w*|strings?|charmes|faciale|gland|prostitu\\w*|putes?|salopes?|touché\\(e\\)|me suis touché')],
  ['drogue', W('drogues?|cannabis|cocaïne|coke|shit|beuh|joints?|héroïne|ecstasy|chicha')],
  ['haine', W('nazis?|hitler|juifs?|nègres?|pédés?|gouines?|bougnoules?')],
  ['violence', W('suicid\\w*|viol(?:é|ée|er|eur|eurs)?|pendus?')],
];

/** Mots vulgaires « légers » : l'entrée reste tout public, mais apparaît dans la liste de relecture. */
const MILD_RULE = W('merde\\w*|cul|culs|fesses?|chier|pets?|péter|con|cons|connard\\w*|emmerd\\w*|caisse');
const CUL_DE_JATTE = /cul[\s-]de[\s-]jatte/iu;

/**
 * Pré-classement automatique d'une entrée d'un pack tout public.
 * @returns {{ audience: 'tout_public' | 'adulte', reason: string }}
 */
export function classify(text, note) {
  if (note && /contrepèterie/iu.test(note)) return { audience: 'adulte', reason: 'contrepèterie' };
  const full = `${text} ${note ?? ''}`;
  for (const [reason, re] of ADULT_RULES) {
    if (re.test(full)) return { audience: 'adulte', reason };
  }
  if (MILD_RULE.test(full.replace(CUL_DE_JATTE, ''))) return { audience: 'tout_public', reason: 'vulgaire (laissé tout public)' };
  return { audience: 'tout_public', reason: 'aucun' };
}
