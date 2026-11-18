/**
 * Accès sûr à localStorage : peut être indisponible (navigation privée, stockage bloqué, rendu serveur).
 * Toutes les lectures/écritures sont protégées ; le jeu fonctionne sans, il perd seulement la reprise de partie.
 */

function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export const storage = {
  getJson<T>(key: string): T | null {
    try {
      const raw = ls()?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  setJson<T>(key: string, value: T): void {
    try {
      ls()?.setItem(key, JSON.stringify(value));
    } catch {
      /* stockage plein ou bloqué : on continue sans sauvegarde */
    }
  },
  remove(key: string): void {
    try {
      ls()?.removeItem(key);
    } catch {
      /* ignoré */
    }
  },
};
