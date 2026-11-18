/**
 * Mimos, chacun son téléphone : le mimeur voit l'expression et pilote son passage, les autres voient le chrono
 * et devinent. Les expressions sont révélées à tous en fin de passage.
 */
import type { FunctionComponent } from 'preact';
import type { ConfigEditorProps, MultiViewProps } from '~/ui/multi/MultiPlay';
import type { MimosSecret, MimosView } from './multi';
import { CARDS_PER_PASSAGE, PASSAGE_DURATION_MS } from './engine';
import { Btn, EndScreen, Screen, ScoreStrip, Timer, rankingRows } from '~/ui/components';
import { ranking } from '../core/players';
import { play, vibrate } from '~/ui/feedback';
import { useScrollTopOn } from '~/ui/hooks';

const actionText = (t: string | undefined) => t?.replace(/^Qui /, 'qui ') ?? '';

export function MimosMultiView(props: MultiViewProps<MimosView, MimosSecret>) {
  const { view, secret, me } = props;
  useScrollTopOn(`${view.passageIndex}-${view.phase}`);
  const teams = view.mode === 'teams';
  const mime = view.players.find((p) => p.id === view.mimeId);
  const mimeTeam = mime?.team !== undefined ? `Équipe ${mime.team + 1}` : '';
  const progress = <p class="progress">Passage {Math.min(view.passageIndex + 1, view.totalPassages)} / {view.totalPassages}</p>;
  const backup = props.backupName && <p class="backup-banner">Tu joues à la place de {props.backupName} (hors ligne).</p>;
  const scores = teams ? (
    <ScoreStrip
      items={[
        { id: 't0', label: 'Équipe 1', score: view.teamScores[0] },
        { id: 't1', label: 'Équipe 2', score: view.teamScores[1] },
      ]}
    />
  ) : (
    <ScoreStrip items={ranking(view.players, view.scores).map((r) => ({ id: r.player.id, label: r.player.name, score: r.score }))} />
  );

  if (view.phase === 'finished') {
    const rows = teams
      ? [0, 1]
          .map((t) => ({
            id: `t${t}`,
            name: `Équipe ${t + 1} (${view.players.filter((p) => p.team === t).map((p) => p.name).join(', ')})`,
            score: view.teamScores[t as 0 | 1],
            rank: view.teamScores[t as 0 | 1] >= view.teamScores[t === 0 ? 1 : 0] ? 1 : 2,
          }))
          .sort((a, b) => b.score - a.score)
      : rankingRows(ranking(view.players, view.scores));
    return (
      <EndScreen
        rows={rows}
        gameName="Mimos"
        shareUrl={props.shareUrl}
        onReplay={props.isHost ? props.onReplay : undefined}
        onEdit={props.isHost ? props.onLobby : undefined}
        waitingNote="L’hôte peut relancer une partie."
      />
    );
  }
  if (!mime) return null;
  const isMime = me === mime.id;
  const myTeam = view.players.find((p) => p.id === me)?.team;
  const guessing = !teams || myTeam === mime.team;

  if (view.phase === 'handoff') {
    return isMime ? (
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
            Prêt ? C’est parti !
          </Btn>
        }
      >
        {backup}
        {progress}
        <p class="kicker">{teams ? `${mimeTeam} : à toi de mimer` : 'À toi de mimer'}</p>
        <p class="big-name gradient-text">{mime.name}</p>
        <p class="hint">
          {CARDS_PER_PASSAGE} expressions, {PASSAGE_DURATION_MS / 1000} secondes. L’expression s’affiche uniquement sur ton téléphone.
        </p>
        {scores}
      </Screen>
    ) : (
      <Screen center>
        {progress}
        <p class="kicker">{teams ? `${mimeTeam} : c’est au tour de` : 'C’est au tour de'}</p>
        <p class="big-name gradient-text">{mime.name}</p>
        <p class="hint">{guessing ? 'Prépare-toi à deviner !' : 'L’équipe adverse devine : pas un mot !'}</p>
        {scores}
      </Screen>
    );
  }

  if (view.phase === 'miming' && view.deadline !== null) {
    const timer = <Timer deadline={view.deadline - props.clockOffset} durationMs={PASSAGE_DURATION_MS} small onExpire={() => undefined} />;
    if (isMime && secret) {
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
                  props.dispatch({ type: 'skip', at: 0 });
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
                  props.dispatch({ type: 'found', at: 0 });
                }}
              >
                Trouvé !
              </Btn>
            </>
          }
        >
          {backup}
          {timer}
          <p class="progress" style="text-align: center">
            Expression {view.cardIndex + 1} / {CARDS_PER_PASSAGE}
          </p>
          <div class="card card--accent" key={view.cardIndex} style="text-align: center">
            <p class="card__text" style="font-size: clamp(1.8rem, 8vw, 2.6rem)">
              {secret.subject?.text}
              {secret.subject?.note && <span class="card__note">({secret.subject.note})</span>}
            </p>
            <p class="card__text" style="margin-top: var(--sp-3); color: var(--accent)">
              {actionText(secret.action?.text)}
            </p>
          </div>
          <p class="hint" style="text-align: center">
            Sans parler ! Passer fait perdre l’expression.
          </p>
        </Screen>
      );
    }
    return (
      <Screen center>
        {timer}
        <p class="kicker">{mime.name} mime !</p>
        <p class="big-name gradient-text">{guessing ? 'Devine !' : 'Chut…'}</p>
        <p class="progress">
          Expression {view.cardIndex + 1} / {CARDS_PER_PASSAGE} · {view.foundThisPassage} trouvée{view.foundThisPassage > 1 ? 's' : ''}
        </p>
        {scores}
      </Screen>
    );
  }

  // passageEnd
  const last = view.passageIndex + 1 >= view.totalPassages;
  return (
    <Screen
      actions={
        isMime ? (
          <Btn size="xl" onClick={() => props.dispatch({ type: 'next' })}>
            {last ? 'Voir les résultats' : 'Joueur suivant'}
          </Btn>
        ) : (
          <p class="kicker" style="text-align: center">
            {mime.name} passe la main…
          </p>
        )
      }
    >
      {backup}
      <div style="text-align: center">
        <p class="kicker">{view.endReason === 'timeout' ? 'Temps écoulé !' : 'Plus rien à faire deviner !'}</p>
        <p class="big-name gradient-text">
          +{view.foundThisPassage} point{view.foundThisPassage > 1 ? 's' : ''}
        </p>
        <p class="hint">
          {mime.name}
          {teams ? ` (${mimeTeam})` : ''}
        </p>
      </div>
      <ul class="podium">
        {view.log.map((c, i) => (
          <li key={i}>
            <span class="podium__rank" aria-label={c.found ? 'Trouvée' : 'Ratée'}>
              {c.found ? '✅' : '❌'}
            </span>
            <span class="podium__name">
              {c.subject?.text} {actionText(c.action?.text)}
            </span>
          </li>
        ))}
      </ul>
      {scores}
    </Screen>
  );
}

