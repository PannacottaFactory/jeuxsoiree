/**
 * Moteur de Takotac (jeu de rapidité). Fonction pure : (état, action) → nouvel état.
 * Règles : docs/gameplay-takotac.md + docs/decisions.md.
 *
 * Machine à états d'un tour :
 *   handoff   → « À toi de jouer, <joueur> » (ou « À vous, X et Y » en coopération) ; la consigne est tirée mais cachée
 *   answering → chrono de 7 s ; « Validé » (+2 par joueur) avant le gong, sinon échec
 *   → tour suivant (handoff, avec le résultat du tour précédent) ou finished
 */
import { Rng, type RngState } from '../core/rng';
import { createDeck, drawOne, type Deck } from '../core/deck';
import { emptyScores, type Player, type Scores } from '../core/players';

export const ANSWER_DURATION_MS = 7_000;
export const POINTS_PER_SUCCESS = 2;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
/** Probabilité de « Cite 3 » (sinon « Cite 4 »), reprise de l'app. */
export const CHANCE_OF_THREE = 0.65;
/** Probabilité d'une coopération en début de manche (de 3 à 6 joueurs), reprise de l'app. */
export const CHANCE_OF_COOP = 0.41;

export interface Prompt {
  categoryId: string;
  count: 3 | 4;
}

export interface TurnResult {
  playerIds: string[];
  success: boolean;
  /** Vrai si l'échec vient du chrono. */
  timedOut: boolean;
}

export type TakotacPhase = 'handoff' | 'answering' | 'finished';

export interface TakotacState {
  game: 'takotac';
  players: Player[];
  scores: Scores;
  rng: RngState;
  deck: Deck;
  totalRounds: number;
  /** Manche en cours (1 à totalRounds). */
  round: number;
  /** Tours de la manche en cours : 1 joueur, ou 2 en coopération. */
  roundTurns: string[][];
  turnIndex: number;
  phase: TakotacPhase;
  prompt: Prompt | null;
  deadline: number | null;
  lastResult: TurnResult | null;
}

export type TakotacAction =
  | { type: 'start'; at: number }
  | { type: 'success'; at: number }
  | { type: 'fail'; at: number }
  | { type: 'timeout'; at: number };

/** Manches selon le nombre de joueurs : 8 (2 joueurs), 6 (3 à 5), 5 (6 à 8). */
export function roundsFor(playerCount: number): number {
  if (playerCount <= 2) return 8;
  if (playerCount <= 5) return 6;
  return 5;
}

/**
 * Tours d'une manche, dans l'ordre de saisie des joueurs. Coopération : jamais à 2 joueurs, toujours au-delà de 6,
 * sinon 41 % de chances. Les deux coéquipiers jouent ensemble quand on arrive au premier des deux.
 */
export function buildRound(playerIds: readonly string[], rng: Rng): string[][] {
  const n = playerIds.length;
  const coop = n > 2 && (n > 6 || rng.chance(CHANCE_OF_COOP));
  if (!coop) return playerIds.map((id) => [id]);
  const first = rng.int(n);
  let second = rng.int(n - 1);
  if (second >= first) second++;
  const pair = new Set([playerIds[first]!, playerIds[second]!]);
  const turns: string[][] = [];
  let pairAdded = false;
  for (const id of playerIds) {
    if (!pair.has(id)) turns.push([id]);
    else if (!pairAdded) {
      turns.push([id, ...[...pair].filter((p) => p !== id)]);
      pairAdded = true;
    }
  }
  return turns;
}

function drawPrompt(deck: Deck, rng: Rng): { prompt: Prompt; deck: Deck } {
  const { card, deck: next } = drawOne(deck, rng);
  return { prompt: { categoryId: card, count: rng.chance(CHANCE_OF_THREE) ? 3 : 4 }, deck: next };
}

export function createGame(players: Player[], categoryIds: readonly string[], seed: RngState): TakotacState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Takotac se joue de ${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs`);
  }
  const rng = new Rng(seed);
  const roundTurns = buildRound(
    players.map((p) => p.id),
    rng,
  );
  const { prompt, deck } = drawPrompt(createDeck(categoryIds, rng), rng);
  return {
    game: 'takotac',
    players,
    scores: emptyScores(players),
    rng: rng.state,
    deck,
    totalRounds: roundsFor(players.length),
    round: 1,
    roundTurns,
    turnIndex: 0,
    phase: 'handoff',
    prompt,
    deadline: null,
    lastResult: null,
  };
}

export function currentPlayers(state: TakotacState): string[] {
  return state.roundTurns[state.turnIndex] ?? [];
}

/** Clôt le tour (réussi ou non) et prépare le suivant. */
function endTurn(state: TakotacState, success: boolean, timedOut: boolean): TakotacState {
  const playerIds = currentPlayers(state);
  const scores = { ...state.scores };
  if (success) for (const id of playerIds) scores[id] = (scores[id] ?? 0) + POINTS_PER_SUCCESS;
  const lastResult: TurnResult = { playerIds, success, timedOut };

  const rng = new Rng(state.rng);
  let { round, turnIndex, roundTurns } = state;
  turnIndex++;
  if (turnIndex >= roundTurns.length) {
    round++;
    if (round > state.totalRounds) {
      return { ...state, scores, lastResult, round: state.totalRounds, phase: 'finished', prompt: null, deadline: null };
    }
    roundTurns = buildRound(
      state.players.map((p) => p.id),
      rng,
    );
    turnIndex = 0;
  }
  const { prompt, deck } = drawPrompt(state.deck, rng);
  return { ...state, scores, lastResult, round, roundTurns, turnIndex, prompt, deck, rng: rng.state, phase: 'handoff', deadline: null };
}

/** Réducteur. Une action invalide dans la phase courante est ignorée (état inchangé). */
export function reduce(state: TakotacState, action: TakotacAction): TakotacState {
  switch (action.type) {
    case 'start':
      if (state.phase !== 'handoff') return state;
      return { ...state, phase: 'answering', deadline: action.at + ANSWER_DURATION_MS };

    case 'success':
      if (state.phase !== 'answering' || state.deadline === null) return state;
      // Il faut valider AVANT la fin des 7 secondes (décision 2026-11-18).
      return action.at < state.deadline ? endTurn(state, true, false) : endTurn(state, false, true);

    case 'fail':
      if (state.phase !== 'answering') return state;
      return endTurn(state, false, false);

    case 'timeout':
      if (state.phase !== 'answering' || state.deadline === null || action.at < state.deadline) return state;
      return endTurn(state, false, true);
  }
}
