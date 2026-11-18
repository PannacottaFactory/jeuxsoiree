/**
 * Implémentation de RoomBackend sur Firebase Realtime Database + authentification anonyme.
 * Chargée uniquement quand on joue « chacun son téléphone » (import dynamique) : les autres pages n'embarquent pas
 * le SDK Firebase.
 *
 * Arborescence (voir database.rules.json) :
 *   rooms/{code}/meta          métadonnées (lecture : tout utilisateur authentifié qui connaît le code)
 *   rooms/{code}/players/{uid} fiche joueur + présence (écriture : le joueur lui-même)
 *   rooms/{code}/view          vue publique (lecture : membres de la salle ; écriture : hôte)
 *   rooms/{code}/secrets/{uid} vue secrète (lecture : ce joueur seulement ; écriture : hôte)
 *   rooms/{code}/hostState     état complet du moteur (hôte seulement)
 *   rooms/{code}/intents/{id}  intentions des joueurs (écriture : membres ; lecture/suppression : hôte)
 *   expiry/{tranche}/rooms/{code}  index d'expiration par tranche d'une heure, pour le ménage des salles abandonnées :
 *                              une tranche n'est lisible qu'une fois écoulée (aucun code de salle active n'est exposé)
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type Auth } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  type Database,
} from 'firebase/database';
import { EMULATOR, firebaseConfig } from './config';
import type { Intent, PublishPayload, RoomBackend, RoomMeta, RoomPlayer, Unsubscribe } from '../RoomBackend';

const HOUR = 3_600_000;
/** Nombre de tranches passées inspectées à chaque création de salle. */
const PURGE_LOOKBACK_HOURS = 24;

/** Tranche d'expiration : la tranche qui suit l'expiration (sa fin est toujours dans le futur au moment de l'écriture). */
export function expiryBucket(expiresAt: number, bucketMs = HOUR): number {
  return Math.floor(expiresAt / bucketMs) + 1;
}

function isPermissionDenied(e: unknown): boolean {
  return e instanceof Error && /permission/i.test(`${(e as { code?: string }).code ?? ''} ${e.message}`);
}

export class FirebaseBackend implements RoomBackend {
  private offset = 0;
  private presence = new Map<string, Unsubscribe>();