/** Réglages du lobby propres à Mimos : mode de jeu et équipes (l'hôte touche un joueur pour changer son équipe). */
export const MimosConfigExtra: FunctionComponent<ConfigEditorProps> = (props) => {
  const mode = (props.config['mode'] as string | undefined) ?? 'ffa';
  return (
    <div class="setup-section">
      <h2>Mode</h2>
      <div class="segmented" role="group" aria-label="Mode de jeu">
        {(['ffa', 'teams'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            disabled={!props.editable}
            onClick={() => {
              props.setConfig({ ...props.config, mode: m });
              // Répartition initiale en alternance pour les joueurs sans équipe
              if (m === 'teams') props.players.forEach((p, i) => p.team === undefined && props.setTeam(p.uid, (i % 2) as 0 | 1));
            }}
          >
            {m === 'ffa' ? 'Chacun pour soi' : 'Équipes'}
          </button>
        ))}
      </div>
      {mode === 'teams' && (
        <>
          <div class="teams">
            {([0, 1] as const).map((t) => (
              <div class="team" key={t}>
                <h3>Équipe {t + 1}</h3>
                <ul class="player-list">
                  {props.players
                    .filter((p) => (p.team ?? 0) === t)
                    .map((p) => (
                      <li key={p.uid}>
                        <button type="button" class="player-chip" style="padding: 0.4rem 0.9rem; min-height: 2.75rem; cursor: pointer; color: var(--text)" disabled={!props.editable} onClick={() => props.setTeam(p.uid, t === 0 ? 1 : 0)}>
                          {p.name}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <p class="counter">{props.editable ? 'Touche un prénom pour le changer d’équipe.' : 'L’hôte compose les équipes.'}</p>
        </>
      )}
    </div>
  );
};
