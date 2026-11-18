/**
 * Mimos, mode « un seul téléphone ». Îlot Preact monté sur /mimos/jouer/ (et /mimos/jouer/no-limit/).
 */
import '~/ui/play.css';
import { useMemo } from 'preact/hooks';
import {
  CARDS_PER_PASSAGE,
  FFA_MAX,
  PASSAGE_DURATION_MS,
  TEAM_MAX,
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
import { playerById, ranking, type Player } from '../core/players';
import { randomSeed } from '../core/rng';
import type { GameTransport } from '~/net/GameTransport';
import { AgeGate, PackPicker, PlayersEditor, SetupScreen, type PackOption } from '~/ui/Setup';
import { Btn, EndScreen, Handoff, Screen, ScoreStrip, Timer, TopBar, rankingRows } from '~/ui/components';
import { useGameSession, usePersistentState } from '~/ui/session';
import { useScrollTopOn, useTransportState, useWakeLock } from '~/ui/hooks';
import { play, vibrate } from '~/ui/feedback';
import type { PlayUrls } from '~/ui/types';

interface Props {
  subjects: EntryLite[];
  actions: EntryLite[];
  packs: PackOption[];
  adult: boolean;
  urls: PlayUrls;
}

interface SetupState {
  mode: MimosMode;
  players: Player[];
  packs: string[];
}

/** Passage de chacun pour soi à équipes (et inversement) sans perdre les joueurs déjà saisis. */
function switchMode(players: Player[], mode: MimosMode): Player[] {
  if (mode === 'ffa') return players.map(({ team: _team, ...p }) => p);
  return players.map((p, i) => ({ ...p, team: p.team ?? ((i % 2) as 0 | 1) }));
}

export default function MimosApp(props: Props) {
  const key = props.adult ? 'jds:mimos-nl' : 'jds:mimos';
  const [setup, setSetup] = usePersistentState<SetupState>(`${key}:setup`, {
    mode: 'ffa',
    players: [],
    packs: [props.packs[0]!.id],
  });
  const [ageOk, setAgeOk] = usePersistentState<boolean>('jds:age-ok', false);
  const session = useGameSession<MimosState, MimosAction>(`${key}:game`, reduce);
  const subjects = useMemo(() => indexById(props.subjects), [props.subjects]);
  const actions = useMemo(() => indexById(props.actions), [props.actions]);

  const packs = setup.packs.filter((p) => props.packs.some((o) => o.id === p));
  const blocker = packs.length === 0 ? 'Choisis au moins un pack.' : validatePlayers(setup.players, setup.mode);

  const startNew = () => {
    const content = selectContent(props.subjects, props.actions, packs);
    session.start(createGame(setup.players, setup.mode, content, randomSeed()));
    play('start');
  };

  const title = props.adult ? 'Mimos No Limit' : 'Mimos';

  if (props.adult && !ageOk) {
    return (
      <div class="play">
        <TopBar title={title} backHref={props.urls.back} inGame={false} onQuit={session.quit} />
        <AgeGate gameName="Mimos" backHref={props.urls.normal ?? props.urls.back} onAccept={() => setAgeOk(true)} />
      </div>
    );
  }

  return (
    <div class="play">
      <TopBar title={title} backHref={props.urls.back} inGame={session.inProgress} onQuit={session.quit} />
      {session.transport ? (
        <MimosGame
          transport={session.transport}
          subjects={subjects}
          actions={actions}
          shareUrl={props.urls.share}
          onReplay={startNew}
          onEdit={session.quit}
        />
      ) : (
        <SetupScreen
          title="Nouvelle partie"
          blocker={blocker}
          onStart={startNew}
          resume={session.saved ? { onResume: session.resume, onDiscard: session.discard } : null}
        >
          <div class="setup-section">
            <h2>Mode</h2>
            <div class="segmented" role="group" aria-label="Mode de jeu">
              {(['ffa', 'teams'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={setup.mode === m}
                  onClick={() => setSetup({ ...setup, mode: m, players: switchMode(setup.players, m) })}
                >
                  {m === 'ffa' ? 'Chacun pour soi' : 'Équipes'}
                </button>
              ))}
            </div>
          </div>
          <PlayersEditor
            players={setup.players}
            max={setup.mode === 'ffa' ? FFA_MAX : TEAM_MAX * 2}
            onChange={(players) => setSetup({ ...setup, players })}
            {...(setup.mode === 'teams' ? { teams: { maxPerTeam: TEAM_MAX } } : {})}
          />
          <PackPicker
            packs={props.packs}
            selected={packs}
            onChange={(ids) => setSetup({ ...setup, packs: ids })}
            {...(props.urls.adult ? { adultHref: props.urls.adult } : {})}
          />
        </SetupScreen>
      )}
    </div>
  );
}

function MimosGame(props: {
  transport: GameTransport<MimosState, MimosAction>;
  subjects: Map<string, EntryLite>;
  actions: Map<string, EntryLite>;
  shareUrl: string;
  onReplay: () => void;
  onEdit: () => void;
}) {
  const state = useTransportState(props.transport);
  const dispatch = (a: MimosAction) => props.transport.dispatch(a);
  useWakeLock(state.phase !== 'finished');
  useScrollTopOn(`${state.passageIndex}-${state.phase}`);

  const teams = state.mode === 'teams';
  const name = (id: string) => playerById(state.players, id).name;
  const teamLabel = (t: 0 | 1 | undefined) => (t === undefined ? '' : `Équipe ${t + 1}`);
  const progress = `Passage ${Math.min(state.passageIndex + 1, state.schedule.length)} / ${state.schedule.length}`;
  const scores = teams ? (
    <ScoreStrip
      items={[
        { id: 't0', label: 'Équipe 1', score: state.teamScores[0] },
        { id: 't1', label: 'Équipe 2', score: state.teamScores[1] },
      ]}
    />
  ) : (
    <ScoreStrip items={ranking(state.players, state.scores).map((r) => ({ id: r.player.id, label: r.player.name, score: r.score }))} />
  );

  if (state.phase === 'finished') {
    if (teams) {
      const [a, b] = state.teamScores;
      const members = (t: 0 | 1) => state.players.filter((p) => p.team === t).map((p) => p.name).join(', ');
      const rows = [
        { id: 't0', name: `Équipe 1 (${members(0)})`, score: a, rank: a >= b ? 1 : 2 },
        { id: 't1', name: `Équipe 2 (${members(1)})`, score: b, rank: b >= a ? 1 : 2 },
      ].sort((x, y) => y.score - x.score);
      return (
        <EndScreen
          rows={rows}
          gameName="Mimos"
          shareUrl={props.shareUrl}
          onReplay={props.onReplay}
          onEdit={props.onEdit}
          footer={
            <p class="hint" style="text-align: center">
              Meilleur mimeur : {rankingRows(ranking(state.players, state.scores))[0]?.name}
            </p>
          }
        />
      );
    }
    return (
      <EndScreen
        rows={rankingRows(ranking(state.players, state.scores))}
        gameName="Mimos"
        shareUrl={props.shareUrl}
        onReplay={props.onReplay}
        onEdit={props.onEdit}
      />
    );
  }

  const mimeId = currentMimeId(state);
  if (!mimeId) return null;
  const mime = playerById(state.players, mimeId);

  if (state.phase === 'handoff') {
    return (
      <Handoff
        progress={progress}
        kicker={teams ? `${teamLabel(mime.team)} : à toi de mimer` : 'À toi de mimer'}
        name={mime.name}
        sub={
          <p class="hint">
            Prends le téléphone sans montrer l’écran. {CARDS_PER_PASSAGE} expressions, {PASSAGE_DURATION_MS / 1000} secondes.
          </p>
        }
        scores={scores}
        buttonLabel="Prêt ? C’est parti !"
        onReady={() => {
          play('start');
          dispatch({ type: 'start', at: Date.now() });
        }}
      />
    );
  }

  if (state.phase === 'miming' && state.card && state.deadline !== null) {
    const subject = props.subjects.get(state.card.subjectId);
    const action = props.actions.get(state.card.actionId);
    return (
      <Screen
        row
        actions={
          <>
            <Btn
              variant="ghost"
              size="xl"
              onClick={() => {
                play('fail');
                dispatch({ type: 'skip', at: Date.now() });
              }}
            >
              Passer
            </Btn>
            <Btn
              variant="success"
              size="xl"
              onClick={() => {
                play('success');
                vibrate(60);
                dispatch({ type: 'found', at: Date.now() });
              }}
            >
              Trouvé !
            </Btn>
          </>
        }
      >
        <Timer deadline={state.deadline} durationMs={PASSAGE_DURATION_MS} small onExpire={() => dispatch({ type: 'timeout', at: Date.now() })} />
        <p class="progress" style="text-align: center">
          Expression {state.cardIndex + 1} / {CARDS_PER_PASSAGE}
        </p>
        <div class="card card--accent" key={state.cardIndex} style="text-align: center">
          <p class="card__text" style="font-size: clamp(1.8rem, 8vw, 2.6rem)">
            {subject?.text}
            {subject?.note && <span class="card__note">({subject.note})</span>}
          </p>
          <p class="card__text" style="margin-top: var(--sp-3); color: var(--accent)">
            {action?.text.replace(/^Qui /, 'qui ')}
          </p>
        </div>
        <p class="hint" style="text-align: center">
          Sans parler ! Passer fait perdre l’expression.
        </p>
      </Screen>
    );
  }

  // passageEnd : bilan
  const found = state.passageLog.filter((c) => c.found).length;
  return (
    <Screen
      actions={
        <Btn size="xl" onClick={() => dispatch({ type: 'next' })}>
          {state.passageIndex + 1 >= state.schedule.length ? 'Voir les résultats' : 'Joueur suivant'}
        </Btn>
      }
    >
      <div style="text-align: center">
        <p class="kicker">{state.endReason === 'timeout' ? 'Temps écoulé !' : 'Plus rien à faire deviner !'}</p>
        <p class="big-name gradient-text">
          +{found} point{found > 1 ? 's' : ''}
        </p>
        <p class="hint">
          {name(mimeId)}
          {teams ? ` (${teamLabel(mime.team)})` : ''}
        </p>
      </div>
      <ul class="podium">
        {state.passageLog.map((c, i) => (
          <li key={i}>
            <span class="podium__rank" aria-label={c.found ? 'Trouvée' : 'Ratée'}>
              {c.found ? '✅' : '❌'}
            </span>
            <span class="podium__name">
              {props.subjects.get(c.subjectId)?.text} {props.actions.get(c.actionId)?.text.replace(/^Qui /, 'qui ')}
            </span>
          </li>
        ))}
      </ul>
      {scores}
    </Screen>
  );
}
