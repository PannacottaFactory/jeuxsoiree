import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryBackend, MemoryServer } from './MemoryBackend';
import { MultiplayerSession } from './MultiplayerSession';
import { HOST_TIMEOUT_MS } from './RoomBackend';
import { rigololAdapter, type RigololSecret, type RigololView } from '~/games/rigolol/multi';
import { mimosAdapter, type MimosSecret, type MimosView } from '~/games/mimos/multi';
import { takotacAdapter, type TakotacSecret, type TakotacView } from '~/games/takotac/multi';
import { PASSAGE_DURATION_MS } from '~/games/mimos/engine';
import type { EntryLite } from '~/games/core/content';

const entries = (prefix: string, n: number, pack = 'tout-doux'): EntryLite[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, packs: [pack], text: `${prefix} n°${i}` }));

const rigolol = rigololAdapter(entries('rp', 120));
const mimos = mimosAdapter(entries('ms', 80), entries('ma', 80));
const takotac = takotacAdapter(entries('tc', 120));

/** Laisse passer les microtâches et timers en attente (horloge simulée). */
const flush = async () => {
  await vi.advanceTimersByTimeAsync(1);
};

let server: MemoryServer;

beforeEach(() => {
  vi.useFakeTimers();
  server = new MemoryServer();
});
afterEach(() => {
  vi.useRealTimers();
});

async function setup(adapter: typeof rigolol | typeof mimos | typeof takotac, game: 'rigolol' | 'mimos' | 'takotac', guests = ['Max', 'Tom']) {
  const load = async () => adapter;
  const host = await MultiplayerSession.create(new MemoryBackend(server, 'uid-host'), load, { game, adult: false, name: 'Léa' });
  const others: MultiplayerSession[] = [];
  for (const [i, name] of guests.entries()) {
    server.now += 10; // ordre d'arrivée
    others.push(await MultiplayerSession.join(new MemoryBackend(server, `uid-g${i}`), load, host.code, name));
  }
  await flush();
  return { host, guests: others, all: [host, ...others] };
}

describe('MultiplayerSession : salle et lobby', () => {
  it('crée une salle au code valide et tout le monde voit la liste des joueurs', async () => {
    const { host, guests } = await setup(rigolol, 'rigolol');
    expect(host.code).toMatch(/^[A-HJKMNP-Z]{4}$/);
    expect(host.getSnapshot().isHost).toBe(true);
    for (const s of [host, ...guests]) {
      expect(s.getSnapshot().status).toBe('lobby');
      expect(s.getSnapshot().players.map((p) => p.name)).toEqual(['Léa', 'Max', 'Tom']);
    }
    expect(guests[0]!.getSnapshot().isHost).toBe(false);
  });

  it('refuse une salle inexistante', async () => {
    await expect(MultiplayerSession.join(new MemoryBackend(server, 'x'), async () => rigolol, 'ZZZZ', 'Bob')).rejects.toThrow();
  });

  it('un invité ne peut pas publier d’état (réservé à l’hôte)', async () => {
    const { host } = await setup(rigolol, 'rigolol');
    const intruder = new MemoryBackend(server, 'uid-g0');
    await expect(intruder.publish(host.code, { view: '{}', secrets: {}, hostState: '{}' })).rejects.toThrow(/PERMISSION/);
  });

  it('l’hôte peut retirer un joueur, qui est prévenu', async () => {
    const { host, guests } = await setup(rigolol, 'rigolol');
    await host.kick('uid-g1');
    await flush();
    expect(guests[1]!.getSnapshot().status).toBe('closed');
    expect(host.getSnapshot().players.map((p) => p.name)).toEqual(['Léa', 'Max']);
  });

  it('bloque le lancement tant que la composition est invalide', async () => {
    const { host } = await setup(rigolol, 'rigolol', []);
    expect(host.start()).toContain('au moins 2');
  });
});

describe('MultiplayerSession : Rigolol', () => {
  it('seul le farceur reçoit ses phrases, et lui seul peut jouer son tour', async () => {
    const { host, all } = await setup(rigolol, 'rigolol');
    expect(host.start()).toBeNull();
    await flush();
    const view = host.getSnapshot().view as RigololView;
    expect(view.phase).toBe('handoff');
    const joker = all.find((s) => s.getSnapshot().me === view.jokerId)!;
    const outsider = all.find((s) => s.getSnapshot().me !== view.jokerId && s.getSnapshot().me !== view.targetId)!;

    // Un autre joueur ne peut pas révéler les phrases du farceur
    outsider.dispatch({ type: 'reveal' });
    await flush();
    expect((host.getSnapshot().view as RigololView).phase).toBe('handoff');

    joker.dispatch({ type: 'reveal' });
    await flush();
    const secret = joker.getSnapshot().secret as RigololSecret;
    expect(secret.choices).toHaveLength(3);
    for (const s of all) if (s !== joker) expect(s.getSnapshot().secret).toBeNull();
    // L'état complet (pioche) n'est jamais publié dans la vue
    expect(JSON.stringify(host.getSnapshot().view)).not.toContain('pile');

    joker.dispatch({ type: 'choose', phraseId: secret.choices![0]!.id });
    await flush();
    expect((joker.getSnapshot().secret as RigololSecret).chosen?.text).toBe(secret.choices![0]!.text);
    joker.dispatch({ type: 'resolve', laughed: true });
    await flush();
    const after = host.getSnapshot().view as RigololView;
    expect(after.turnIndex).toBe(1);
    expect(after.scores[view.jokerId!]).toBe(3);
    expect(after.lastResult?.phrase?.text).toBe(secret.choices![0]!.text);
  });
});

