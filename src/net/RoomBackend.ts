/**
 * Interface d'un fournisseur temps réel pour les salles multijoueur.
 * Implémentations : FirebaseBackend (production) et MemoryBackend (tests).
 * Changer de fournisseur (Supabase, WebSocket maison…) = écrire une nouvelle implémentation de cette interface,
 * sans toucher aux moteurs ni à l'UI.
 *
 * Toutes les dates sont en millisecondes, sur l'horloge du serveur (`serverNow()`), commune à tous les téléphones.
 */
import type { GameSlug } from '~/games/meta';

export type Unsubscribe = () => void;

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomMeta {
  game: GameSlug;
  /** Salle du mode No Limit (avertissement 18+ à l'entrée). */
  adult: boolean;
  hostUid: string;
  status: RoomStatus;
  createdAt: number;
  /** Au-delà, la salle est considérée comme abandonnée et peut être supprimée. */
  expiresAt: number;
  /** Configuration choisie par l'hôte (packs, mode…), sérialisée en JSON. */
  config: string;
}

export interface RoomPlayer {
  name: string;
  /** Équipe (Mimos en mode équipes). */
  team?: 0 | 1;
  joinedAt: number;
  online: boolean;
  lastSeen: number;
}

export interface Intent {
  id: string;
  uid: string;
  /** Action de jeu sérialisée en JSON. */
  action: string;
  at: number;
}

export interface PublishPayload {
  /** Vue publique (JSON), lisible par tous les joueurs de la salle. */
  view: string;
  /** Vues secrètes (JSON) par joueur, lisibles uniquement par le joueur concerné. */
  secrets: Record<string, string>;
  /** État complet du moteur (JSON), lisible uniquement par l'hôte : sert à la reprise et au transfert d'hôte. */
  hostState: string;
  meta?: Partial<Pick<RoomMeta, 'status' | 'expiresAt' | 'config'>>;
}

export interface RoomBackend {
  /** Identifiant stable de ce téléphone (survit au rafraîchissement). */
  readonly uid: string;
  serverNow(): number;

  /** Crée la salle si le code est libre (ou expiré). Retourne false si le code est déjà pris. */
  createRoom(code: string, meta: RoomMeta): Promise<boolean>;
  /** Supprime quelques salles expirées (ménage opportuniste, pas de serveur). */
  purgeExpired(): Promise<void>;
  getMeta(code: string): Promise<RoomMeta | null>;

  /** Entre dans la salle (ou y revient) et active la présence en ligne / hors ligne. */
  join(code: string, player: { name: string; team?: 0 | 1 }): Promise<void>;
  leave(code: string): Promise<void>;

  watchMeta(code: string, cb: (meta: RoomMeta | null) => void): Unsubscribe;
  watchPlayers(code: string, cb: (players: Record<string, RoomPlayer>) => void): Unsubscribe;
  watchView(code: string, cb: (view: string | null) => void): Unsubscribe;
  watchSecret(code: string, cb: (secret: string | null) => void): Unsubscribe;
  pushIntent(code: string, action: string, at: number): Promise<void>;

  /* ---------- Réservé à l'hôte (vérifié par les règles de sécurité) ---------- */
  watchIntents(code: string, cb: (intent: Intent) => void): Unsubscribe;
  removeIntent(code: string, intent: Intent): Promise<void>;
  publish(code: string, payload: PublishPayload): Promise<void>;
  readHostState(code: string): Promise<string | null>;
  updateMeta(code: string, patch: Partial<Pick<RoomMeta, 'status' | 'expiresAt' | 'config'>>): Promise<void>;
  /** Modifie (équipe) ou retire (null) un joueur. */
  setPlayer(code: string, uid: string, patch: { team: 0 | 1 } | null): Promise<void>;

  /** Prend la place d'un hôte hors ligne depuis plus de HOST_TIMEOUT_MS. Retourne true en cas de succès. */
  claimHost(code: string): Promise<boolean>;
}

/** Délai de silence de l'hôte avant qu'un invité puisse prendre sa place (vérifié aussi par les règles). */
export const HOST_TIMEOUT_MS = 30_000;
/** Durée de vie d'une salle sans activité. */
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
