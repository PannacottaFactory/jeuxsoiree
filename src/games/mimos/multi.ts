/**
 * Mimos en multijoueur. L'expression à mimer n'apparaît que sur le téléphone du mimeur ; les autres voient le chrono
 * et le compteur. Les expressions sont révélées à tous à la fin du passage.
 */
import {
  createGame,
  currentMimeId,
  reduce,
  selectContent,
  validatePlayers,
  type MimosAction,
  type MimosMode,
  type MimosState,
} from './engine';
import { indexById, type EntryLite } from '../core/content';
import { textOf, type MultiAdapter, type TextRef } from '../core/multi';
import type { Player, Scores } from '../core/players';

export interface MimosConfig {
  packs: string[];
  mode: MimosMode;
}

export interface MimosView {
  game: 'mimos';
  mode: MimosMode;
  phase: MimosState['phase'];
  players: Player[];
  scores: Scores;
  teamScores: [number, number];
  passageIndex: number;
  totalPassages: number;
  mimeId: string | null;
  cardIndex: number;
  deadline: number | null;
  endReason: MimosState['endReason'];
  /** Expressions du passage, révélées à la fin du passage seulement. */
  log: { subject: TextRef | null; action: TextRef | null; found: boolean }[];
  foundThisPassage: number;
}

export interface MimosSecret {
  subject: TextRef | null;
  action: TextRef | null;
}

/** En équipes, les joueurs arrivés sans équipe rejoignent la moins remplie (dans l'ordre d'arrivée). */
export function withTeams(players: Player[], mode: MimosMode): Player[] {
  if (mode === 'ffa') return players.map(({ team: _t, ...p }) => p);
  const count: [number, number] = [0, 0];
  for (const p of players) if (p.team !== undefined) count[p.team]++;
  return players.map((p) => {
    if (p.team !== undefined) return p;
    const team: 0 | 1 = count[0] <= count[1] ? 0 : 1;
    count[team]++;
    return { ...p, team };
  });
}

export function mimosAdapter(subjects: EntryLite[], actions: EntryLite[]): MultiAdapter<MimosState, MimosAction, MimosView, MimosSecret, MimosConfig> {
  const subjectIndex = indexById(subjects);
  const actionIndex = indexById(actions);
  return {
    game: 'mimos',
    defaultConfig: () => ({ packs: ['tout-doux'], mode: 'ffa' }),
    validate(players, config) {
      const content = selectContent(subjects, actions, config.packs);
      if (content.subjectIds.length === 0 || content.actionIds.length === 0) return 'Choisis au moins un pack.';
      return validatePlayers(withTeams(players, config.mode), config.mode);
    },
    create: (players, config, seed) => createGame(withTeams(players, config.mode), config.mode, selectContent(subjects, actions, config.packs), seed),
    reduce,
    // Le mimeur pilote son passage ; la fin du chrono est déclenchée par l'hôte.
    actors: (state) => {
      const id = currentMimeId(state);
      return id && state.phase !== 'finished' ? [id] : [];
    },
    authorize: (state, action, uid) => action.type !== 'timeout' && currentMimeId(state) === uid,
    scheduled: (state) =>
      state.phase === 'miming' && state.deadline !== null ? { at: state.deadline, action: { type: 'timeout', at: state.deadline } } : null,
    project(state) {
      const mimeId = currentMimeId(state);
      const view: MimosView = {
        game: 'mimos',
        mode: state.mode,
        phase: state.phase,
        players: state.players,
        scores: state.scores,
        teamScores: state.teamScores,
        passageIndex: state.passageIndex,
        totalPassages: state.schedule.length,
        mimeId,
        cardIndex: state.cardIndex,
        deadline: state.deadline,
        endReason: state.endReason,
        log:
          state.phase === 'passageEnd'
            ? state.passageLog.map((c) => ({ subject: textOf(subjectIndex, c.subjectId), action: textOf(actionIndex, c.actionId), found: c.found }))
            : [],
        foundThisPassage: state.passageLog.filter((c) => c.found).length,
      };
      const secrets: Record<string, MimosSecret> = {};
      if (mimeId && state.phase === 'miming' && state.card) {
        secrets[mimeId] = { subject: textOf(subjectIndex, state.card.subjectId), action: textOf(actionIndex, state.card.actionId) };
      }
      return { view, secrets };
    },
  };
}
