/**
 * Rigolol en multijoueur. Le farceur voit ses 3 phrases (et la phrase choisie) sur son téléphone, les autres voient
 * qui joue contre qui. C'est le farceur qui valide « a ri / n'a pas ri » (décision 2026-11-18).
 */
import { createGame, currentTurn, reduce, MAX_PLAYERS, MIN_PLAYERS, type RigololAction, type RigololState, type TurnResult } from './engine';
import { entriesForPacks, indexById, type EntryLite } from '../core/content';
import { textOf, type MultiAdapter, type TextRef } from '../core/multi';
import type { Player, Scores } from '../core/players';

export interface RigololConfig {
  packs: string[];
}

export interface RigololView {
  game: 'rigolol';
  phase: RigololState['phase'];
  players: Player[];
  scores: Scores;
  turnIndex: number;
  totalTurns: number;
  jokerId: string | null;
  targetId: string | null;
  /** Résultat du tour précédent, avec la phrase lue (révélée à tous une fois le tour fini). */
  lastResult: (TurnResult & { phrase: TextRef | null }) | null;
}

export interface RigololSecret {
  choices?: (TextRef & { id: string })[];
  chosen?: TextRef;
}

export function rigololAdapter(phrases: EntryLite[]): MultiAdapter<RigololState, RigololAction, RigololView, RigololSecret, RigololConfig> {
  const index = indexById(phrases);
  return {
    game: 'rigolol',
    defaultConfig: () => ({ packs: ['tout-doux'] }),
    validate(players, config) {
      if (players.length < MIN_PLAYERS) return `Il faut au moins ${MIN_PLAYERS} joueurs.`;
      if (players.length > MAX_PLAYERS) return `${MAX_PLAYERS} joueurs maximum.`;
      if (entriesForPacks(phrases, config.packs).length === 0) return 'Choisis au moins un pack.';
      return null;
    },
    create: (players, config, seed) =>
      createGame(
        players,
        entriesForPacks(phrases, config.packs).map((p) => p.id),
        seed,
      ),
    reduce,
    actors: (state) => {
      const turn = currentTurn(state);
      return turn && state.phase !== 'finished' ? [turn.jokerId] : [];
    },
    authorize: (state, _action, uid) => currentTurn(state)?.jokerId === uid,
    scheduled: () => null,
    project(state) {
      const turn = currentTurn(state);
      const view: RigololView = {
        game: 'rigolol',
        phase: state.phase,
        players: state.players,
        scores: state.scores,
        turnIndex: state.turnIndex,
        totalTurns: state.schedule.length,
        jokerId: turn?.jokerId ?? null,
        targetId: turn?.targetId ?? null,
        lastResult: state.lastResult ? { ...state.lastResult, phrase: textOf(index, state.lastResult.phraseId) } : null,
      };
      const secrets: Record<string, RigololSecret> = {};
      if (turn && state.phase === 'choosing') {
        secrets[turn.jokerId] = { choices: state.choices.map((id) => ({ id, ...textOf(index, id)! })) };
      }
      if (turn && state.phase === 'performing') {
        const chosen = textOf(index, state.chosenId);
        if (chosen) secrets[turn.jokerId] = { chosen };
      }
      return { view, secrets };
    },
  };
}
