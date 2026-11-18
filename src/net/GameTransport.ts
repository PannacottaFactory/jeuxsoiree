/**
 * Couche réseau abstraite : l'UI d'un jeu ne connaît que cette interface.
 *
 * - LocalTransport (phase 3) : un seul téléphone, le réducteur tourne sur place.
 * - FirebaseTransport (phase 4) : l'hôte applique le réducteur et publie l'état ; les invités envoient des intentions.
 *
 * Les moteurs restent indépendants du transport : ils exposent seulement `reduce(state, action)`.
 */
export interface GameTransport<State, Action> {
  /** État courant de la partie. */
  getState(): State;
  /** Abonnement aux changements d'état ; retourne la fonction de désabonnement. */
  subscribe(listener: (state: State) => void): () => void;
  /** Envoie une action (en local : appliquée immédiatement ; en ligne : intention transmise à l'hôte). */
  dispatch(action: Action): void;
  /** Ferme la partie (libère les ressources, efface la sauvegarde locale si demandé). */
  close(options?: { forget?: boolean }): void;
}

export type Reducer<State, Action> = (state: State, action: Action) => State;
