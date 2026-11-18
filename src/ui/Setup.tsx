/**
 * Préparation d'une partie, commune aux 3 jeux : joueurs (avec équipes pour Mimos), packs, reprise de partie.
 */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Btn, Screen } from './components';
import { cleanName, nameError, type Player } from '~/games/core/players';

export interface PackOption {
  id: string;
  label: string;
  description: string;
  adult: boolean;
  count: string;
}

export function newPlayerId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------ Joueurs */

function PlayerChip(props: { player: Player; onRemove: () => void; onClick?: () => void }) {
  return (
    <li class="player-chip">
      {props.onClick ? (
        <span role="button" tabIndex={0} onClick={props.onClick} onKeyDown={(e) => e.key === 'Enter' && props.onClick?.()} title="Changer d’équipe">
          {props.player.name}
        </span>
      ) : (
        props.player.name
      )}
      <button type="button" aria-label={`Retirer ${props.player.name}`} onClick={props.onRemove}>
        ✕
      </button>
    </li>
  );
}

export function PlayersEditor(props: {
  players: Player[];
  onChange: (players: Player[]) => void;
  max: number;
  /** Mode équipes : un bouton d'ajout par équipe, et un appui sur un prénom le change d'équipe. */
  teams?: { maxPerTeam: number };
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { players, onChange, teams } = props;

  const add = (team?: 0 | 1) => {
    const err = nameError(
      name,
      players.map((p) => p.name),
    );
    if (err) return setError(err);
    if (!teams && players.length >= props.max) return setError(`${props.max} joueurs maximum.`);
    if (teams && team !== undefined && players.filter((p) => p.team === team).length >= teams.maxPerTeam) {
      return setError(`${teams.maxPerTeam} joueurs maximum par équipe.`);
    }
    const player: Player = { id: newPlayerId(), name: cleanName(name) };
    if (teams) player.team = team ?? 0;
    onChange([...players, player]);
    setName('');
    setError(null);
  };

  const remove = (id: string) => onChange(players.filter((p) => p.id !== id));
  const switchTeam = (id: string) =>
    onChange(players.map((p) => (p.id === id ? { ...p, team: p.team === 0 ? 1 : 0 } : p)));

  // En mode équipes, « Entrée » ajoute dans l'équipe la moins remplie.
  const smallestTeam = (): 0 | 1 =>
    players.filter((p) => p.team === 0).length <= players.filter((p) => p.team === 1).length ? 0 : 1;

  return (
    <div class="setup-section">
      <h2>Joueurs</h2>
      <form
        class="field-row"
        onSubmit={(e) => {
          e.preventDefault();
          add(teams ? smallestTeam() : undefined);
        }}
      >
        <label class="visually-hidden" for="player-name">
          Prénom du joueur
        </label>
        <input
          id="player-name"
          class="input"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          maxLength={20}
          placeholder="Prénom"
          value={name}
          onInput={(e) => {
            setName(e.currentTarget.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'player-error' : undefined}
        />
        {!teams && (
          <Btn type="submit" size="sm" disabled={!name.trim()}>
            Ajouter
          </Btn>
        )}
      </form>
      {teams && (
        <div class="screen__actions--row" style="display: flex; gap: var(--sp-2)">
          <Btn variant="ghost" size="sm" style="flex: 1" disabled={!name.trim()} onClick={() => add(0)}>
            + Équipe 1
          </Btn>
          <Btn variant="ghost" size="sm" style="flex: 1" disabled={!name.trim()} onClick={() => add(1)}>
            + Équipe 2
          </Btn>
        </div>
      )}
      {error && (
        <p id="player-error" class="form-error" role="alert">
          {error}
        </p>
      )}

      {teams ? (
        <>
          <div class="teams">
            {([0, 1] as const).map((t) => (
              <div class="team" key={t}>
                <h3>
                  Équipe {t + 1} ({players.filter((p) => p.team === t).length}/{teams.maxPerTeam})
                </h3>
                <ul class="player-list">
                  {players
                    .filter((p) => p.team === t)
                    .map((p) => (
                      <PlayerChip key={p.id} player={p} onRemove={() => remove(p.id)} onClick={() => switchTeam(p.id)} />
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <p class="counter">Touche un prénom pour le changer d’équipe.</p>
        </>
      ) : (
        <>
          <ul class="player-list" aria-live="polite">
            {players.map((p) => (
              <PlayerChip key={p.id} player={p} onRemove={() => remove(p.id)} />
            ))}
          </ul>
          <p class="counter">
            {players.length} / {props.max} joueurs
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Packs */

export function PackPicker(props: { packs: PackOption[]; selected: string[]; onChange: (ids: string[]) => void; adultHref?: string }) {
  const toggle = (id: string) =>
    props.onChange(props.selected.includes(id) ? props.selected.filter((p) => p !== id) : [...props.selected, id]);
  return (
    <div class="setup-section">
      <h2>Packs</h2>
      <ul class="packs-picker">
        {props.packs.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              class={`pack-toggle ${p.adult ? 'pack-toggle--adult' : ''}`}
              aria-pressed={props.selected.includes(p.id)}
              onClick={() => toggle(p.id)}
            >
              <span class="pack-toggle__check" aria-hidden="true">
                {props.selected.includes(p.id) ? '✓' : ''}
              </span>
              <span>
                <span class="pack-toggle__label">
                  {p.label}
                  {p.adult && <span class="badge-18">18+</span>}
                </span>
                <span class="pack-toggle__desc">
                  {p.description} · {p.count}
                </span>
              </span>
            </button>
          </li>
        ))}
        {props.adultHref && (
          <li>
            <a class="pack-toggle pack-toggle--adult" href={props.adultHref}>
              <span class="pack-toggle__check" aria-hidden="true">
                →
              </span>
              <span>
                <span class="pack-toggle__label">
                  Mode No Limit<span class="badge-18">18+</span>
                </span>
                <span class="pack-toggle__desc">Humour trash et sans filtre, réservé aux adultes.</span>
              </span>
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ Écran complet */

export function SetupScreen(props: {
  title: string;
  children: ComponentChildren;
  /** Raison pour laquelle on ne peut pas lancer la partie, ou null. */
  blocker: string | null;
  onStart: () => void;
  resume?: { onResume: () => void; onDiscard: () => void } | null;
}) {
  return (
    <Screen
      actions={
        <>
          {props.blocker && (
            <p class="counter" style="text-align: center" role="status">
              {props.blocker}
            </p>
          )}
          <Btn size="xl" disabled={!!props.blocker} onClick={props.onStart}>
            Lancer la partie
          </Btn>
        </>
      }
    >
      {props.resume && (
        <div class="resume" role="region" aria-label="Partie en cours">
          <p>Une partie est en cours sur ce téléphone.</p>
          <div style="display: flex; gap: var(--sp-2)">
            <Btn size="sm" style="flex: 1" onClick={props.resume.onResume}>
              Reprendre
            </Btn>
            <Btn size="sm" variant="ghost" style="flex: 1" onClick={props.resume.onDiscard}>
              Abandonner
            </Btn>
          </div>
        </div>
      )}
      <h1 style="font-size: var(--fs-2xl); margin: 0">{props.title}</h1>
      {props.children}
    </Screen>
  );
}

/* ------------------------------------------------------------------ Avertissement 18+ */

export function AgeGate(props: { gameName: string; backHref: string; onAccept: () => void }) {
  return (
    <Screen
      center
      actions={
        <>
          <Btn size="xl" onClick={props.onAccept}>
            J’ai 18 ans ou plus
          </Btn>
          <a class="pbtn pbtn--ghost" href={props.backHref}>
            Retour au mode tout public
          </a>
        </>
      }
    >
      <p class="big-name" aria-hidden="true">
        🔞
      </p>
      <h1 style="font-size: var(--fs-2xl); margin: 0">{props.gameName} No Limit</h1>
      <p class="hint">
        Ce mode contient de l’humour trash : sexe, drogue, humour noir et contenus pouvant choquer. Il est réservé aux
        adultes consentants.
      </p>
    </Screen>
  );
}

