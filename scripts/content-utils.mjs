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
