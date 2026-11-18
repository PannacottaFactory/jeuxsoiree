/**
 * Transport « un seul téléphone » : le réducteur du jeu tourne sur l'appareil.
 * L'état est sauvegardé dans localStorage à chaque action : un rafraîchissement ou une mise en veille ne perd pas la
 * partie (on propose de la reprendre).
 */
import type { GameTransport, Reducer } from './GameTransport';
import { storage } from '~/ui/storage';

/** Version du format sauvegardé : à incrémenter si la forme des états change (les vieilles sauvegardes sont ignorées). */
export const SAVE_VERSION = 1;

interface SavedGame<State> {
  v: number;
  savedAt: number;
  state: State;
}

/** Une partie sauvegardée depuis plus longtemps est considérée comme abandonnée. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export class LocalTransport<State, Action> implements GameTransport<State, Action> {
  private listeners = new Set<(state: State) => void>();

  constructor(
    private readonly reducer: Reducer<State, Action>,
    private state: State,
    private readonly saveKey?: string,
  ) {
    this.save();
  }

  /** Recharge une partie sauvegardée, ou null si absente, trop ancienne ou d'un ancien format. */
  static loadSaved<State>(saveKey: string): State | null {
    const saved = storage.getJson<SavedGame<State>>(saveKey);
    if (!saved || saved.v !== SAVE_VERSION || Date.now() - saved.savedAt > MAX_AGE_MS) return null;
    return saved.state;
  }

  static forget(saveKey: string): void {
    storage.remove(saveKey);
  }

  getState(): State {
    return this.state;
  }

  subscribe(listener: (state: State) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(action: Action): void {
    const next = this.reducer(this.state, action);
    if (next === this.state) return; // action ignorée par le moteur
    this.state = next;
    this.save();
    for (const l of this.listeners) l(next);
  }

  close(options?: { forget?: boolean }): void {
    this.listeners.clear();
    if (options?.forget && this.saveKey) storage.remove(this.saveKey);
  }

  private save(): void {
    if (!this.saveKey) return;
    storage.setJson<SavedGame<State>>(this.saveKey, { v: SAVE_VERSION, savedAt: Date.now(), state: this.state });
  }
}
