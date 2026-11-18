/**
 * Connexion paresseuse au temps réel : le SDK Firebase n'est téléchargé que si l'on joue « chacun son téléphone ».
 */
import type { RoomBackend } from '~/net/RoomBackend';
import type { GameSlug } from '~/games/meta';
import { storage } from '../storage';

let backend: Promise<RoomBackend> | null = null;

export function openBackend(): Promise<RoomBackend> {
  backend ??= import('~/net/firebase/FirebaseBackend').then((m) => m.FirebaseBackend.connect());
  backend.catch(() => {
    backend = null; // nouvel essai possible après une erreur réseau
  });
  return backend;
}

export function adapterLoader(game: GameSlug, adult: boolean) {
  return () => import('~/games/registry').then((m) => m.loadAdapter(game, adult));
}

/** Dernière salle rejointe sur ce téléphone, pour proposer d'y revenir après un rafraîchissement. */
export interface SavedRoom {
  code: string;
  game: GameSlug;
  adult: boolean;
  savedAt: number;
}

const ROOM_KEY = 'jds:room';
const NAME_KEY = 'jds:name';

export const savedRoom = {
  get(): SavedRoom | null {
    const r = storage.getJson<SavedRoom>(ROOM_KEY);
    return r && Date.now() - r.savedAt < 6 * 60 * 60 * 1000 ? r : null;
  },
  set(r: Omit<SavedRoom, 'savedAt'>): void {
    storage.setJson(ROOM_KEY, { ...r, savedAt: Date.now() });
  },
  clear(): void {
    storage.remove(ROOM_KEY);
  },
};

export const savedName = {
  get: () => storage.getJson<string>(NAME_KEY) ?? '',
  set: (n: string) => storage.setJson(NAME_KEY, n),
};
