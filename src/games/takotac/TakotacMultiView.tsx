/**
 * Takotac, chacun son téléphone : le lecteur voit la consigne, la lit et valide ; le joueur interrogé ne voit que le
 * chrono (il écoute) ; les autres voient la consigne pour suivre.
 */
import type { MultiViewProps } from '~/ui/multi/MultiPlay';
import type { TakotacSecret, TakotacView } from './multi';
import { ANSWER_DURATION_MS, POINTS_PER_SUCCESS } from './engine';
import { Btn, EndScreen, ResultBanner, Screen, ScoreStrip, Timer, joinNames, rankingRows } from '~/ui/components';
import { ranking } from '../core/players';
import { play, vibrate } from '~/ui/feedback';
import { useScrollTopOn } from '~/ui/hooks';

export function TakotacMultiView(props: MultiViewProps<TakotacView, TakotacSecret>) {
  const { view, secret, me } = props;
  useScrollTopOn(`${view.round}-${view.turnPlayers.join()}-${view.phase}`);
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  const scores = <ScoreStrip items={ranking(view.players, view.scores).map((r) => ({ id: r.player.id, label: r.player.name, score: r.score }))} />;

  if (view.phase === 'finished') {
    return (
      <EndScreen
        rows={rankingRows(ranking(view.players, view.scores))}
        gameName="Takotac"
        shareUrl={props.shareUrl}
        onReplay={props.isHost ? props.onReplay : undefined}
        onEdit={props.isHost ? props.onLobby : undefined}
        waitingNote="L’hôte peut relancer une partie."
      />
    );
  }

  const answering = joinNames(view.turnPlayers.map(name));
  const coop = view.turnPlayers.length > 1;
  const reader = name(view.readerId);
  const isReader = me === view.readerId;
  const isAnswering = view.turnPlayers.includes(me);
  const progress = <p class="progress">Manche {view.round} / {view.totalRounds}</p>;
  const backup = props.backupName && <p class="backup-banner">Tu joues à la place de {props.backupName} (hors ligne).</p>;
  const r = view.lastResult;
  const who = r ? joinNames(r.playerIds.map(name)) : '';
  const banner = r && (
    <ResultBanner
      good={r.success}
      emoji={r.success ? '✅' : r.timedOut ? '⏱️' : '❌'}
      text={r.success ? `+${POINTS_PER_SUCCESS} pour ${who} !` : r.timedOut ? `Trop tard pour ${who} !` : `Raté pour ${who}.`}
    />
  );

  if (view.phase === 'handoff') {
    if (isReader) {
      return (
        <Screen
          center
          actions={
            <Btn
              size="xl"
              onClick={() => {
                play('start');
                props.dispatch({ type: 'start', at: 0 });
              }}
            >
              Lire la consigne
            </Btn>
          }
        >
          {banner}
          {backup}
          {progress}
          <p class="kicker">C’est toi qui lis la consigne à</p>
          <p class="big-name gradient-text">{answering}</p>
          <p class="hint">
            Appuie, lis la consigne à voix haute, puis valide si {answering} {coop ? 'ont' : 'a'} tout donné avant la sonnerie.
          </p>
          {scores}
        </Screen>
      );
    }
    return (
      <Screen center>
        {banner}
        {progress}
        {isAnswering ? (
          <>
            <p class="kicker">{coop ? '🤝 Coopération ! Préparez-vous' : 'Prépare-toi, c’est à toi !'}</p>
            <p class="big-name gradient-text">{reader}</p>
            <p class="hint">
              va te lire la consigne. {ANSWER_DURATION_MS / 1000} secondes pour répondre !
            </p>
          </>
        ) : (
          <>
            <p class="kicker">{reader} va lire la consigne à</p>
            <p class="big-name gradient-text">{answering}</p>
          </>
        )}
        {scores}
      </Screen>
    );
  }

  // answering
  const timer = view.deadline !== null && <Timer deadline={view.deadline - props.clockOffset} durationMs={ANSWER_DURATION_MS} onExpire={() => undefined} />;
  const prompt = secret?.prompt;
  const promptCard = prompt && (
    <div class="card card--accent" style="text-align: center">
      {isReader && (
        <p class="kicker" style="margin-bottom: var(--sp-2)">
          Lis à voix haute à {answering} :
        </p>
      )}
      <p class="card__text" style="font-size: clamp(1.8rem, 8vw, 2.6rem)">
        {coop ? 'Citez' : 'Cite'} <span class="gradient-text">{prompt.count}</span> {prompt.category?.text}
        {prompt.category?.note && <span class="card__note">({prompt.category.note})</span>}
      </p>
    </div>
  );

  if (isReader) {
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
                props.dispatch({ type: 'fail', at: 0 });
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
                props.dispatch({ type: 'success', at: 0 });
              }}
            >
              Validé !
            </Btn>
          </>
        }
      >
        {backup}
        {timer}
        {promptCard}
        <p class="hint" style="text-align: center">
          Valide seulement si {answering} {coop ? 'ont' : 'a'} tout donné avant la sonnerie.
        </p>
      </Screen>
    );
  }

  return (
    <Screen center>
      {timer}
      {isAnswering ? (
        <p class="big-name gradient-text">Écoute {reader} !</p>
      ) : (
        <>
          <p class="kicker">{answering} répond…</p>
          {promptCard}
        </>
      )}
    </Screen>
  );
}
