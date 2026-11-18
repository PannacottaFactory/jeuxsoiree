/**
 * Fournisseur temps réel en mémoire, pour les tests : plusieurs « téléphones » (instances) partagent un même
 * MemoryServer. Les contrôles d'accès reproduisent ceux de database.rules.json, pour que les tests détectent un
 * client qui tenterait d'écrire là où il n'a pas le droit.
 */
import {
  HOST_TIMEOUT_MS,
  type Intent,
  type PublishPayload,
  type RoomBackend,
  type RoomMeta,
  type RoomPlayer,
  type Unsubscribe,
} from './RoomBackend';

interface RoomData {
  meta: RoomMeta;
  players: Record<string, RoomPlayer>;
  view: string | null;
  secrets: Record<string, string>;
  hostState: string | null;
  intents: Record<string, Intent>;
}

type Listener = () => void;

export class MemoryServer {
  rooms = new Map<string, RoomData>();
  /** Horloge du serveur, pilotable dans les tests. */
  now = 1_000_000;
  private listeners = new Set<Listener>();
  private seq = 0;

  notify(): void {
    for (const l of [...this.listeners]) l();
  }
  listen(l: Listener): Unsubscribe {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  nextId(): string {
    return `i${String(++this.seq).padStart(6, '0')}`;
  }
  /** Simule la perte de connexion d'un téléphone (onDisconnect). */
  disconnect(uid: string): void {
    for (const room of this.rooms.values()) {
      const p = room.players[uid];
      if (p) room.players[uid] = { ...p, online: false, lastSeen: this.now };
    }
    this.notify();
  }
  reconnect(uid: string): void {
    for (const room of this.rooms.values()) {
      const p = room.players[uid];
      if (p) room.players[uid] = { ...p, online: true, lastSeen: this.now };
    }
    this.notify();
  }
}

export class MemoryBackend implements RoomBackend {
  constructor(
    private readonly server: MemoryServer,
    readonly uid: string,
  ) {}

  serverNow(): number {
    return this.server.now;
  }

  private room(code: string): RoomData {
    const r = this.server.rooms.get(code);
    if (!r) throw new Error(`Salle inconnue : ${code}`);
    return r;
  }

  private assertHost(code: string): RoomData {
    const r = this.room(code);
    if (r.meta.hostUid !== this.uid) throw new Error('PERMISSION_DENIED : réservé à l’hôte');
    return r;
  }

  /** Abonnement générique : rappelle `cb` à chaque changement de la valeur sélectionnée. */
  private watch<T>(select: () => T, cb: (v: T) => void): Unsubscribe {
    let last = JSON.stringify(select());
    queueMicrotask(() => cb(select()));
    return this.server.listen(() => {
      const v = select();
      const s = JSON.stringify(v);
      if (s !== last) {
        last = s;
        cb(v);
      }
    });
  }

  async createRoom(code: string, meta: RoomMeta): Promise<boolean> {
    const existing = this.server.rooms.get(code);
    if (existing && existing.meta.expiresAt > this.server.now) return false;
    this.server.rooms.set(code, { meta, players: {}, view: null, secrets: {}, hostState: null, intents: {} });
    this.server.notify();
    return true;
  }

  async purgeExpired(): Promise<void> {
    for (const [code, r] of this.server.rooms) if (r.meta.expiresAt < this.server.now) this.server.rooms.delete(code);
    this.server.notify();
  }

  async getMeta(code: string): Promise<RoomMeta | null> {
    return this.server.rooms.get(code)?.meta ?? null;
  }

  async join(code: string, player: { name: string; team?: 0 | 1 }): Promise<void> {
    const r = this.room(code);
    const existing = r.players[this.uid];
    r.players[this.uid] = {
      name: player.name.slice(0, 20),
      ...(player.team !== undefined ? { team: player.team } : existing?.team !== undefined ? { team: existing.team } : {}),
      joinedAt: existing?.joinedAt ?? this.server.now,
      online: true,
      lastSeen: this.server.now,
    };
    this.server.notify();
  }

  async leave(code: string): Promise<void> {
    const r = this.server.rooms.get(code);
    if (r) delete r.players[this.uid];
    this.server.notify();
  }

  watchMeta(code: string, cb: (meta: RoomMeta | null) => void): Unsubscribe {
    return this.watch(() => this.server.rooms.get(code)?.meta ?? null, cb);
  }
  watchPlayers(code: string, cb: (players: Record<string, RoomPlayer>) => void): Unsubscribe {
    return this.watch(() => ({ ...(this.server.rooms.get(code)?.players ?? {}) }), cb);
  }
  watchView(code: string, cb: (view: string | null) => void): Unsubscribe {
    return this.watch(() => {
      const r = this.server.rooms.get(code);
      return r && r.players[this.uid] ? r.view : null; // règle : réservé aux membres
    }, cb);
  }
  watchSecret(code: string, cb: (secret: string | null) => void): Unsubscribe {
    return this.watch(() => this.server.rooms.get(code)?.secrets[this.uid] ?? null, cb);
  }

  async pushIntent(code: string, action: string, at: number): Promise<void> {
    const r = this.room(code);
    if (!r.players[this.uid]) throw new Error('PERMISSION_DENIED : pas membre de la salle');
    const id = this.server.nextId();
    r.intents[id] = { id, uid: this.uid, action, at };
    this.server.notify();
  }

  watchIntents(code: string, cb: (intent: Intent) => void): Unsubscribe {
    this.assertHost(code);
    const seen = new Set<string>();
    const scan = () => {
      const r = this.server.rooms.get(code);
      if (!r || r.meta.hostUid !== this.uid) return;
      for (const i of Object.values(r.intents).sort((a, b) => a.id.localeCompare(b.id))) {
        if (!seen.has(i.id)) {
          seen.add(i.id);
          cb(i);
        }
      }
    };
    queueMicrotask(scan);
    return this.server.listen(scan);
  }

  async removeIntent(code: string, intent: Intent): Promise<void> {
    delete this.assertHost(code).intents[intent.id];
  }

  async publish(code: string, payload: PublishPayload): Promise<void> {
    const r = this.assertHost(code);
    r.view = payload.view;
    r.secrets = { ...payload.secrets };
    r.hostState = payload.hostState;
    if (payload.meta) r.meta = { ...r.meta, ...payload.meta };
    this.server.notify();
  }

  async readHostState(code: string): Promise<string | null> {
    return this.assertHost(code).hostState;
  }

  async updateMeta(code: string, patch: Partial<Pick<RoomMeta, 'status' | 'expiresAt' | 'config'>>): Promise<void> {
    const r = this.assertHost(code);
    r.meta = { ...r.meta, ...patch };
    this.server.notify();
  }

  async setPlayer(code: string, uid: string, patch: { team: 0 | 1 } | null): Promise<void> {
    const r = this.assertHost(code);
    if (patch === null) delete r.players[uid];
    else if (r.players[uid]) r.players[uid] = { ...r.players[uid]!, team: patch.team };
    this.server.notify();
  }

  async claimHost(code: string): Promise<boolean> {
    const r = this.room(code);
    const host = r.players[r.meta.hostUid];
    const hostGone = !host || (!host.online && this.server.now - host.lastSeen > HOST_TIMEOUT_MS);
    if (!r.players[this.uid] || !hostGone) return false;
    r.meta = { ...r.meta, hostUid: this.uid };
    this.server.notify();
    return true;
  }
}
