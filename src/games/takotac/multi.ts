/**
 * Takotac en multijoueur. Le lecteur lit la consigne et valide (décision 2026-11-18) ; les joueurs interrogés ne voient
 * que le chrono (ils écoutent), les autres voient la consigne pour suivre. La fin du chrono est déclenchée par l'hôte.
 */
import {
  createGame,
  currentPlayers,
  reduce,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type TakotacAction,
  type TakotacState,
  type TurnResult,
} from './engine';
import { entriesForPacks, indexById, type EntryLite } from '../core/content';
import { textOf, type MultiAdapter, type TextRef } from '../core/multi';
import type { Player, Scores } from '../core/players';

export interface TakotacConfig {
  packs: string[];
}

export interface TakotacView {
  game: 'takotac';
  phase: TakotacState['phase'];
  players: Player[];
  scores: Scores;
  round: number;
  totalRounds: number;
  turnPlayers: string[];
  readerId: string;
  deadline: number | null;
  lastResult: TurnResult | null;
}

export interface TakotacSecret {
  prompt: { count: 3 | 4; category: TextRef | null };
}

export function takotacAdapter(categories: EntryLite[]): MultiAdapter<TakotacState, TakotacAction, TakotacView, TakotacSecret, TakotacConfig> {
  const index = indexById(categories);
  return {
    game: 'takotac',
    defaultConfig: () => ({ packs: ['tout-doux'] }),
    validate(players, config) {
      if (players.length < MIN_PLAYERS) return `Il faut au moins ${MIN_PLAYERS} joueurs.`;
      if (players.length > MAX_PLAYERS) return `${MAX_PLAYERS} joueurs maximum.`;
      if (entriesForPacks(categories, config.packs).length === 0) return 'Choisis au moins un pack.';
      return null;
    },
    create: (players, config, seed) =>
      createGame(
        players,
        entriesForPacks(categories, config.packs).map((c) => c.id),
        seed,
      ),
    reduce,
    actors: (state) => (state.phase === 'finished' ? [] : [state.readerId]),
    authorize: (state, action, uid) => action.type !== 'timeout' && state.readerId === uid,
    scheduled: (state) =>
      state.phase === 'answering' && state.deadline !== null ? { at: state.deadline, action: { type: 'timeout', at: state.deadline } } : null,
    project(state) {
      const turnPlayers = currentPlayers(state);
      const view: TakotacView = {
        game: 'takotac',
        phase: state.phase,
        players: state.players,
        scores: state.scores,
        round: state.round,
        totalRounds: state.totalRounds,
        turnPlayers,
        readerId: state.readerId,
        deadline: state.deadline,
        lastResult: state.lastResult,
      };
      const secrets: Record<string, TakotacSecret> = {};
      if (state.phase === 'answering' && state.prompt) {
        const prompt = { count: state.prompt.count, category: textOf(index, state.prompt.categoryId) };
        for (const p of state.players) if (!turnPlayers.includes(p.id)) secrets[p.id] = { prompt };
      }
      return { view, secrets };
    },
  };
}
