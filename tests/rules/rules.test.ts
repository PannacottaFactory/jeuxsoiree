/**
 * Règles de sécurité de la Realtime Database + FirebaseBackend, testés contre les émulateurs Firebase.
 * Lancement : npm run test:rules (démarre et arrête les émulateurs automatiquement).
 *
 * Chaque « téléphone » est une app Firebase distincte, donc un utilisateur anonyme distinct.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, push, ref, set, update } from 'firebase/database';
import { FirebaseBackend } from '~/net/firebase/FirebaseBackend';
import { firebaseConfig } from '~/net/firebase/config';
import { MultiplayerSession } from '~/net/MultiplayerSession';
import { ROOM_TTL_MS, type RoomMeta } from '~/net/RoomBackend';
import { rigololAdapter, type RigololSecret, type RigololView } from '~/games/rigolol/multi';

let seq = 0;
const phone = () => FirebaseBackend.connect({ appName: `phone-${++seq}-${Date.now()}`, emulator: true });

/** Accès SDK brut pour tenter des écritures interdites. */
async function rawClient(signedIn = true) {
  const app = initializeApp(firebaseConfig, `raw-${++seq}-${Date.now()}`);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const uid = signedIn ? (await signInAnonymously(auth)).user.uid : null;
  return { db, uid };
}

const denied = async (p: Promise<unknown>) => {
  await expect(p).rejects.toThrow(/permission/i);
};

let codeSeq = 0;
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ';
/** Codes uniques par test (pas de collision entre tests successifs sur le même émulateur). */
const freshCode = () => {
  const n = Date.now() % 100000 + ++codeSeq * 7919;
  return Array.from({ length: 4 }, (_, i) => ALPHA[Math.floor(n / 23 ** i) % 23]).join('');
};

function meta(hostUid: string, overrides: Partial<RoomMeta> = {}): RoomMeta {
  const now = Date.now();
  return { game: 'rigolol', adult: false, hostUid, status: 'lobby', createdAt: now, expiresAt: now + ROOM_TTL_MS, config: '{"packs":["tout-doux"]}', ...overrides };
}

afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});

describe('règles : accès anonyme', () => {
  it('un visiteur non authentifié ne lit rien', async () => {
    const host = await phone();
    const code = freshCode();
    await host.createRoom(code, meta(host.uid));
    const { db } = await rawClient(false);
    await denied(get(ref(db, `rooms/${code}/meta`)));
    await denied(get(ref(db, 'rooms')));
  });
  it('personne ne peut lister les salles', async () => {
    const { db } = await rawClient();
    await denied(get(ref(db, 'rooms')));
  });
});