  private constructor(
    private readonly db: Database,
    readonly uid: string,
    /** Taille d'une tranche d'expiration (1 h ; réduite dans les tests). */
    private readonly bucketMs = HOUR,
  ) {
    onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      this.offset = Number(snap.val()) || 0;
    });
  }

  /** Initialise Firebase et ouvre une session anonyme (réutilisée après rafraîchissement : même uid). */
  static async connect(options: { appName?: string; emulator?: boolean; bucketMs?: number } = {}): Promise<FirebaseBackend> {
    const { appName = '[DEFAULT]', emulator = EMULATOR.enabled, bucketMs = HOUR } = options;
    const app: FirebaseApp = getApps().find((a) => a.name === appName) ?? initializeApp(firebaseConfig, appName);
    const auth: Auth = getAuth(app);
    const db = getDatabase(app);
    if (emulator && !(auth as { emulatorConfig?: unknown }).emulatorConfig) {
      connectAuthEmulator(auth, `http://${EMULATOR.host}:${EMULATOR.authPort}`, { disableWarnings: true });
      connectDatabaseEmulator(db, EMULATOR.host, EMULATOR.databasePort);
    }
    const user = await new Promise<Auth['currentUser']>((resolve) => {
      const off = onAuthStateChanged(auth, (u) => {
        off();
        resolve(u);
      });
    });
    const uid = user?.uid ?? (await signInAnonymously(auth)).user.uid;
    return new FirebaseBackend(db, uid, bucketMs);
  }

  serverNow(): number {
    return Date.now() + this.offset;
  }

  private r(path: string) {
    return ref(this.db, path);
  }

  async createRoom(code: string, meta: RoomMeta): Promise<boolean> {
    try {
      // Écrase une éventuelle salle expirée (les règles refusent si la salle est active et appartient à un autre).
      await set(this.r(`rooms/${code}`), { meta });
      await this.indexExpiry(code, meta.expiresAt);
      return true;
    } catch (e) {
      if (isPermissionDenied(e)) return false;
      throw e;
    }
  }

  /** Inscrit la salle dans la tranche d'expiration correspondante (crée la tranche si besoin). */
  private async indexExpiry(code: string, expiresAt: number): Promise<void> {
    const bucket = expiryBucket(expiresAt, this.bucketMs);
    // `end` est immuable : si la tranche existe déjà, l'écriture est refusée, ce qui est attendu.
    await set(this.r(`expiry/${bucket}/end`), bucket * this.bucketMs).catch(() => undefined);
    await set(this.r(`expiry/${bucket}/rooms/${code}`), true).catch(() => undefined);
  }

  async purgeExpired(): Promise<void> {
    const current = expiryBucket(this.serverNow(), this.bucketMs) - 1;
    const buckets = Array.from({ length: PURGE_LOOKBACK_HOURS }, (_, i) => current - 1 - i);
    await Promise.all(
      buckets.map(async (bucket) => {
        const snap = await get(this.r(`expiry/${bucket}`)).catch(() => null);
        const rooms = Object.keys(((snap?.val() as { rooms?: Record<string, true> } | null) ?? {}).rooms ?? {});
        // Les règles ne laissent supprimer que les salles réellement expirées : une entrée périmée (salle prolongée
        // depuis) échoue sans dommage.
        await Promise.all(rooms.map((code) => remove(this.r(`rooms/${code}`)).catch(() => undefined)));
        if (snap?.exists()) await remove(this.r(`expiry/${bucket}`)).catch(() => undefined);
      }),
    );
  }

  async getMeta(code: string): Promise<RoomMeta | null> {
    const snap = await get(this.r(`rooms/${code}/meta`));
    return (snap.val() as RoomMeta | null) ?? null;
  }

  async join(code: string, player: { name: string; team?: 0 | 1 }): Promise<void> {
    const path = `rooms/${code}/players/${this.uid}`;
    const existing = (await get(this.r(path))).val() as RoomPlayer | null;
    const team = player.team ?? existing?.team;
    await set(this.r(path), {
      name: player.name.slice(0, 20),
      ...(team !== undefined ? { team } : {}),
      joinedAt: existing?.joinedAt ?? this.serverNow(),
      online: true,
      lastSeen: serverTimestamp(),
    });
    // Présence : hors ligne automatiquement à la déconnexion, en ligne à chaque reconnexion.
    this.presence.get(code)?.();
    const off = onValue(this.r('.info/connected'), (snap) => {
      if (snap.val() !== true) return;
      void onDisconnect(this.r(path))
        .update({ online: false, lastSeen: serverTimestamp() })
        .then(() => update(this.r(path), { online: true, lastSeen: serverTimestamp() }))
        .catch(() => undefined);
    });
    this.presence.set(code, off);
  }

  async leave(code: string): Promise<void> {
    this.presence.get(code)?.();
    this.presence.delete(code);
    const path = `rooms/${code}/players/${this.uid}`;
    await onDisconnect(this.r(path)).cancel();
    await remove(this.r(path));
  }

  private watchValue<T>(path: string, cb: (v: T | null) => void): Unsubscribe {
    return onValue(
      this.r(path),
      (snap) => cb((snap.val() as T | null) ?? null),
      () => cb(null), // accès refusé (ex. joueur retiré) : on traite comme une absence de données
    );
  }

  watchMeta(code: string, cb: (meta: RoomMeta | null) => void): Unsubscribe {
    return this.watchValue(`rooms/${code}/meta`, cb);
  }
  watchPlayers(code: string, cb: (players: Record<string, RoomPlayer>) => void): Unsubscribe {
    return this.watchValue<Record<string, RoomPlayer>>(`rooms/${code}/players`, (v) => cb(v ?? {}));
  }
  watchView(code: string, cb: (view: string | null) => void): Unsubscribe {
    return this.watchValue(`rooms/${code}/view`, cb);
  }
  watchSecret(code: string, cb: (secret: string | null) => void): Unsubscribe {
    return this.watchValue(`rooms/${code}/secrets/${this.uid}`, cb);
  }

  async pushIntent(code: string, action: string, at: number): Promise<void> {
    await push(this.r(`rooms/${code}/intents`), { uid: this.uid, action, at });
  }

  watchIntents(code: string, cb: (intent: Intent) => void): Unsubscribe {
    return onChildAdded(this.r(`rooms/${code}/intents`), (snap) => {
      const v = snap.val() as Omit<Intent, 'id'> | null;
      if (v && snap.key) cb({ id: snap.key, uid: v.uid, action: v.action, at: v.at });
    });
  }

  async removeIntent(code: string, intent: Intent): Promise<void> {
    await remove(this.r(`rooms/${code}/intents/${intent.id}`));
  }

  async publish(code: string, payload: PublishPayload): Promise<void> {
    const updates: Record<string, unknown> = {
      [`rooms/${code}/view`]: payload.view,
      [`rooms/${code}/secrets`]: payload.secrets,
      [`rooms/${code}/hostState`]: payload.hostState,
    };
    if (payload.meta?.status) updates[`rooms/${code}/meta/status`] = payload.meta.status;
    if (payload.meta?.config) updates[`rooms/${code}/meta/config`] = payload.meta.config;
    if (payload.meta?.expiresAt) updates[`rooms/${code}/meta/expiresAt`] = payload.meta.expiresAt;
    await update(ref(this.db), updates);
    if (payload.meta?.expiresAt) await this.reindexIfNeeded(code, payload.meta.expiresAt);
  }

  private indexedBucket = new Map<string, number>();

  /** Réinscrit la salle quand sa prolongation la fait changer de tranche (une écriture par heure au plus). */
  private async reindexIfNeeded(code: string, expiresAt: number): Promise<void> {
    const bucket = expiryBucket(expiresAt, this.bucketMs);
    if (this.indexedBucket.get(code) === bucket) return;
    this.indexedBucket.set(code, bucket);
    await this.indexExpiry(code, expiresAt);
  }

  async readHostState(code: string): Promise<string | null> {
    return ((await get(this.r(`rooms/${code}/hostState`))).val() as string | null) ?? null;
  }

  async updateMeta(code: string, patch: Partial<Pick<RoomMeta, 'status' | 'expiresAt' | 'config'>>): Promise<void> {
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) updates[`rooms/${code}/meta/${k}`] = v;
    await update(ref(this.db), updates);
    if (patch.expiresAt) await this.reindexIfNeeded(code, patch.expiresAt);
  }

  async setPlayer(code: string, uid: string, patch: { team: 0 | 1 } | null): Promise<void> {
    const path = `rooms/${code}/players/${uid}`;
    if (patch === null) await remove(this.r(path));
    else await update(this.r(path), patch);
  }

  async claimHost(code: string): Promise<boolean> {
    try {
      await set(this.r(`rooms/${code}/meta/hostUid`), this.uid);
      return true;
    } catch (e) {
      if (isPermissionDenied(e)) return false;
      throw e;
    }
  }
}
