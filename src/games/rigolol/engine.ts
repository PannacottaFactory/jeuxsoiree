/**
 * Moteur de Rigolol (« Essaye de ne pas rire »). Fonction pure : (état, action) → nouvel état.
 * Règles : docs/gameplay-rigolol.md + docs/decisions.md.
 *
 * Machine à états d'un tour :
 *   handoff  → « Passe le téléphone à <farceur> » (les 3 phrases sont déjà tirées mais cachées)
 *   choosing → le farceur voit 3 phrases et en choisit une
 *   performing → la phrase choisie s'affiche en grand ; le farceur indique si la cible a ri
 *   → tour suivant (handoff) ou finished
 */
import { Rng, type RngState } from '../core/rng';
import { createDeck, drawCards, type Deck } from '../core/deck';
import { emptyScores, type Player, type Scores } from '../core/players';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const CHOICES_PER_TURN = 3;

export interface Turn {
  /** Le farceur : essaie de faire rire. */
  jokerId: string;
  /** La cible : ne doit pas rire. */
  targetId: string;
}

export interface TurnResult {
  jokerId: string;
  targetId: string;
  laughed: boolean;
  /** Joueur qui a marqué et nombre de points. */
  scorerId: string;
  points: number;
}

export type RigololPhase = 'handoff' | 'choosing' | 'performing' | 'finished';

export interface RigololState {
  game: 'rigolol';
  players: Player[];
  scores: Scores;
  rng: RngState;
  deck: Deck;
  schedule: Turn[];
  turnIndex: number;
  phase: RigololPhase;
  /** Les 3 phrases proposées au farceur pour le tour en cours. */
  choices: string[];
  chosenId: string | null;
  lastResult: TurnResult | null;
}

export type RigololAction =
  | { type: 'reveal' }
  | { type: 'choose'; phraseId: string }
  | { type: 'resolve'; laughed: boolean };

/**
 * Nombre de cycles (chaque joueur est la cible une fois par cycle), repris de l'app :
 * maxRound = 5 (2 joueurs), 3 (3-4 joueurs), 2 (5-6 joueurs), et cycles = maxRound - 1.
 */
export function cyclesFor(playerCount: number): number {
  if (playerCount <= 2) return 4;
  if (playerCount <= 4) return 2;
  return 1;
}

/** Points du farceur quand la cible rit : autant que de joueurs. Points de la cible qui résiste : 1. */
export const pointsForLaugh = (playerCount: number) => playerCount;
export const POINTS_FOR_RESIST = 1;

/**
 * Ordre des tours : pour chaque cycle, chaque joueur est la cible à son tour et tous les autres tentent
 * une fois de le faire rire. L'ordre des joueurs est tiré au hasard en début de partie.
 */
export function buildSchedule(playerIds: readonly string[], rng: Rng): Turn[] {
  const order = rng.shuffle(playerIds);
  const n = order.length;
  const turns: Turn[] = [];
  for (let c = 0; c < cyclesFor(n); c++) {
    for (let t = 0; t < n; t++) {
      for (let k = 1; k < n; k++) {
        turns.push({ targetId: order[t]!, jokerId: order[(t + k) % n]! });
      }
    }
  }
  return turns;
}

export function createGame(players: Player[], phraseIds: readonly string[], seed: RngState): RigololState {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`Rigolol se joue de ${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs`);
  }
  const rng = new Rng(seed);
  const schedule = buildSchedule(
    players.map((p) => p.id),
    rng,
  );
  const deck = createDeck(phraseIds, rng);
  const draw = drawCards(deck, CHOICES_PER_TURN, rng);
  return {
    game: 'rigolol',
    players,
    scores: emptyScores(players),
    rng: rng.state,
    deck: draw.deck,
    schedule,
    turnIndex: 0,
    phase: 'handoff',
    choices: draw.cards,
    chosenId: null,
    lastResult: null,
  };
}

export function currentTurn(state: RigololState): Turn | null {
  return state.schedule[state.turnIndex] ?? null;
}

/** Réducteur. Une action invalide dans la phase courante est ignorée (état inchangé). */
export function reduce(state: RigololState, action: RigololAction): RigololState {
  switch (action.type) {
    case 'reveal':
      return state.phase === 'handoff' ? { ...state, phase: 'choosing' } : state;

    case 'choose':
      if (state.phase !== 'choosing' || !state.choices.includes(action.phraseId)) return state;
      return { ...state, phase: 'performing', chosenId: action.phraseId };

    case 'resolve': {
      const turn = currentTurn(state);
      if (state.phase !== 'performing' || !turn) return state;
      const n = state.players.length;
      const scorerId = action.laughed ? turn.jokerId : turn.targetId;
      const points = action.laughed ? pointsForLaugh(n) : POINTS_FOR_RESIST;
      const scores = { ...state.scores, [scorerId]: (state.scores[scorerId] ?? 0) + points };
      const lastResult: TurnResult = { ...turn, laughed: action.laughed, scorerId, points };
      const turnIndex = state.turnIndex + 1;

      if (turnIndex >= state.schedule.length) {
        return { ...state, scores, lastResult, turnIndex, phase: 'finished', choices: [], chosenId: null };
      }
      const rng = new Rng(state.rng);
      const draw = drawCards(state.deck, CHOICES_PER_TURN, rng);
      return {
        ...state,
        scores,
        lastResult,
        turnIndex,
        phase: 'handoff',
        choices: draw.cards,
        chosenId: null,
        deck: draw.deck,
        rng: rng.state,
      };
    }
  }
}
