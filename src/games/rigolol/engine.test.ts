import { describe, expect, it } from 'vitest';
import { createGame, cyclesFor, reduce, type RigololState } from './engine';
import type { Player } from '../core/players';

const makePlayers = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Joueur ${i}` }));
const phrases = Array.from({ length: 200 }, (_, i) => `rp-${i}`);

/** Joue toute une partie : choisit toujours la 1re phrase, et la cible rit selon `laughs(i)`. */
function playAll(state: RigololState, laughs: (turn: number) => boolean) {
  let s = state;
  const chosen: string[] = [];
  let i = 0;
  while (s.phase !== 'finished') {
    s = reduce(s, { type: 'reveal' });
    const pick = s.choices[0]!;
    chosen.push(pick);
    s = reduce(s, { type: 'choose', phraseId: pick });
    s = reduce(s, { type: 'resolve', laughed: laughs(i++) });
  }
  return { state: s, chosen, turns: i };
}

describe('Rigolol : déroulé', () => {
  it.each([
    [2, 8],
    [3, 12],
    [4, 24],
    [5, 20],
    [6, 30],
  ])('à %i joueurs, la partie dure %i tours (comme l’app)', (n, expected) => {
    expect(createGame(makePlayers(n), phrases, 1).schedule).toHaveLength(expected);
    expect(playAll(createGame(makePlayers(n), phrases, 1), () => false).turns).toBe(expected);
  });

  it('chaque joueur est la cible autant de fois que de cycles, et jamais son propre farceur', () => {
    const n = 4;
    const g = createGame(makePlayers(n), phrases, 5);
    for (const p of g.players) {
      const asTarget = g.schedule.filter((t) => t.targetId === p.id).length;
      expect(asTarget).toBe(cyclesFor(n) * (n - 1));
    }
    expect(g.schedule.every((t) => t.jokerId !== t.targetId)).toBe(true);
  });

  it('pendant qu’un joueur est la cible, chacun des autres tente une fois', () => {
    const g = createGame(makePlayers(5), phrases, 11);
    const firstBlock = g.schedule.slice(0, 4);
    expect(new Set(firstBlock.map((t) => t.targetId)).size).toBe(1);
    expect(new Set(firstBlock.map((t) => t.jokerId)).size).toBe(4);
  });

  it('propose 3 phrases distinctes et ne ressort jamais une phrase dans la partie', () => {
    const g = createGame(makePlayers(6), phrases, 2);
    expect(new Set(g.choices).size).toBe(3);
    let s = g;
    const all: string[] = [];
    while (s.phase !== 'finished') {
      all.push(...s.choices);
      s = reduce(reduce(reduce(s, { type: 'reveal' }), { type: 'choose', phraseId: s.choices[1]! }), { type: 'resolve', laughed: true });
    }
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('Rigolol : points', () => {
  it('faire rire rapporte au farceur autant de points que de joueurs', () => {
    let s = createGame(makePlayers(5), phrases, 3);
    const turn = s.schedule[0]!;
    s = reduce(reduce(s, { type: 'reveal' }), { type: 'choose', phraseId: s.choices[0]! });
    s = reduce(s, { type: 'resolve', laughed: true });
    expect(s.scores[turn.jokerId]).toBe(5);
    expect(s.lastResult).toMatchObject({ scorerId: turn.jokerId, points: 5, laughed: true });
  });

  it('résister rapporte 1 point à la cible', () => {
    let s = createGame(makePlayers(3), phrases, 3);
    const turn = s.schedule[0]!;
    s = reduce(reduce(s, { type: 'reveal' }), { type: 'choose', phraseId: s.choices[0]! });
    s = reduce(s, { type: 'resolve', laughed: false });
    expect(s.scores[turn.targetId]).toBe(1);
    expect(s.scores[turn.jokerId]).toBe(0);
  });

  it('le total des points est cohérent en fin de partie', () => {
    const n = 4;
    const { state, turns } = playAll(createGame(makePlayers(n), phrases, 8), (i) => i % 2 === 0);
    const total = Object.values(state.scores).reduce((a, b) => a + b, 0);
    const laughs = Math.ceil(turns / 2);
    expect(total).toBe(laughs * n + (turns - laughs));
  });
});

describe('Rigolol : robustesse', () => {
  it('ignore les actions hors phase et les phrases non proposées', () => {
    const s = createGame(makePlayers(3), phrases, 4);
    expect(reduce(s, { type: 'resolve', laughed: true })).toBe(s);
    const choosing = reduce(s, { type: 'reveal' });
    expect(reduce(choosing, { type: 'choose', phraseId: 'inconnue' })).toBe(choosing);
    expect(reduce(choosing, { type: 'reveal' })).toBe(choosing);
  });

  it('refuse moins de 2 ou plus de 6 joueurs', () => {
    expect(() => createGame(makePlayers(1), phrases, 1)).toThrow();
    expect(() => createGame(makePlayers(7), phrases, 1)).toThrow();
  });

  it('est déterministe : même graine, même partie', () => {
    expect(createGame(makePlayers(4), phrases, 99)).toEqual(createGame(makePlayers(4), phrases, 99));
  });
});