describe('règles : création et membres', () => {
  it('un code actif ne peut pas être repris par un autre', async () => {
    const a = await phone();
    const b = await phone();
    const code = freshCode();
    expect(await a.createRoom(code, meta(a.uid))).toBe(true);
    expect(await b.createRoom(code, meta(b.uid))).toBe(false);
  });

  it('impossible de créer une salle au nom d’un autre ou avec un code invalide', async () => {
    const a = await phone();
    const { db, uid } = await rawClient();
    await denied(set(ref(db, `rooms/${freshCode()}`), { meta: meta(a.uid) }));
    await denied(set(ref(db, 'rooms/AAA1'), { meta: meta(uid!) }));
  });

  it('un invité lit meta et joueurs, sa propre vue secrète, mais pas l’état de l’hôte ni les intentions', async () => {
    const host = await phone();
    const guest = await phone();
    const code = freshCode();
    await host.createRoom(code, meta(host.uid));
    await host.join(code, { name: 'Léa' });
    await guest.join(code, { name: 'Max' });
    await host.publish(code, { view: '"v"', secrets: { [guest.uid]: '"s-guest"', [host.uid]: '"s-host"' }, hostState: '"secret"' });

    const { db } = await rawClient();
    // Non membre : ne lit pas la vue
    await denied(get(ref(db, `rooms/${code}/view`)));

    expect(await guest.getMeta(code)).toMatchObject({ hostUid: host.uid });
    await denied(guest.readHostState(code));
    await denied(guest.publish(code, { view: '"x"', secrets: {}, hostState: '"x"' }));
    await denied(guest.updateMeta(code, { status: 'playing' }));
    const received = await new Promise<string | null>((resolve) => {
      const off = guest.watchSecret(code, (s) => {
        off();
        resolve(s);
      });
    });
    expect(received).toBe('"s-guest"');
  });

  it('valide les fiches joueur (pseudo de 1 à 20 caractères, pas de champ inconnu)', async () => {
    const host = await phone();
    const code = freshCode();
    await host.createRoom(code, meta(host.uid));
    const { db, uid } = await rawClient();
    const base = { joinedAt: Date.now(), online: true, lastSeen: Date.now() };
    await denied(set(ref(db, `rooms/${code}/players/${uid}`), { ...base, name: 'x'.repeat(21) }));
    await denied(set(ref(db, `rooms/${code}/players/${uid}`), { ...base, name: 'Bob', admin: true }));
    await denied(set(ref(db, `rooms/${code}/players/${host.uid}`), { ...base, name: 'Usurpateur' }));
    await set(ref(db, `rooms/${code}/players/${uid}`), { ...base, name: 'Bob' });
  });
});

describe('règles : intentions', () => {
  it('seul un membre peut envoyer une intention, et seulement en son nom', async () => {
    const host = await phone();
    const code = freshCode();
    await host.createRoom(code, meta(host.uid));
    const outsider = await rawClient();
    await denied(push(ref(outsider.db, `rooms/${code}/intents`), { uid: outsider.uid, action: '{}', at: 1 }).then(() => undefined));

    const member = await rawClient();
    await set(ref(member.db, `rooms/${code}/players/${member.uid}`), { name: 'Max', joinedAt: 1, online: true, lastSeen: 1 });
    await push(ref(member.db, `rooms/${code}/intents`), { uid: member.uid, action: '{"type":"reveal"}', at: 1 });
    await denied(push(ref(member.db, `rooms/${code}/intents`), { uid: host.uid, action: '{}', at: 1 }).then(() => undefined));
    await denied(get(ref(member.db, `rooms/${code}/intents`)));
  });
});

describe('règles : transfert d’hôte', () => {
  it('refusé tant que l’hôte est en ligne, accepté après 30 s hors ligne', async () => {
    const host = await phone();
    const guest = await phone();
    const code = freshCode();
    await host.createRoom(code, meta(host.uid));
    await host.join(code, { name: 'Léa' });
    await guest.join(code, { name: 'Max' });
    expect(await guest.claimHost(code)).toBe(false);

    // L'hôte apparaît hors ligne depuis 1 minute
    const { db } = await rawClient();
    void db;
    const hostDb = getDatabase(getApps().find((a) => a.name.startsWith('phone-') && getAuth(a).currentUser?.uid === host.uid)!);
    await update(ref(hostDb, `rooms/${code}/players/${host.uid}`), { online: false, lastSeen: Date.now() - 60_000 });
    expect(await guest.claimHost(code)).toBe(true);
    expect((await guest.getMeta(code))?.hostUid).toBe(guest.uid);
    // L'ancien hôte a perdu ses droits
    await denied(host.publish(code, { view: '"x"', secrets: {}, hostState: '"x"' }));
  });

  it('un non-membre ne peut jamais prendre la place de l’hôte', async () => {
    const host = await phone();
    const code = freshCode();
    await host.createRoom(code, meta(host.uid));
    const outsider = await phone();
    expect(await outsider.claimHost(code)).toBe(false);
  });
});

