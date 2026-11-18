/**
 * Codes de salle : 4 lettres sans caractères ambigus (pas de I, L, O, ni de chiffres).
 * 23⁴ ≈ 280 000 combinaisons : largement assez pour des salles qui expirent en quelques heures.
 */

export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
/** Même règle que dans database.rules.json. */
export const ROOM_CODE_PATTERN = /^[A-HJKMNP-Z]{4}$/;

export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)];
  return code;
}

/** Normalise une saisie (« abcd », « a b c d ») ; retourne null si ce n'est pas un code valide. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z]/g, '');
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}
