/**
 * Takotac, mode « un seul téléphone ». Îlot Preact monté sur /takotac/jouer/ (et /takotac/jouer/no-limit/).
 */
import '~/ui/play.css';
import { useMemo } from 'preact/hooks';
import {
  ANSWER_DURATION_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  POINTS_PER_SUCCESS,
  createGame,
  currentPlayers,
  reduce,
  type TakotacAction,
  type TakotacState,
} from './engine';
import { entriesForPacks, indexById, type EntryLite } from '../core/content';
import { playerById, ranking, type Player } from '../core/players';
import { randomSeed } from '../core/rng';
import type { GameTransport } from '~/net/GameTransport';
import { AgeGate, PackPicker, PlayersEditor, SetupScreen, type PackOption } from '~/ui/Setup';
import { Btn, EndScreen, Handoff, ResultBanner, Screen, ScoreStrip, Timer, TopBar, joinNames, rankingRows } from '~/ui/components';
import { useGameSession, usePersistentState } from '~/ui/session';
import { useScrollTopOn, useTransportState, useWakeLock } from '~/ui/hooks';
import { play, vibrate } from '~/ui/feedback';
import type { PlayUrls } from '~/ui/types';
import { MultiPlay } from '~/ui/multi/MultiPlay';
import { ModeChooser } from '~/ui/multi/ModeChooser';
import { usePlayMode } from '~/ui/multi/usePlayMode';
import { TakotacMultiView } from './TakotacMultiView';

interface Props {
  categories: EntryLite[];
  packs: PackOption[];
  adult: boolean;
  urls: PlayUrls;
}

interface SetupState {
  players: Player[];
  packs: string[];
}

