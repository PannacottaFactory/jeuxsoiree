/**
 * Moteur de Mimos (jeu de mimes). Fonction pure : (état, action) → nouvel état.
 * Règles : docs/gameplay-mimos.md + docs/decisions.md.
 *
 * Machine à états d'un passage :
 *   handoff    → « Au tour de <mimeur> » ; il appuie sur Prêt
 *   miming     → chrono de 60 s, 5 opportunités maximum ; « Trouvé » (+1) ou « Passer » (perdue)
 *   passageEnd → bilan du passage (5 expressions jouées ou temps écoulé)
 *   → passage suivant (handoff) ou finished
 *
 * Le temps est fourni par les actions (`at`, en ms) : le moteur ne lit jamais l'horloge, il reste pur et testable.
 */
import { Rng, type RngState } from '../core/rng';
import { createDeck, drawOne, type Deck } from '../core/deck';
import { emptyScores, type Player, type Scores } from '../core/players';
import { entriesForPacks } from '../core/content';

export const PASSAGE_DURATION_MS = 60_000;
export const CARDS_PER_PASSAGE = 5;
export const FFA_MIN = 2;
export const FFA_MAX = 6;
export const TEAM_MIN = 2;
export const TEAM_MAX = 4;

export type MimosMode = 'ffa' | 'teams';

export interface Card {
  subjectId: string;
  actionId: string;
}

export interface CardLog extends Card {
  found: boolean;
}

export type MimosPhase = 'handoff' | 'miming' | 'passageEnd' | 'finished';

export interface MimosState {
  game: 'mimos';
  mode: MimosMode;
  players: Player[];
  /** Points individuels (en équipes : expressions trouvées par chaque mimeur, pour info). */
  scores: Scores;
  /** Points des équipes 0 et 1 (mode équipes). */
  teamScores: [number, number];
  rng: RngState;
  subjectDeck: Deck;
  actionDeck: Deck;
  /** Ordre des passages (identifiants des mimeurs). */
  schedule: string[];
  passageIndex: number;
  phase: MimosPhase;
  /** Index de l'expression en cours dans le passage (0 à 4). */
  cardIndex: number;
  card: Card | null;
  /** Fin du chrono (ms, horloge de l'appareil qui fait autorité). */
  deadline: number | null;
  passageLog: CardLog[];
  endReason: 'done' | 'timeout' | null;
}

export type MimosAction =
  | { type: 'start'; at: number }
  | { type: 'found'; at: number }
  | { type: 'skip'; at: number }
  | { type: 'timeout'; at: number }
  | { type: 'next' };

/** Passages par joueur (décision 2026-11-18) : clamp(round(12 / n), 2, 4). */
export function passagesPerPlayer(playerCount: number): number {
  return Math.min(4, Math.max(2, Math.round(12 / playerCount)));
}

/** Vérifie la composition des joueurs. Retourne un message d'erreur ou null. */
export function validatePlayers(players: readonly Player[], mode: MimosMode): string | null {
  if (mode === 'ffa') {
    if (players.length < FFA_MIN) return `Il faut au moins ${FFA_MIN} joueurs.`;
    if (players.length > FFA_MAX) return `${FFA_MAX} joueurs maximum en chacun pour soi.`;
    return null;
  }
  const a = players.filter((p) => p.team === 0).length;
  const b = players.filter((p) => p.team === 1).length;
  if (a + b !== players.length) return 'Chaque joueur doit être dans une équipe.';
  if (a < TEAM_MIN || b < TEAM_MIN) return `Il faut au moins ${TEAM_MIN} joueurs par équipe.`;
  if (a > TEAM_MAX || b > TEAM_MAX) return `${TEAM_MAX} joueurs maximum par équipe.`;
  if (a !== b) return 'Les deux équipes doivent avoir le même nombre de joueurs.';
  return null;
}

/**
 * Ordre des passages. Chacun pour soi : ordre de saisie, répété. Équipes : alternance équipe 1 / équipe 2,
 * chaque équipe faisant tourner ses joueurs dans l'ordre.
 */
export function buildSchedule(players: readonly Player[], mode: MimosMode): string[] {
  const rounds = passagesPerPlayer(players.length);
  let round: string[];
  if (mode === 'ffa') {
    round = players.map((p) => p.id);
  } else {
    const a = players.filter((p) => p.team === 0);
    const b = players.filter((p) => p.team === 1);
    round = a.flatMap((p, i) => [p.id, b[i]!.id]);
  }
  return Array.from({ length: rounds }, () => round).flat();
}

interface MimosEntry {
  id: string;
  packs: string[];
}

