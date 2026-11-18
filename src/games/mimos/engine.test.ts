import { describe, expect, it } from 'vitest';
import {
  CARDS_PER_PASSAGE,
  PASSAGE_DURATION_MS,
  buildSchedule,
  createGame,
  passagesPerPlayer,
  reduce,
  selectContent,
  validatePlayers,
  type MimosState,
} from './engine';
import type { Player } from '../core/players';

const ffa = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `J${i}` }));
const teams = (perTeam: number): Player[] => [
  ...Array.from({ length: perTeam }, (_, i) => ({ id: `a${i}`, name: `A${i}`, team: 0 as const })),
  ...Array.from({ length: perTeam }, (_, i) => ({ id: `b${i}`, name: `B${i}`, team: 1 as const })),
];
const content = {
  subjectIds: Array.from({ length: 300 }, (_, i) => `ms-${i}`),
  actionIds: Array.from({ length: 300 }, (_, i) => `ma-${i}`),
};
const T0 = 1_000_000;

const start = (s: MimosState, at = T0) => reduce(s, { type: 'start', at });

describe('Mimos : nombre de passages (décision 2026-11-18)', () => {
  it.each([
    [2, 4],
    [3, 4],
    [4, 3],
    [5, 2],
    [6, 2],
    [8, 2],
  ])('%i joueurs → %i passages chacun', (n, expected) => {
    expect(passagesPerPlayer(n)).toBe(expected);
  });
});

describe('Mimos : composition', () => {
  it('chacun pour soi : 2 à 6 joueurs', () => {
    expect(validatePlayers(ffa(1), 'ffa')).not.toBeNull();
    expect(validatePlayers(ffa(6), 'ffa')).toBeNull();
    expect(validatePlayers(ffa(7), 'ffa')).not.toBeNull();
  });
  it('équipes : même taille, 2 à 4 par équipe', () => {
    expect(validatePlayers(teams(2), 'teams')).toBeNull();
    expect(validatePlayers(teams(4), 'teams')).toBeNull();
    expect(validatePlayers(teams(5), 'teams')).not.toBeNull();
    expect(validatePlayers([...teams(2), { id: 'x', name: 'X', team: 0 }], 'teams')).toContain('même nombre');
  });
  it('en équipes, les passages alternent équipe 1 / équipe 2', () => {
    const schedule = buildSchedule(teams(3), 'teams');
    expect(schedule.slice(0, 6)).toEqual(['a0', 'b0', 'a1', 'b1', 'a2', 'b2']);
    expect(schedule).toHaveLength(6 * passagesPerPlayer(6));
  });
});

describe('Mimos : contenu', () => {
  const subjects = [
    { id: 's1', packs: ['tout-doux'] },
    { id: 's2', packs: ['celebrites'] },
  ];
  const actions = [
    { id: 'a1', packs: ['tout-doux'] },
    { id: 'a2', packs: ['no-limit'] },
  ];
  it('Célébrités seul : sujets célébrités + actions de Tout doux', () => {
    expect(selectContent(subjects, actions, ['celebrites'])).toEqual({ subjectIds: ['s2'], actionIds: ['a1'] });
  });
  it('Célébrités + No Limit : actions du pack No Limit uniquement', () => {
    expect(selectContent(subjects, actions, ['celebrites', 'no-limit'])).toEqual({ subjectIds: ['s2'], actionIds: ['a2'] });
  });
});

describe('Mimos : passage', () => {
  it('Prêt démarre un chrono de 60 s et affiche une expression', () => {
    const s = start(createGame(ffa(3), 'ffa', content, 1));
    expect(s.phase).toBe('miming');
    expect(s.deadline).toBe(T0 + PASSAGE_DURATION_MS);
    expect(s.card).not.toBeNull();
  });

  it('5 opportunités maximum : trouvé (+1) ou passé (perdu)', () => {
    let s = start(createGame(ffa(3), 'ffa', content, 2));
    const mime = s.schedule[0]!;
    s = reduce(s, { type: 'found', at: T0 + 1000 });
    s = reduce(s, { type: 'skip', at: T0 + 2000 });
    s = reduce(s, { type: 'found', at: T0 + 3000 });
    s = reduce(s, { type: 'skip', at: T0 + 4000 });
    expect(s.phase).toBe('miming');
    s = reduce(s, { type: 'found', at: T0 + 5000 });
    expect(s.phase).toBe('passageEnd');
    expect(s.endReason).toBe('done');
    expect(s.scores[mime]).toBe(3);
    expect(s.passageLog.map((c) => c.found)).toEqual([true, false, true, false, true]);
  });

  it('le gong termine le passage, l’expression en cours est perdue', () => {
    let s = start(createGame(ffa(2), 'ffa', content, 3));
    s = reduce(s, { type: 'found', at: T0 + 10_000 });
    expect(reduce(s, { type: 'timeout', at: T0 + 30_000 })).toBe(s); // trop tôt : ignoré
    s = reduce(s, { type: 'timeout', at: T0 + PASSAGE_DURATION_MS });
    expect(s.phase).toBe('passageEnd');
    expect(s.endReason).toBe('timeout');
    expect(s.passageLog.map((c) => c.found)).toEqual([true, false]);
  });

  it('un « Trouvé » après le gong ne rapporte rien', () => {
    let s = start(createGame(ffa(2), 'ffa', content, 4));
    s = reduce(s, { type: 'found', at: T0 + PASSAGE_DURATION_MS + 500 });
    expect(s.endReason).toBe('timeout');
    expect(Object.values(s.scores).every((v) => v === 0)).toBe(true);
  });

  it('en équipes, le point va à l’équipe du mimeur', () => {
    let s = start(createGame(teams(2), 'teams', content, 5));
    s = reduce(s, { type: 'found', at: T0 + 1 });
    expect(s.teamScores).toEqual([1, 0]);
    s = reduce(s, { type: 'timeout', at: T0 + PASSAGE_DURATION_MS });
    s = start(reduce(s, { type: 'next' }), T0 + 100_000);
    s = reduce(s, { type: 'found', at: T0 + 100_001 });
    expect(s.teamScores).toEqual([1, 1]);
  });
});

describe('Mimos : partie complète', () => {
  it('enchaîne tous les passages sans jamais répéter un sujet ou une action', () => {
    let s = createGame(ffa(4), 'ffa', content, 6);
    let t = T0;
    const subjects: string[] = [];
    const actions: string[] = [];
    while (s.phase !== 'finished') {
      s = start(s, t);
      while (s.phase === 'miming') {
        subjects.push(s.card!.subjectId);
        actions.push(s.card!.actionId);
        s = reduce(s, { type: 'found', at: (t += 1000) });
      }
      s = reduce(s, { type: 'next' });
      t += 100_000;
    }
    expect(s.passageIndex).toBe(4 * passagesPerPlayer(4));
    expect(subjects).toHaveLength(4 * passagesPerPlayer(4) * CARDS_PER_PASSAGE);
    expect(new Set(subjects).size).toBe(subjects.length);
    expect(new Set(actions).size).toBe(actions.length);
  });
});
