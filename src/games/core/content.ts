/**
 * Sélection des contenus jouables selon les packs cochés.
 * Les entrées « adulte » n'appartiennent qu'au pack No Limit : elles ne sortent que si ce pack est coché.
 */

export interface EntryLite {
  id: string;
  packs: string[];
  text: string;
  note?: string;
}

/** Entrées appartenant à au moins un des packs cochés. */
export function entriesForPacks<T extends { packs: string[] }>(entries: readonly T[], packs: readonly string[]): T[] {
  const selected = new Set(packs);
  return entries.filter((e) => e.packs.some((p) => selected.has(p)));
}

/** Index id → entrée, pour afficher le texte d'une carte à partir de son identifiant. */
export function indexById<T extends { id: string }>(entries: readonly T[]): Map<string, T> {
  return new Map(entries.map((e) => [e.id, e]));
}