/**
 * Sujets et actions jouables pour les packs cochés.
 * Célébrités n'apporte que des sujets : s'il est le seul pack coché, on prend les actions de Tout doux.
 */
export function selectContent(
  subjects: readonly MimosEntry[],
  actions: readonly MimosEntry[],
  packs: readonly string[],
): { subjectIds: string[]; actionIds: string[] } {
  const subjectIds = entriesForPacks(subjects, packs).map((e) => e.id);
  let actionIds = entriesForPacks(actions, packs).map((e) => e.id);
  if (actionIds.length === 0) actionIds = entriesForPacks(actions, ['tout-doux']).map((e) => e.id);
  return { subjectIds, actionIds };
}

export function createGame(
  players: Player[],
  mode: MimosMode,
  content: { subjectIds: readonly string[]; actionIds: readonly string[] },
  seed: RngState,
): MimosState {
  const error = validatePlayers(players, mode);
  if (error) throw new Error(error);
  const rng = new Rng(seed);
  return {
    game: 'mimos',
    mode,
    players,
    scores: emptyScores(players),
    teamScores: [0, 0],
    rng: rng.state,
    subjectDeck: createDeck(content.subjectIds, rng),
    actionDeck: createDeck(content.actionIds, rng),
    schedule: buildSchedule(players, mode),
    passageIndex: 0,
    phase: 'handoff',
    cardIndex: 0,
    card: null,
    deadline: null,
    passageLog: [],
    endReason: null,
  };
}

export function currentMimeId(state: MimosState): string | null {
  return state.schedule[state.passageIndex] ?? null;
}

/** Tire une nouvelle expression (sujet + action). */
function drawCard(state: MimosState): Pick<MimosState, 'card' | 'subjectDeck' | 'actionDeck' | 'rng'> {
  const rng = new Rng(state.rng);
  const s = drawOne(state.subjectDeck, rng);
  const a = drawOne(state.actionDeck, rng);
  return { card: { subjectId: s.card, actionId: a.card }, subjectDeck: s.deck, actionDeck: a.deck, rng: rng.state };
}

/** Termine l'expression en cours (trouvée ou passée) et enchaîne. */
function closeCard(state: MimosState, found: boolean): MimosState {
  if (!state.card) return state;
  const passageLog = [...state.passageLog, { ...state.card, found }];
  let { scores, teamScores } = state;
  if (found) {
    const mimeId = currentMimeId(state)!;
    scores = { ...scores, [mimeId]: (scores[mimeId] ?? 0) + 1 };
    const team = state.players.find((p) => p.id === mimeId)?.team;
    if (state.mode === 'teams' && team !== undefined) {
      teamScores = team === 0 ? [teamScores[0] + 1, teamScores[1]] : [teamScores[0], teamScores[1] + 1];
    }
  }
  const cardIndex = state.cardIndex + 1;
  if (cardIndex >= CARDS_PER_PASSAGE) {
    return { ...state, scores, teamScores, passageLog, cardIndex, card: null, phase: 'passageEnd', endReason: 'done', deadline: null };
  }
  return { ...state, scores, teamScores, passageLog, cardIndex, ...drawCard(state) };
}

function timeUp(state: MimosState): MimosState {
  // L'expression affichée au moment du gong compte comme non trouvée.
  const passageLog = state.card ? [...state.passageLog, { ...state.card, found: false }] : state.passageLog;
  return { ...state, passageLog, card: null, phase: 'passageEnd', endReason: 'timeout', deadline: null };
}

/** Réducteur. Une action invalide dans la phase courante est ignorée (état inchangé). */
export function reduce(state: MimosState, action: MimosAction): MimosState {
  switch (action.type) {
    case 'start':
      if (state.phase !== 'handoff') return state;
      return {
        ...state,
        phase: 'miming',
        cardIndex: 0,
        passageLog: [],
        endReason: null,
        deadline: action.at + PASSAGE_DURATION_MS,
        ...drawCard(state),
      };

    case 'found':
    case 'skip':
      if (state.phase !== 'miming' || state.deadline === null) return state;
      // Un appui après le gong ne compte pas : c'est la fin du temps qui s'applique.
      if (action.at >= state.deadline) return timeUp(state);
      return closeCard(state, action.type === 'found');

    case 'timeout':
      if (state.phase !== 'miming' || state.deadline === null || action.at < state.deadline) return state;
      return timeUp(state);

    case 'next': {
      if (state.phase !== 'passageEnd') return state;
      const passageIndex = state.passageIndex + 1;
      const finished = passageIndex >= state.schedule.length;
      return { ...state, passageIndex, phase: finished ? 'finished' : 'handoff', cardIndex: 0, card: null };
    }
  }
}
