/**
 * Chargement à la demande des contenus + adaptateur multijoueur d'un jeu.
 * Utilisé par l'hôte, y compris par un invité qui devient hôte en cours de partie (transfert d'hôte) :
 * les contenus ne sont téléchargés que par le téléphone qui fait autorité.
 */
import type { GameSlug } from './meta';
import type { AnyAdapter } from './core/multi';
import type { EntryLite } from './core/content';

interface RawEntry {
  id: string;
  packs: string[];
  text: string;
  note?: string;
}
interface RawPack {
  id: string;
  audience: string;
}

/** Entrées des packs autorisés : en salle tout public, les packs adultes sont exclus. */
function lite(entries: RawEntry[], packs: RawPack[], adult: boolean): EntryLite[] {
  const ok = new Set(packs.filter((p) => adult || p.audience === 'tout_public').map((p) => p.id));
  return entries
    .filter((e) => e.packs.some((p) => ok.has(p)))
    .map((e) => ({ id: e.id, packs: e.packs.filter((p) => ok.has(p)), text: e.text, ...(e.note ? { note: e.note } : {}) }));
}

export async function loadAdapter(game: GameSlug, adult: boolean): Promise<AnyAdapter> {
  switch (game) {
    case 'rigolol': {
      const [{ default: c }, { rigololAdapter }] = await Promise.all([import('~/data/rigolol/content.json'), import('./rigolol/multi')]);
      return rigololAdapter(lite(c.phrases, c.packs, adult));
    }
    case 'mimos': {
      const [{ default: c }, { mimosAdapter }] = await Promise.all([import('~/data/mimos/content.json'), import('./mimos/multi')]);
      return mimosAdapter(lite(c.subjects, c.packs, adult), lite(c.actions, c.packs, adult));
    }
    case 'takotac': {
      const [{ default: c }, { takotacAdapter }] = await Promise.all([import('~/data/takotac/content.json'), import('./takotac/multi')]);
      return takotacAdapter(lite(c.categories, c.packs, adult));
    }
  }
}