describe('règles : expiration', () => {
  it('une salle expirée est supprimée par le ménage, une salle active non', async () => {
    // Tranches d'1 seconde pour simuler le passage du temps (en production : 1 heure).
    const fast = () => FirebaseBackend.connect({ appName: `fast-${++seq}-${Date.now()}`, emulator: true, bucketMs: 1000 });
    const a = await fast();
    const expired = freshCode();
    const active = freshCode();
    await a.createRoom(expired, meta(a.uid, { expiresAt: Date.now() + 300 }));
    await a.createRoom(active, meta(a.uid));
    const b = await fast();
    await b.purgeExpired();
    expect(await b.getMeta(expired)).not.toBeNull(); // tranche pas encore écoulée
    await new Promise((r) => setTimeout(r, 2600));
    await b.purgeExpired();
    expect(await b.getMeta(expired)).toBeNull();
    expect(await b.getMeta(active)).not.toBeNull();
    // Une salle active ne peut pas être supprimée par un autre
    const { db } = await rawClient();
    await denied(set(ref(db, `rooms/${active}`), null));
  });
});

describe('règles : index d’expiration', () => {
  it('une tranche en cours n’est pas lisible (aucun code de salle active n’est exposé) ni falsifiable', async () => {
    const a = await phone();
    const code = freshCode();
    const m = meta(a.uid);
    await a.createRoom(code, m);
    const bucket = Math.floor(m.expiresAt / 3_600_000) + 1;
    const { db } = await rawClient();
    await denied(get(ref(db, `expiry/${bucket}`)));
    await denied(set(ref(db, `expiry/${bucket}/end`), Date.now() + 1000)); // `end` est immuable
    await denied(set(ref(db, `expiry/${bucket}`), null)); // pas de suppression avant la fin
    await denied(set(ref(db, `expiry/${bucket}/rooms/${code}`), true)); // seul l'hôte inscrit sa salle
  });
});

describe('FirebaseBackend + MultiplayerSession : partie réelle sur l’émulateur', () => {
  it('l’hôte crée, l’invité rejoint, le farceur joue son tour depuis son téléphone', async () => {
    const phrases = Array.from({ length: 30 }, (_, i) => ({ id: `rp-${i}`, packs: ['tout-doux'], text: `Phrase ${i}` }));
    const adapter = rigololAdapter(phrases);
    const load = async () => adapter;
    const host = await MultiplayerSession.create(await phone(), load, { game: 'rigolol', adult: false, name: 'Léa' });
    const guest = await MultiplayerSession.join(await phone(), load, host.code, 'Max');

    const waitFor = <T>(s: MultiplayerSession, pick: (snap: ReturnType<MultiplayerSession['getSnapshot']>) => T | undefined | null | false) =>
      new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('délai dépassé')), 15_000);
        const check = () => {
          const v = pick(s.getSnapshot());
          if (v) {
            clearTimeout(t);
            off();
            resolve(v as T);
          }
        };
        const off = s.subscribe(check);
        check();
      });

    await waitFor(host, (s) => s.players.length === 2);
    expect(host.start()).toBeNull();
    const view = await waitFor<RigololView>(guest, (s) => (s.view as RigololView | null)?.phase === 'handoff' && (s.view as RigololView));
    const joker = view.jokerId === host.getSnapshot().me ? host : guest;
    joker.dispatch({ type: 'reveal' });
    const secret = await waitFor<RigololSecret>(joker, (s) => (s.secret as RigololSecret | null)?.choices && (s.secret as RigololSecret));
    expect(secret.choices).toHaveLength(3);
    const other = joker === host ? guest : host;
    expect(other.getSnapshot().secret).toBeNull();
    joker.dispatch({ type: 'choose', phraseId: secret.choices![0]!.id });
    joker.dispatch({ type: 'resolve', laughed: true });
    const after = await waitFor<RigololView>(other, (s) => (s.view as RigololView | null)?.turnIndex === 1 && (s.view as RigololView));
    expect(after.scores[view.jokerId!]).toBe(2);
    host.close();
    guest.close();
  });
});
