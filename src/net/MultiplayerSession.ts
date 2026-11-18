/**
 * Session multijoueur, indépendante du fournisseur temps réel (RoomBackend) et du jeu (MultiAdapter).
 *
 * L'HÔTE fait autorité :
 *  - il garde l'état complet du moteur, applique les intentions reçues après autorisation, déclenche les fins de chrono ;
 *  - il publie une vue publique + une vue secrète par joueur, et l'état complet (lisible par lui seul) pour la reprise.
 * Les INVITÉS envoient des intentions et affichent les vues reçues.
 *
 * Reconnexion : l'identifiant du téléphone (uid) est stable ; revenir dans la salle réutilise la même fiche joueur.
 * Transfert d'hôte : si l'hôte est hors ligne depuis plus de HOST_TIMEOUT_MS, le joueur en ligne arrivé le plus tôt
 * prend sa place (les règles de sécurité vérifient la même condition) et reprend la partie depuis l'état sauvegardé.
 */
import { HOST_TIMEOUT_MS, ROOM_TTL_MS, type Intent, type RoomBackend, type RoomMeta, type RoomPlayer, type Unsubscribe } from './RoomBackend';
import { generateRoomCode } from './roomCode';
import type { AnyAdapter } from '~/games/core/multi';
import type { Player } from '~/games/core/players';
import type { GameSlug } from '~/games/meta';
import { randomSeed } from '~/games/core/rng';

/** Tolérance sur l'horodatage envoyé par un invité (compense la latence réseau sans permettre de tricher). */
const MAX_CLIENT_LAG_MS = 2_000;
/** Fréquence de vérification de la présence de l'hôte. */
const HOST_CHECK_INTERVAL_MS = 5_000;

export interface LobbyPlayer {
  uid: string;
  name: string;
  team?: 0 | 1;
  online: boolean;
  joinedAt: number;
  isHost: boolean;
}

export type SessionStatus = 'connecting' | 'lobby' | 'playing' | 'finished' | 'closed';

export interface SessionSnapshot<V = unknown, Sec = unknown, Cfg = unknown> {
  status: SessionStatus;
  code: string;
  me: string;
  isHost: boolean;
  meta: RoomMeta | null;
  config: Cfg | null;
  players: LobbyPlayer[];
  view: V | null;
  secret: Sec | null;
  /** serverNow - Date.now() : à ajouter à l'horloge locale pour afficher les chronos. */
  clockOffset: number;
  /** Message d'erreur à afficher (salle supprimée, exclusion…). */
  error: string | null;
}

type AdapterLoader = () => Promise<AnyAdapter>;

const parse = <T>(json: string | null): T | null => {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
};

export class MultiplayerSession<V = unknown, Sec = unknown, Cfg = unknown> {
  private snap: SessionSnapshot<V, Sec, Cfg>;
  private listeners = new Set<(s: SessionSnapshot<V, Sec, Cfg>) => void>();
  private unsubs: Unsubscribe[] = [];
  private hostUnsubs: Unsubscribe[] = [];
  private adapter: AnyAdapter | null = null;
  /** État complet du moteur (hôte uniquement). */
  private state: { phase: string } | null = null;
  private hosting = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private hostCheck: ReturnType<typeof setInterval> | null = null;
  private publishChain: Promise<void> = Promise.resolve();
  private rawPlayers: Record<string, RoomPlayer> = {};
  private claiming = false;
  private wasMember = false;

  private constructor(
    private readonly backend: RoomBackend,
    private readonly loadAdapter: AdapterLoader,
    readonly code: string,
  ) {
    this.snap = {
      status: 'connecting',
      code,
      me: backend.uid,
      isHost: false,
      meta: null,
      config: null,
      players: [],
      view: null,
      secret: null,
      clockOffset: backend.serverNow() - Date.now(),
      error: null,
    };
  }

  /* ------------------------------------------------------------------ Création / connexion */

