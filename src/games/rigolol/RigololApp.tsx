/**
 * Rigolol, mode « un seul téléphone ». Îlot Preact monté sur /rigolol/jouer/ (et /rigolol/jouer/no-limit/).
 */
import '~/ui/play.css';
import { useMemo } from 'preact/hooks';
import { createGame, currentTurn, reduce, MAX_PLAYERS, MIN_PLAYERS, type RigololAction, type RigololState } from './engine';
import { entriesForPacks, indexById, type EntryLite } from '../core/content';
import { playerById, ranking, type Player } from '../core/players';
import { randomSeed } from '../core/rng';
import type { GameTransport } from '~/net/GameTransport';
import { AgeGate, PackPicker, PlayersEditor, SetupScreen, type PackOption } from '~/ui/Setup';
import { Btn, EndScreen, Handoff, ResultBanner, Screen, ScoreStrip, TopBar, rankingRows } from '~/ui/components';
import { useGameSession, usePersistentState } from '~/ui/session';
import { useScrollTopOn, useTransportState, useWakeLock } from '~/ui/hooks';
import { play, vibrate } from '~/ui/feedback';
import type { PlayUrls } from '~/ui/types';
import { MultiPlay } from '~/ui/multi/MultiPlay';
import { ModeChooser } from '~/ui/multi/ModeChooser';
import { usePlayMode } from '~/ui/multi/usePlayMode';
import { RigololMultiView } from './RigololMultiView';

interface Props {
  phrases: EntryLite[];
  packs: PackOption[];
  adult: boolean;
  urls: PlayUrls;
}

interface SetupState {
  players: Player[];
  packs: string[];
}

export default function RigololApp(props: Props) {
  const key = props.adult ? 'jds:rigolol-nl' : 'jds:rigolol';
  const [setup, setSetup] = usePersistentState<SetupState>(`${key}:setup`, {
    players: [],
    packs: [props.packs[0]!.id],
  });
  const [ageOk, setAgeOk] = usePersistentState<boolean>('jds:age-ok', false);
  const [mode, setMode] = usePlayMode('rigolol', props.adult);
  const session = useGameSession<RigololState, RigololAction>(`${key}:game`, reduce);
  const phrases = useMemo(() => indexById(props.phrases), [props.phrases]);

  // Packs mémorisés mais absents de cette page (ex. No Limit vu depuis le mode tout public) : ignorés.
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
    const ids = entriesForPacks(props.phrases, packs).map((p) => p.id);
    session.start(createGame(setup.players, ids, randomSeed()));
    play('start');
  };

  const title = props.adult ? 'Rigolol No Limit' : 'Rigolol';

  if (props.adult && !ageOk) {
    return (
      <div class="play">
        <TopBar title={title} backHref={props.urls.back} inGame={false} onQuit={session.quit} />
        <AgeGate gameName="Rigolol" backHref={props.urls.normal ?? props.urls.back} onAccept={() => setAgeOk(true)} />
      </div>
    );
  }

  if (mode === 'multi') {
    return (
      <MultiPlay
        game="rigolol"
        gameName="Rigolol"
        adult={props.adult}
        role="host"
        packs={props.packs}
        joinUrl={props.urls.join}
        shareUrl={props.urls.share}
        onExit={() => setMode('choose')}
        View={RigololMultiView}
        renderTopBar={(o) => <TopBar title={title} backHref={props.urls.back} inGame={o.inGame} onQuit={o.onQuit} />}
      />
    );
  }

  if (mode === 'choose' && !session.transport) {
    return (
      <div class="play">
        <TopBar title={title} backHref={props.urls.back} inGame={false} onQuit={session.quit} />
        <ModeChooser
          gameName="Rigolol"
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
        <RigololGame
          transport={session.transport}
          phrases={phrases}
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

function RigololGame(props: {
  transport: GameTransport<RigololState, RigololAction>;
  phrases: Map<string, EntryLite>;
  shareUrl: string;
  onReplay: () => void;
  onEdit: () => void;
}) {
  const state = useTransportState(props.transport);
  const dispatch = (a: RigololAction) => props.transport.dispatch(a);
  useWakeLock(state.phase !== 'finished');
  useScrollTopOn(`${state.turnIndex}-${state.phase}`);

  const name = (id: string) => playerById(state.players, id).name;
  const turn = currentTurn(state);
  const progress = `Tour ${Math.min(state.turnIndex + 1, state.schedule.length)} / ${state.schedule.length}`;
  const scores = (
    <ScoreStrip items={ranking(state.players, state.scores).map((r) => ({ id: r.player.id, label: r.player.name, score: r.score }))} />
  );

  if (state.phase === 'finished') {
    return (
      <EndScreen
        rows={rankingRows(ranking(state.players, state.scores))}
        gameName="Rigolol"
        shareUrl={props.shareUrl}
        onReplay={props.onReplay}
        onEdit={props.onEdit}
      />
    );
  }
  if (!turn) return null;

  if (state.phase === 'handoff') {
    const r = state.lastResult;
    return (
      <Handoff
        progress={progress}
        kicker="Passe le téléphone au farceur"
        name={name(turn.jokerId)}
        sub={
          <p class="hint">
            Ta cible : <strong>{name(turn.targetId)}</strong>. Ne lui montre pas l’écran !
          </p>
        }
        banner={
          r && (
            <ResultBanner
              good={r.laughed}
              emoji={r.laughed ? '😂' : '😐'}
              text={
                r.laughed
                  ? `${name(r.targetId)} a craqué : +${r.points} pour ${name(r.jokerId)} !`
                  : `${name(r.targetId)} a tenu bon : +${r.points} point.`
              }
            />
          )
        }
        scores={scores}
        buttonLabel="Voir mes 3 phrases"
        onReady={() => dispatch({ type: 'reveal' })}
      />
    );
  }

  if (state.phase === 'choosing') {
    return (
      <Screen>
        <p class="progress">{progress}</p>
        <h1 style="font-size: var(--fs-xl); margin: 0">Choisis ta phrase</h1>
        <p class="hint">
          Tu vas la lire à <strong>{name(turn.targetId)}</strong>, les yeux dans les yeux.
        </p>
        {state.choices.map((id) => {
          const p = props.phrases.get(id);
          return (
            <button key={id} type="button" class="card choice" onClick={() => dispatch({ type: 'choose', phraseId: id })}>
              <p class="card__text">
                {p?.text}
                {p?.note && <span class="card__note">({p.note})</span>}
              </p>
            </button>
          );
        })}
      </Screen>
    );
  }

  // performing
  const phrase = state.chosenId ? props.phrases.get(state.chosenId) : undefined;
  const target = name(turn.targetId);
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
              vibrate(40);
              dispatch({ type: 'resolve', laughed: false });
            }}
          >
            😐 Pas ri
          </Btn>
          <Btn
            size="xl"
            onClick={() => {
              play('success');
              vibrate([50, 30, 80]);
              dispatch({ type: 'resolve', laughed: true });
            }}
          >
            😂 A ri !
          </Btn>
        </>
      }
    >
      <p class="progress">{progress}</p>
      <p class="kicker">
        Lis-la à <strong style="color: var(--text)">{target}</strong>
      </p>
      <div class="card card--accent">
        <p class="card__text" style="font-size: clamp(1.6rem, 7vw, 2.3rem)">
          {phrase?.text}
          {phrase?.note && <span class="card__note">({phrase.note})</span>}
        </p>
      </div>
      <p class="hint">Alors, {target} a ri ?</p>
    </Screen>
  );
}
