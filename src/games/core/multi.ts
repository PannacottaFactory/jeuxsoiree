/**
 * Contrat d'un jeu en multijoueur. L'hôte s'en sert pour :
 *  - valider la composition du lobby et créer la partie ;
 *  - appliquer les actions reçues (après autorisation) ;
 *  - déclencher les actions automatiques (fin de chrono) ;
 *  - produire ce que chaque téléphone a le droit de voir : une vue publique + une vue secrète par joueur.
 *
 * L'état complet (pioche, générateur aléatoire…) ne sort jamais de l'hôte : les invités ne reçoivent que des vues,
 * avec les textes déjà résolus (ils n'ont donc pas besoin des contenus du jeu).
 */
import type { GameSlug } from '../meta';
import type { Player } from './players';
import type { EntryLite } from './content';

export interface MultiAdapter<S extends { phase: string }, A, V, Sec, Cfg> {
  game: GameSlug;
  defaultConfig(): Cfg;
  /** Message bloquant à afficher dans le lobby, ou null si la partie peut démarrer. */
  validate(players: Player[], config: Cfg): string | null;
  create(players: Player[], config: Cfg, seed: number): S;
  reduce(state: S, action: A): S;
  /** Joueurs dont on attend une action dans la phase courante (pour le secours de l'hôte). */
  actors(state: S): string[];
  /**
   * Le joueur `uid` a-t-il le droit d'envoyer cette action ? L'hôte peut en plus agir à la place des joueurs attendus
   * s'ils sont tous hors ligne (géré par la session).
   */
  authorize(state: S, action: A, uid: string): boolean;
  /** Action que l'hôte doit déclencher lui-même à une date donnée (fin de chrono), ou null. */
  scheduled(state: S): { at: number; action: A } | null;
  project(state: S): { view: V; secrets: Record<string, Sec> };
}

/** N'importe quel adaptateur (pour les registres et la session générique). */
export type AnyAdapter = MultiAdapter<any, any, any, any, any>;

/** Texte d'une entrée, prêt à afficher. */
export interface TextRef {
  text: string;
  note?: string;
}

export function textOf(index: Map<string, EntryLite>, id: string | null | undefined): TextRef | null {
  if (!id) return null;
  const e = index.get(id);
  if (!e) return null;
  return e.note ? { text: e.text, note: e.note } : { text: e.text };
}