  /** Crée une salle (code libre tiré au hasard) et y entre comme hôte. */
  static async create(
    backend: RoomBackend,
    loadAdapter: AdapterLoader,
    opts: { game: GameSlug; adult: boolean; name: string },
  ): Promise<MultiplayerSession> {
    await backend.purgeExpired().catch(() => undefined);
    const adapter = await loadAdapter();
    const now = backend.serverNow();
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateRoomCode();
      const meta: RoomMeta = {
        game: opts.game,
        adult: opts.adult,
        hostUid: backend.uid,
        status: 'lobby',
        createdAt: now,
        expiresAt: now + ROOM_TTL_MS,
        config: JSON.stringify(adapter.defaultConfig()),
      };
      if (await backend.createRoom(code, meta)) {
        const session = new MultiplayerSession(backend, async () => adapter, code);
        session.adapter = adapter;
        await backend.join(code, { name: opts.name });
        session.connect();
        return session;
      }
    }
    throw new Error('Impossible de créer une salle, réessaie dans un instant.');
  }

  /** Lit la salle sans y entrer (page « rejoindre » : jeu, mode 18+, existence). */
  static async peek(backend: RoomBackend, code: string): Promise<RoomMeta | null> {
    const meta = await backend.getMeta(code);
    return meta && meta.expiresAt > backend.serverNow() ? meta : null;
  }

  /** Entre (ou revient) dans une salle existante. */
  static async join(backend: RoomBackend, loadAdapter: AdapterLoader, code: string, name: string): Promise<MultiplayerSession> {
    const meta = await MultiplayerSession.peek(backend, code);
    if (!meta) throw new Error('Cette salle n’existe pas ou a expiré.');
    await backend.join(code, { name });
    const session = new MultiplayerSession(backend, loadAdapter, code);
    session.connect();
    return session;
  }

  private connect(): void {
    this.unsubs.push(
      this.backend.watchMeta(this.code, (meta) => this.onMeta(meta)),
      this.backend.watchPlayers(this.code, (players) => this.onPlayers(players)),
      this.backend.watchView(this.code, (view) => this.update({ view: parse<V>(view) })),
      this.backend.watchSecret(this.code, (secret) => this.update({ secret: parse<Sec>(secret) })),
    );
    this.hostCheck = setInterval(() => void this.maybeClaimHost(), HOST_CHECK_INTERVAL_MS);
  }

  /* ------------------------------------------------------------------ Abonnement UI */

  getSnapshot(): SessionSnapshot<V, Sec, Cfg> {
    return this.snap;
  }

  subscribe(listener: (s: SessionSnapshot<V, Sec, Cfg>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(patch: Partial<SessionSnapshot<V, Sec, Cfg>>): void {
    this.snap = { ...this.snap, ...patch, clockOffset: this.backend.serverNow() - Date.now() };
    for (const l of this.listeners) l(this.snap);
  }

  /* ------------------------------------------------------------------ Événements de la salle */

  private onMeta(meta: RoomMeta | null): void {
    if (!meta) {
      this.update({ status: 'closed', meta: null, error: 'La salle a été fermée.' });
      this.close();
      return;
    }
    const isHost = meta.hostUid === this.backend.uid;
    this.update({ meta, isHost, status: meta.status, config: parse<Cfg>(meta.config), players: this.lobbyPlayers(meta) });
    if (isHost && !this.hosting) void this.becomeHost();
    if (!isHost && this.hosting) this.stopHosting();
  }

  private onPlayers(players: Record<string, RoomPlayer>): void {
    this.rawPlayers = players;
    const member = !!players[this.backend.uid];
    if (this.wasMember && !member && this.snap.status !== 'closed') {
      this.update({ status: 'closed', error: 'Tu as été retiré de la salle.' });
      this.close();
      return;
    }
    this.wasMember ||= member;
    this.update({ players: this.lobbyPlayers(this.snap.meta) });
    void this.maybeClaimHost();
  }

  private lobbyPlayers(meta: RoomMeta | null): LobbyPlayer[] {
    return Object.entries(this.rawPlayers)
      .map(([uid, p]) => ({
        uid,
        name: p.name,
        ...(p.team !== undefined ? { team: p.team } : {}),
        online: p.online,
        joinedAt: p.joinedAt,
        isHost: uid === meta?.hostUid,
      }))
      .sort((a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid));
  }

  /** Si l'hôte a disparu depuis trop longtemps, le joueur en ligne arrivé le plus tôt prend sa place. */
  private async maybeClaimHost(): Promise<void> {
    const meta = this.snap.meta;
    if (!meta || this.hosting || this.claiming || this.snap.status === 'closed') return;
    const host = this.rawPlayers[meta.hostUid];
    const now = this.backend.serverNow();
    const hostGone = !host || (!host.online && now - host.lastSeen > HOST_TIMEOUT_MS);
    if (!hostGone) return;
    const successor = this.lobbyPlayers(meta).find((p) => p.online && p.uid !== meta.hostUid);
    if (successor?.uid !== this.backend.uid) return;
    this.claiming = true;
    try {
      await this.backend.claimHost(this.code);
    } finally {
      this.claiming = false;
    }
  }

  /* ------------------------------------------------------------------ Rôle d'hôte */

  private async becomeHost(): Promise<void> {
    this.hosting = true;
    this.adapter ??= await this.loadAdapter();
    const saved = parse<{ phase: string }>(await this.backend.readHostState(this.code));
    if (!this.hosting) return; // rôle perdu entre-temps
    if (saved && this.snap.meta?.status !== 'lobby') {
      this.state = saved;
      this.publish();
    }
    this.hostUnsubs.push(this.backend.watchIntents(this.code, (intent) => this.onIntent(intent)));
  }

  private stopHosting(): void {
    this.hosting = false;
    for (const u of this.hostUnsubs) u();
    this.hostUnsubs = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.state = null;
  }

  private onIntent(intent: Intent): void {
    void this.backend.removeIntent(this.code, intent).catch(() => undefined);
    if (!this.state || !this.adapter) return;
    const action = parse<Record<string, unknown>>(intent.action);
    if (!action || typeof action['type'] !== 'string') return;
    const stamped = this.stamp(action, intent.at);
    if (this.allowed(stamped, intent.uid)) this.apply(stamped);
  }

  /**
   * Autorisation : le joueur attendu, ou l'hôte en secours si tous les joueurs attendus sont hors ligne
   * (téléphone éteint, réseau perdu).
   */
  private allowed(action: unknown, uid: string): boolean {
    if (!this.adapter || !this.state) return false;
    if (this.adapter.authorize(this.state, action, uid)) return true;
    if (uid !== this.backend.uid) return false;
    const actors = this.adapter.actors(this.state);
    return actors.length > 0 && actors.every((a) => this.rawPlayers[a]?.online !== true);
  }

  /**
   * Secours de l'hôte : si le joueur attendu est hors ligne, l'hôte peut jouer à sa place.
   * Retourne l'identifiant de ce joueur et sa vue secrète, ou null.
   */
  backup(): { uid: string; secret: Sec | null } | null {
    if (!this.hosting || !this.adapter || !this.state) return null;
    const actors = this.adapter.actors(this.state);
    const uid = actors[0];
    if (!uid || actors.includes(this.backend.uid) || !actors.every((a) => this.rawPlayers[a]?.online !== true)) return null;
    const secret = (this.adapter.project(this.state).secrets as Record<string, Sec>)[uid] ?? null;
    return { uid, secret };
  }

  /** Recale l'horodatage d'une action : l'hôte fait foi, à la latence près. */
  private stamp<A extends Record<string, unknown>>(action: A, clientAt: number): A {
    if (typeof action['at'] !== 'number') return action;
    const now = this.backend.serverNow();
    const at = Math.min(now, Math.max(now - MAX_CLIENT_LAG_MS, clientAt));
    return { ...action, at };
  }

  private apply(action: unknown): void {
    if (!this.adapter || !this.state) return;
    const next = this.adapter.reduce(this.state, action);
    if (next === this.state) return;
    this.state = next;
    this.publish();
  }

  private publish(): void {
    if (!this.adapter || !this.state) return;
    const { view, secrets } = this.adapter.project(this.state);
    const payload = {
      view: JSON.stringify(view),
      secrets: Object.fromEntries(Object.entries(secrets).map(([uid, s]) => [uid, JSON.stringify(s)])),
      hostState: JSON.stringify(this.state),
      meta: {
        status: this.state.phase === 'finished' ? ('finished' as const) : ('playing' as const),
        expiresAt: this.backend.serverNow() + ROOM_TTL_MS,
      },
    };
    this.publishChain = this.publishChain.then(() => this.backend.publish(this.code, payload)).catch(() => undefined);
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const next = this.adapter?.scheduled(this.state);
    if (!next) return;
    const delay = Math.max(0, next.at - this.backend.serverNow()) + 50;
    this.timer = setTimeout(() => this.apply(next.action), delay);
  }

  /* ------------------------------------------------------------------ Actions */

  /** Action de jeu : appliquée directement par l'hôte, envoyée comme intention par un invité. */
  dispatch(action: { type: string; at?: number; [key: string]: unknown }): void {
    const now = this.backend.serverNow();
    const stamped = 'at' in action ? { ...action, at: now } : action;
    if (this.hosting && this.state) {
      if (this.allowed(stamped, this.backend.uid)) this.apply(stamped);
    }
    else void this.backend.pushIntent(this.code, JSON.stringify(stamped), now).catch(() => undefined);
  }

  /** Joueurs qui participeront à la prochaine partie : en ligne, par ordre d'arrivée. */
  lobbyRoster(): Player[] {
    return this.snap.players.filter((p) => p.online).map((p) => ({ id: p.uid, name: p.name, ...(p.team !== undefined ? { team: p.team } : {}) }));
  }

  /** Message bloquant pour lancer la partie (côté hôte), ou null. */
  startBlocker(): string | null {
    if (!this.adapter || !this.snap.config) return 'Chargement…';
    return this.adapter.validate(this.lobbyRoster(), this.snap.config);
  }

  async setConfig(config: Cfg): Promise<void> {
    if (!this.hosting) return;
    await this.backend.updateMeta(this.code, { config: JSON.stringify(config) });
  }

  async setTeam(uid: string, team: 0 | 1): Promise<void> {
    if (this.hosting) await this.backend.setPlayer(this.code, uid, { team });
  }

  async kick(uid: string): Promise<void> {
    if (this.hosting && uid !== this.backend.uid) await this.backend.setPlayer(this.code, uid, null);
  }

  /** Lance (ou relance) une partie avec les joueurs en ligne. */
  start(): string | null {
    if (!this.hosting || !this.adapter) return 'Seul l’hôte peut lancer la partie.';
    const blocker = this.startBlocker();
    if (blocker) return blocker;
    this.state = this.adapter.create(this.lobbyRoster(), this.snap.config, randomSeed());
    this.publish();
    return null;
  }

  /** Retour au lobby (pour changer les packs ou les équipes entre deux parties). */
  async backToLobby(): Promise<void> {
    if (!this.hosting) return;
    this.state = null;
    if (this.timer) clearTimeout(this.timer);
    await this.publishChain;
    await this.backend.publish(this.code, { view: 'null', secrets: {}, hostState: 'null', meta: { status: 'lobby' } });
  }

  /** Quitte la salle (définitivement). */
  async leave(): Promise<void> {
    this.close();
    await this.backend.leave(this.code).catch(() => undefined);
  }

  close(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.stopHosting();
    if (this.hostCheck) clearInterval(this.hostCheck);
    this.hostCheck = null;
    this.listeners.clear();
  }
}
