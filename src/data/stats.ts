/**
 * Chiffres affichés sur les pages SEO (« plus de 500 phrases »…), calculés au build à partir des contenus.
 */
import type { ContentEntry, Pack } from './schema';
import { getValidatedContent } from './validate';

export interface PackStats {
  pack: Pack;
  /** Nombre d'entrées par type (phrases, sujets, actions, catégories). */
  counts: Record<string, number>;
}

function countByPack(packs: Pack[], lists: Record<string, ContentEntry[]>): PackStats[] {
  return packs.map((pack) => ({
    pack,
    counts: Object.fromEntries(
      Object.entries(lists).map(([name, list]) => [name, list.filter((e) => e.packs.includes(pack.id)).length]),
    ),
  }));
}

/** Arrondi « commercial » vers le bas (897 → 850, 533 → 500) pour des formulations « plus de N ». */
export function roundDown(n: number): number {
  const step = n >= 200 ? 50 : 10;
  return Math.floor(n / step) * step;
}

export function getStats() {
  const c = getValidatedContent();
  return {
    rigolol: { total: c.rigolol.phrases.length, packs: countByPack(c.rigolol.packs, { phrases: c.rigolol.phrases }) },
    mimos: {
      total: c.mimos.subjects.length * c.mimos.actions.length,
      subjects: c.mimos.subjects.length,
      actions: c.mimos.actions.length,
      packs: countByPack(c.mimos.packs, { subjects: c.mimos.subjects, actions: c.mimos.actions }),
    },
    takotac: { total: c.takotac.categories.length, packs: countByPack(c.takotac.packs, { categories: c.takotac.categories }) },
  };
}