export default function TakotacApp(props: Props) {
  const key = props.adult ? 'jds:takotac-nl' : 'jds:takotac';
  const [setup, setSetup] = usePersistentState<SetupState>(`${key}:setup`, {
    players: [],
    packs: [props.packs[0]!.id],
  });
  const [ageOk, setAgeOk] = usePersistentState<boolean>('jds:age-ok', false);
  const [mode, setMode] = usePlayMode('takotac', props.adult);
  const session = useGameSession<TakotacState, TakotacAction>(`${key}:game`, reduce);
  const categories = useMemo(() => indexById(props.categories), [props.categories]);

  const packs = setup.packs.filter((p) => props.packs.some((o) => o.id === p));
  const blocker =
    setup.players.length < MIN_PLAYERS
      ? `Ajoute au moins ${MIN_PLAYERS} joueurs.`
      : setup.players.length > MAX_PLAYERS
        ? `${MAX_PLAYERS} joueurs maximum.`
        : packs.length === 0
          ? 'Choisis au moins un pack.'
          : null;

  const startNew = () => {
    const ids = entriesForPacks(props.categories, packs).map((c) => c.id);
    session.start(createGame(setup.players, ids, randomSeed()));
    play('start');
  };

  const title = props.adult ? 'Takotac No Limit' : 'Takotac';

  if (props.adult && !ageOk) {
    return (
      <div class="play">
        <TopBar title={title} backHref={props.urls.back} inGame={false} onQuit={session.quit} />
        <AgeGate gameName="Takotac" backHref={props.urls.normal ?? props.urls.back} onAccept={() => setAgeOk(true)} />
      </div>
    );
  }

  if (mode === 'multi') {
    return (
      <MultiPlay
        game="takotac"
        gameName="Takotac"
        adult={props.adult}
        role="host"
        packs={props.packs}
        joinUrl={props.urls.join}
        shareUrl={props.urls.share}
        onExit={() => setMode('choose')}
        View={TakotacMultiView}
        renderTopBar={(o) => <TopBar title={title} backHref={props.urls.back} inGame={o.inGame} onQuit={o.onQuit} />}
      />
    );
  }

  if (mode === 'choose' && !session.transport) {
    return (
      <div class="play">
        <TopBar title={title} backHref={props.urls.back} inGame={false} onQuit={session.quit} />
        <ModeChooser
          gameName="Takotac"
          onMulti={() => setMode('multi')}
          onLocal={() => setMode('local')}
          resume={
            session.saved
              ? {
                  label: 'Une partie sur ce téléphone est en cours.',
                  onResume: () => {
                    setMode('local');
                    session.resume();
                  },
                }
              : null
          }
        />
      </div>
    );
  }

  return (
    <div class="play">
      <TopBar title={title} backHref={props.urls.back} inGame={session.inProgress} onQuit={session.quit} />
      {session.transport ? (
        <TakotacGame
          transport={session.transport}
          categories={categories}
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
          <PlayersEditor players={setup.players} max={MAX_PLAYERS} onChange={(players) => setSetup({ ...setup, players })} />
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

function TakotacGame(props: {
  transport: GameTransport<TakotacState, TakotacAction>;
  categories: Map<string, EntryLite>;
  shareUrl: string;
  onReplay: () => void;
  onEdit: () => void;
}) {
  const state = useTransportState(props.transport);
  const dispatch = (a: TakotacAction) => props.transport.dispatch(a);
  useWakeLock(state.phase !== 'finished');
  useScrollTopOn(`${state.round}-${state.turnIndex}-${state.phase}`);

  const players = currentPlayers(state).map((id) => playerById(state.players, id));
  const answering = joinNames(players.map((p) => p.name));
  const reader = playerById(state.players, state.readerId).name;
  const coop = players.length > 1;
  const progress = `Manche ${state.round} / ${state.totalRounds}`;
  const scores = (
    <ScoreStrip items={ranking(state.players, state.scores).map((r) => ({ id: r.player.id, label: r.player.name, score: r.score }))} />
  );

  if (state.phase === 'finished') {
    return (
      <EndScreen
        rows={rankingRows(ranking(state.players, state.scores))}
        gameName="Takotac"
        shareUrl={props.shareUrl}
        onReplay={props.onReplay}
        onEdit={props.onEdit}
      />
    );
  }

  if (state.phase === 'handoff') {
    const r = state.lastResult;
    const who = r ? joinNames(r.playerIds.map((id) => playerById(state.players, id).name)) : '';
    return (
      <Handoff
        progress={progress}
        kicker="Passe le téléphone à"
        name={reader}
        sub={
          <>
            <p class="hint">
              Tu vas lire la consigne à voix haute à{' '}
              <strong style="color: var(--text)">{answering}</strong>.
            </p>
            <p class="hint">
              {coop
                ? `🤝 Coopération : ${answering} répondent ensemble, ${ANSWER_DURATION_MS / 1000} secondes chrono !`
                : `${answering} aura ${ANSWER_DURATION_MS / 1000} secondes pour répondre.`}
            </p>
          </>
        }
        banner={
          r && (
            <ResultBanner
              good={r.success}
              emoji={r.success ? '✅' : r.timedOut ? '⏱️' : '❌'}
              text={
                r.success
                  ? `+${POINTS_PER_SUCCESS} pour ${who} !`
                  : r.timedOut
                    ? `Trop tard pour ${who} !`
                    : `Raté pour ${who}.`
              }
            />
          )
        }
        scores={scores}
        buttonLabel="Lire la consigne"
        onReady={() => {
          play('start');
          dispatch({ type: 'start', at: Date.now() });
        }}
      />
    );
  }

  // answering
  const category = state.prompt ? props.categories.get(state.prompt.categoryId) : undefined;
  const verb = coop ? 'Citez' : 'Cite';
  return (
    <Screen
      row
      actions={
        <>
          <Btn
            variant="danger"
            size="xl"
            onClick={() => {
              play('fail');
              dispatch({ type: 'fail', at: Date.now() });
            }}
          >
            Raté
          </Btn>
          <Btn
            variant="success"
            size="xl"
            onClick={() => {
              play('success');
              vibrate([50, 30, 80]);
              dispatch({ type: 'success', at: Date.now() });
            }}
          >
            Validé !
          </Btn>
        </>
      }
    >
      {state.deadline !== null && (
        <Timer deadline={state.deadline} durationMs={ANSWER_DURATION_MS} onExpire={() => dispatch({ type: 'timeout', at: Date.now() })} />
      )}
      <div class="card card--accent" style="text-align: center">
        <p class="kicker" style="margin-bottom: var(--sp-2)">
          Lis à voix haute à {answering} :
        </p>
        <p class="card__text" style="font-size: clamp(1.8rem, 8vw, 2.6rem)">
          {verb} <span class="gradient-text">{state.prompt?.count}</span> {category?.text}
          {category?.note && <span class="card__note">({category.note})</span>}
        </p>
      </div>
      <p class="hint" style="text-align: center">
        Valide seulement si {answering} {coop ? 'ont' : 'a'} tout donné avant la sonnerie.
      </p>
    </Screen>
  );
}
