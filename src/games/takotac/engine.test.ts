import { describe, expect, it } from 'vitest';
import { ANSWER_DURATION_MS, buildRound, createGame, currentPlayers, reduce, roundsFor, type TakotacState } from './engine';
import { Rng } from '../core/rng';
import type { Player } from '../core/players';

const makePlayers = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `J${i}` }));
const categories = Array.from({ length: 400 }, (_, i) => `tc-${i}`);
const T0 = 5_000_000;

function playAll(state: TakotacState, success: (turn: number) => boolean) {
  let s = state;
  let t = T0;
  let i = 0;
  const prompts: string[] = [];
  const turns: string[][] = [];
  while (s.phase !== 'finished') {
    prompts.push(s.prompt!.categoryId);
    turns.push(currentPlayers(s));
    s = reduce(s, { type: 'start', at: t });
    s = reduce(s, { type: success(i++) ? 'success' : 'fail', at: t + 3000 });
    t += 20_000;
  }
  return { state: s, prompts, turns };
}

describe('Takotac : manches', () => {
  it.each([
    [2, 8],
    [3, 6],
    [5, 6],
    [6, 5],
    [8, 5],
  ])('%i joueurs → %i manches', (n, expected) => expect(roundsFor(n)).toBe(expected));

  it('chaque joueur joue exactement une fois par manche (coopération comprise)', () => {
    const n = 5;
    const { turns } = playAll(createGame(makePlayers(n), categories, 12), () => true);
    const appearances = makePlayers(n).map((p) => turns.filter((t) => t.includes(p.id)).length);
    expect(appearances.every((a) => a === roundsFor(n))).toBe(true);
  });

  it('ne ressort jamais une catégorie dans la partie', () => {
    const { prompts } = playAll(createGame(makePlayers(8), categories, 3), () => true);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('la consigne demande 3 ou 4 éléments', () => {
    const { state } = playAll(createGame(makePlayers(4), categories, 4), () => false);
    expect(state.phase).toBe('finished');
    const counts = new Set<number>();
    let s = createGame(makePlayers(4), categories, 4);
    for (let i = 0; i < 40 && s.phase !== 'finished'; i++) {
      counts.add(s.prompt!.count);
      s = reduce(reduce(s, { type: 'start', at: T0 }), { type: 'fail', at: T0 + 1 });
    }
    expect([...counts].sort()).toEqual([3, 4]);
  });
});

describe('Takotac : coopération', () => {
  it('jamais à 2 joueurs', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(buildRound(['a', 'b'], new Rng(seed)).every((t) => t.length === 1)).toBe(true);
    }
  });
  it('toujours à 7 ou 8 joueurs', () => {
    const ids = makePlayers(7).map((p) => p.id);
    for (let seed = 0; seed < 100; seed++) {
      const turns = buildRound(ids, new Rng(seed));
      expect(turns.filter((t) => t.length === 2)).toHaveLength(1);
      expect(turns.flat().sort()).toEqual([...ids].sort());
    }
  });
  it('environ 41 % des manches de 3 à 6 joueurs', () => {
    const ids = makePlayers(4).map((p) => p.id);
    const rng = new Rng(77);
    let coops = 0;
    for (let i = 0; i < 4000; i++) if (buildRound(ids, rng).some((t) => t.length === 2)) coops++;
    expect(coops / 4000).toBeGreaterThan(0.37);
    expect(coops / 4000).toBeLessThan(0.45);
  });
  it('une réussite en coopération rapporte 2 points à chacun', () => {
    let s = createGame(makePlayers(7), categories, 21);
    while (currentPlayers(s).length !== 2) s = reduce(reduce(s, { type: 'start', at: T0 }), { type: 'fail', at: T0 + 1 });
    const [a, b] = currentPlayers(s);
    s = reduce(reduce(s, { type: 'start', at: T0 }), { type: 'success', at: T0 + 2000 });
    expect(s.scores[a!]).toBe(2);
    expect(s.scores[b!]).toBe(2);
  });
});

describe('Takotac : chrono', () => {
  it('valider avant 7 s rapporte 2 points', () => {
    let s = createGame(makePlayers(3), categories, 1);
    const [p] = currentPlayers(s);
    s = reduce(reduce(s, { type: 'start', at: T0 }), { type: 'success', at: T0 + ANSWER_DURATION_MS - 1 });
    expect(s.scores[p!]).toBe(2);
    expect(s.lastResult).toEqual({ playerIds: [p], success: true, timedOut: false });
  });
  it('valider au gong ou après est un échec', () => {
    let s = createGame(makePlayers(3), categories, 1);
    const [p] = currentPlayers(s);
    s = reduce(reduce(s, { type: 'start', at: T0 }), { type: 'success', at: T0 + ANSWER_DURATION_MS });
    expect(s.scores[p!]).toBe(0);
    expect(s.lastResult?.timedOut).toBe(true);
  });
  it('le gong passe automatiquement au tour suivant, pas avant', () => {
    const s = reduce(createGame(makePlayers(3), categories, 1), { type: 'start', at: T0 });
    expect(reduce(s, { type: 'timeout', at: T0 + 6000 })).toBe(s);
    const after = reduce(s, { type: 'timeout', at: T0 + ANSWER_DURATION_MS });
    expect(after.phase).toBe('handoff');
    expect(after.turnIndex + (after.round - 1) * 10).toBeGreaterThan(0);
  });
  it('ignore les actions hors phase', () => {
    const s = createGame(makePlayers(3), categories, 1);
    expect(reduce(s, { type: 'success', at: T0 })).toBe(s);
    expect(reduce(s, { type: 'timeout', at: T0 })).toBe(s);
  });
});