describe('MultiplayerSession : chronos (Mimos)', () => {
  it('l’hôte déclenche la fin du chrono et la carte reste secrète', async () => {
    const { host, all } = await setup(mimos, 'mimos');
    expect(host.start()).toBeNull();
    await flush();
    const mimeId = (host.getSnapshot().view as MimosView).mimeId!;
    const mime = all.find((s) => s.getSnapshot().me === mimeId)!;
    mime.dispatch({ type: 'start', at: 0 });
    await flush();
    expect((mime.getSnapshot().secret as MimosSecret).subject?.text).toMatch(/^ms n°/);
    for (const s of all) if (s !== mime) expect(s.getSnapshot().secret).toBeNull();

    mime.dispatch({ type: 'found', at: 0 });
    await flush();
    expect((host.getSnapshot().view as MimosView).foundThisPassage).toBe(1);

    // 60 secondes plus tard (horloge serveur + timers), l'hôte clôt le passage tout seul
    server.now += PASSAGE_DURATION_MS + 10;
    await vi.advanceTimersByTimeAsync(PASSAGE_DURATION_MS + 100);
    const view = host.getSnapshot().view as MimosView;
    expect(view.phase).toBe('passageEnd');
    expect(view.endReason).toBe('timeout');
    expect(view.log.length).toBeGreaterThan(0); // expressions révélées à tous en fin de passage
  });
});

describe('MultiplayerSession : Takotac', () => {
  it('le lecteur voit la consigne et valide ; le joueur interrogé ne la voit pas', async () => {
    const { host, all } = await setup(takotac, 'takotac');
    expect(host.start()).toBeNull();
    await flush();
    const view = host.getSnapshot().view as TakotacView;
    const reader = all.find((s) => s.getSnapshot().me === view.readerId)!;
    const answering = all.find((s) => view.turnPlayers.includes(s.getSnapshot().me))!;
    answering.dispatch({ type: 'start', at: 0 }); // pas le lecteur : ignoré
    await flush();
    expect((host.getSnapshot().view as TakotacView).phase).toBe('handoff');
    reader.dispatch({ type: 'start', at: 0 });
    await flush();
    expect((reader.getSnapshot().secret as TakotacSecret).prompt.category?.text).toMatch(/^tc n°/);
    expect(answering.getSnapshot().secret).toBeNull();
    reader.dispatch({ type: 'success', at: 0 });
    await flush();
    const after = host.getSnapshot().view as TakotacView;
    expect(after.lastResult?.success).toBe(true);
    for (const id of view.turnPlayers) expect(after.scores[id]).toBe(2);
  });
});

describe('MultiplayerSession : reconnexion et transfert d’hôte', () => {
  it('un joueur qui revient retrouve sa fiche (même ordre d’arrivée)', async () => {
    const { host, guests } = await setup(rigolol, 'rigolol');
    const before = host.getSnapshot().players.find((p) => p.uid === 'uid-g0')!;
    server.disconnect('uid-g0');
    guests[0]!.close();
    await flush();
    expect(host.getSnapshot().players.find((p) => p.uid === 'uid-g0')?.online).toBe(false);
    server.now += 5000;
    await MultiplayerSession.join(new MemoryBackend(server, 'uid-g0'), async () => rigolol, host.code, 'Max');
    await flush();
    const after = host.getSnapshot().players.find((p) => p.uid === 'uid-g0')!;
    expect(after.online).toBe(true);
    expect(after.joinedAt).toBe(before.joinedAt);
  });

  it('si l’hôte disparaît plus de 30 s, le joueur arrivé le plus tôt reprend la partie là où elle en était', async () => {
    const { host, guests } = await setup(rigolol, 'rigolol');
    host.start();
    await flush();
    const turnBefore = (host.getSnapshot().view as RigololView).turnIndex;
    const scoresBefore = (host.getSnapshot().view as RigololView).scores;

    server.disconnect('uid-host');
    host.close();
    server.now += HOST_TIMEOUT_MS / 2;
    await vi.advanceTimersByTimeAsync(6000);
    expect(guests[0]!.getSnapshot().isHost).toBe(false); // trop tôt

    server.now += HOST_TIMEOUT_MS;
    await vi.advanceTimersByTimeAsync(6000);
    expect(guests[0]!.getSnapshot().isHost).toBe(true);
    expect(guests[1]!.getSnapshot().isHost).toBe(false);

    // Le nouvel hôte reprend l'état sauvegardé et la partie continue
    const view = guests[0]!.getSnapshot().view as RigololView;
    expect(view.turnIndex).toBe(turnBefore);
    expect(view.scores).toEqual(scoresBefore);
    const joker = guests.find((s) => s.getSnapshot().me === view.jokerId);
    if (joker) {
      joker.dispatch({ type: 'reveal' });
      await flush();
      expect((guests[0]!.getSnapshot().view as RigololView).phase).toBe('choosing');
    }
  });

  it('un invité ne peut pas prendre la place d’un hôte encore en ligne', async () => {
    const { host } = await setup(rigolol, 'rigolol');
    server.now += HOST_TIMEOUT_MS * 3;
    expect(await new MemoryBackend(server, 'uid-g0').claimHost(host.code)).toBe(false);
  });
});
