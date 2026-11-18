/**
 * Rigolol, chacun son téléphone : le farceur voit et choisit ses phrases, la cible voit « Ne ris pas ! »,
 * les autres suivent le duel.
 */
import type { MultiViewProps } from '~/ui/multi/MultiPlay';
import type { RigololSecret, RigololView } from './multi';
import { Btn, EndScreen, ResultBanner, Screen, ScoreStrip, rankingRows } from '~/ui/components';
import { ranking } from '../core/players';
import { play, vibrate } from '~/ui/feedback';
import { useScrollTopOn } from '~/ui/hooks';

export function RigololMultiView(props: MultiViewProps<RigololView, RigololSecret>) {
  const { view, secret, me } = props;
  useScrollTopOn(`${view.turnIndex}-${view.phase}`);
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.name ?? '?';
  const scores = <ScoreStrip items={ranking(view.players, view.scores).map((r) => ({ id: r.player.id, label: r.player.name, score: r.score }))} />;

  if (view.phase === 'finished') {
    return (
      <EndScreen
        rows={rankingRows(ranking(view.players, view.scores))}
        gameName="Rigolol"
        shareUrl={props.shareUrl}
        onReplay={props.isHost ? props.onReplay : undefined}
        onEdit={props.isHost ? props.onLobby : undefined}
        waitingNote="L’hôte peut relancer une partie."
      />
    );
  }

  const progress = <p class="progress">Tour {view.turnIndex + 1} / {view.totalTurns}</p>;
  const r = view.lastResult;
  const banner = r && (
    <ResultBanner
      good={r.laughed}
      emoji={r.laughed ? '😂' : '😐'}
      text={`${r.laughed ? `${name(r.targetId)} a craqué : +${r.points} pour ${name(r.jokerId)}` : `${name(r.targetId)} a tenu bon : +${r.points}`}${r.phrase ? ` — « ${r.phrase.text} »` : ''}`}
    />
  );
  const backup = props.backupName && <p class="backup-banner">Tu joues à la place de {props.backupName} (hors ligne).</p>;
  const joker = name(view.jokerId);
  const target = name(view.targetId);

  // ---- Le farceur
  if (me === view.jokerId) {
    if (view.phase === 'choosing' && secret?.choices) {
      return (
        <Screen>
          {backup}
          {progress}
          <h1 style="font-size: var(--fs-xl); margin: 0">Choisis ta phrase</h1>
          <p class="hint">
            Tu vas la lire à <strong>{target}</strong>, les yeux dans les yeux.
          </p>
          {secret.choices.map((c) => (
            <button key={c.id} type="button" class="card choice" onClick={() => props.dispatch({ type: 'choose', phraseId: c.id })}>
              <p class="card__text">
                {c.text}
                {c.note && <span class="card__note">({c.note})</span>}
              </p>
            </button>
          ))}
        </Screen>
      );
    }
    if (view.phase === 'performing' && secret?.chosen) {
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
                  props.dispatch({ type: 'resolve', laughed: false });
                }}
              >
                😐 Pas ri
              </Btn>
              <Btn
                size="xl"
                onClick={() => {
                  play('success');
                  vibrate([50, 30, 80]);
                  props.dispatch({ type: 'resolve', laughed: true });
                }}
              >
                😂 A ri !
              </Btn>
            </>
          }
        >
          {backup}
          {progress}
          <p class="kicker">
            Lis-la à <strong style="color: var(--text)">{target}</strong>
          </p>
          <div class="card card--accent">
            <p class="card__text" style="font-size: clamp(1.6rem, 7vw, 2.3rem)">
              {secret.chosen.text}
              {secret.chosen.note && <span class="card__note">({secret.chosen.note})</span>}
            </p>
          </div>
          <p class="hint">Alors, {target} a ri ?</p>
        </Screen>
      );
    }
    // handoff : c'est son tour
    return (
      <Screen center actions={<Btn size="xl" onClick={() => props.dispatch({ type: 'reveal' })}>Voir mes 3 phrases</Btn>}>
        {banner}
        {backup}
        {progress}
        <p class="kicker">À toi de faire rire</p>
        <p class="big-name gradient-text">{target}</p>
        {scores}
      </Screen>
    );
  }

  // ---- La cible
  if (me === view.targetId) {
    return (
      <Screen center>
        {banner}
        {progress}
        <p class="big-name" aria-hidden="true">
          🤐
        </p>
        <p class="big-name gradient-text">Ne ris pas !</p>
        <p class="hint">
          <strong>{joker}</strong> va essayer de te faire craquer.
        </p>
        {scores}
      </Screen>
    );
  }

  // ---- Les spectateurs
  return (
    <Screen center>
      {banner}
      {progress}
      <p class="kicker">
        {view.phase === 'performing' ? `${joker} lit sa phrase à` : `${joker} prépare un coup contre`}
      </p>
      <p class="big-name gradient-text">{target}</p>
      <p class="hint">Regarde bien {target} : craquera, craquera pas ?</p>
      {scores}
    </Screen>
  );
}
