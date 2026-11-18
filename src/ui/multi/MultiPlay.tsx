/**
 * Conteneur du mode « chacun son téléphone », pour l'hôte comme pour les invités :
 * prénom → salle (création ou entrée) → lobby (QR code, joueurs en direct, réglages de l'hôte) → partie → fin.
 * L'affichage d'une partie est délégué à la vue du jeu (`View`).
 */
import type { ComponentChildren, FunctionComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Btn, Dialog, Screen } from '../components';
import { PackPicker, type PackOption } from '../Setup';
import { QrCode } from './QrCode';
import { adapterLoader, openBackend, savedName, savedRoom } from './connect';
import { MultiplayerSession, type LobbyPlayer, type SessionSnapshot } from '~/net/MultiplayerSession';
import { cleanName, nameError } from '~/games/core/players';
import type { GameSlug } from '~/games/meta';
import { initMute, play, shareSite } from '../feedback';
import { useWakeLock } from '../hooks';

/** Ce que reçoit la vue d'un jeu en multijoueur. */
export interface MultiViewProps<V = unknown, Sec = unknown> {
  view: V;
  secret: Sec | null;
  /** Joueur incarné par ce téléphone (l'hôte peut incarner un joueur hors ligne en secours). */
  me: string;
  /** Prénom du joueur incarné en secours, sinon null. */
  backupName: string | null;
  clockOffset: number;
  online: Record<string, boolean>;
  isHost: boolean;
  dispatch: (action: { type: string; at?: number; [k: string]: unknown }) => void;
  onReplay: () => void;
  onLobby: () => void;
  shareUrl: string;
}

export interface ConfigEditorProps {
  config: Record<string, unknown>;
  setConfig: (c: Record<string, unknown>) => void;
  players: LobbyPlayer[];
  setTeam: (uid: string, team: 0 | 1) => void;
  /** Seul l'hôte modifie les réglages ; les invités les voient en lecture seule. */
  editable: boolean;
}

interface Props {
  game: GameSlug;
  gameName: string;
  adult: boolean;
  role: 'host' | 'guest';
  /** Code de salle (invité). */
  code?: string;
  packs: PackOption[];
  /** URL absolue de la page « rejoindre » (encodée dans le QR code). */
  joinUrl: string;
  shareUrl: string;
  onExit: () => void;
  View: FunctionComponent<MultiViewProps<any, any>>;
  ConfigExtra?: FunctionComponent<ConfigEditorProps>;
  /** Barre du haut, fournie par l'application (titre, son, quitter). */
  renderTopBar: (opts: { inGame: boolean; onQuit: () => void }) => ComponentChildren;
}

type Phase = { kind: 'name' } | { kind: 'connecting'; label: string } | { kind: 'error'; message: string } | { kind: 'session' };

export function MultiPlay(props: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'connecting', label: 'Connexion…' });
  const [session, setSession] = useState<MultiplayerSession | null>(null);
  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [name, setName] = useState('');

  useEffect(() => initMute(), []);

  // Reconnexion automatique à la dernière salle de ce jeu (rafraîchissement, mise en veille).
  useEffect(() => {
    setName(savedName.get());
    const saved = savedRoom.get();
    const matches = saved && saved.game === props.game && saved.adult === props.adult && (props.role === 'host' || saved.code === props.code);
    if (!matches || !savedName.get()) {
      setPhase({ kind: 'name' });
      return;
    }
    void (async () => {
      try {
        setPhase({ kind: 'connecting', label: `Retour dans la salle ${saved.code}…` });
        const backend = await openBackend();
        const meta = await MultiplayerSession.peek(backend, saved.code);
        if (!meta) throw new Error('expirée');
        attach(await MultiplayerSession.join(backend, adapterLoader(props.game, props.adult), saved.code, savedName.get()));
      } catch {
        savedRoom.clear();
        setPhase({ kind: 'name' });
      }
    })();
  }, []);

  useEffect(() => () => session?.close(), [session]);

  function attach(s: MultiplayerSession) {
    setSession(s);
    setSnap(s.getSnapshot());
    s.subscribe(setSnap);
    savedRoom.set({ code: s.code, game: props.game, adult: props.adult });
    setPhase({ kind: 'session' });
  }

  async function submitName() {
    const clean = cleanName(name);
    const err = nameError(clean, []);
    if (err) return setPhase({ kind: 'error', message: err });
    savedName.set(clean);
    try {
      setPhase({ kind: 'connecting', label: props.role === 'host' ? 'Création de la salle…' : 'Connexion à la salle…' });
      const backend = await openBackend();
      const loader = adapterLoader(props.game, props.adult);
      if (props.role === 'host') {
        attach(await MultiplayerSession.create(backend, loader, { game: props.game, adult: props.adult, name: clean }));
      } else {
        const s = await MultiplayerSession.join(backend, loader, props.code!, clean);
        attach(s);
      }
      play('start');
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error && e.message.includes('salle') ? e.message : 'Connexion impossible. Vérifie ton réseau et réessaie.' });
    }
  }

  async function quit() {
    savedRoom.clear();
    await session?.leave();
    setSession(null);
    props.onExit();
  }

  useWakeLock(phase.kind === 'session');

  let body: ComponentChildren;
  if (phase.kind === 'connecting') {
    body = (
      <Screen center>
        <div class="spinner" aria-hidden="true" />
        <p class="kicker" role="status">
          {phase.label}
        </p>
      </Screen>
    );
  } else if (phase.kind === 'name' || phase.kind === 'error') {
    body = (
      <Screen
        actions={
          <Btn size="xl" disabled={!name.trim()} onClick={() => void submitName()}>
            {props.role === 'host' ? 'Créer la salle' : 'Rejoindre la partie'}
          </Btn>
        }
      >
        <h1 style="font-size: var(--fs-2xl); margin: 0">
          {props.role === 'host' ? `Nouvelle salle ${props.gameName}` : `Rejoindre ${props.gameName}`}
        </h1>
        {props.role === 'guest' && props.code && <p class="hint">Salle {props.code}</p>}
        <form
          class="setup-section"
          onSubmit={(e) => {
            e.preventDefault();
            void submitName();
          }}
        >
          <label for="my-name" style="font-family: var(--font-display); font-weight: 750">
            Ton prénom
          </label>
          <input
            id="my-name"
            class="input"
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="go"
            maxLength={20}
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          {phase.kind === 'error' && (
            <p class="form-error" role="alert">
              {phase.message}
            </p>
          )}
        </form>
      </Screen>
    );
  } else if (session && snap) {
    body = <SessionBody {...props} session={session} snap={snap} onQuit={() => void quit()} />;
  }

  return (
    <div class="play">
      {props.renderTopBar({ inGame: phase.kind === 'session', onQuit: () => void quit() })}
      {body}
    </div>
  );
}

function SessionBody(props: Props & { session: MultiplayerSession; snap: SessionSnapshot; onQuit: () => void }) {
  const { session, snap } = props;

  if (snap.status === 'closed') {
    return (
      <Screen center actions={<Btn onClick={props.onQuit}>Retour</Btn>}>
        <p class="big-name" aria-hidden="true">
          👋
        </p>
        <p class="kicker">{snap.error ?? 'La partie est terminée.'}</p>
      </Screen>
    );
  }

  const online = Object.fromEntries(snap.players.map((p) => [p.uid, p.online]));
  const inRoster = snap.view && (snap.view as { players?: { id: string }[] }).players?.some((p) => p.id === snap.me);

  if ((snap.status === 'playing' || snap.status === 'finished') && snap.view) {
    if (!inRoster && !snap.isHost) {
      return (
        <Screen center>
          <p class="kicker">Une partie est en cours.</p>
          <p class="hint">Tu joueras à la prochaine ! Reste dans la salle.</p>
        </Screen>
      );
    }
    const backup = session.backup();
    const backupName = backup ? (snap.players.find((p) => p.uid === backup.uid)?.name ?? null) : null;
    return (
      <props.View
        view={snap.view}
        secret={backup ? backup.secret : snap.secret}
        me={backup ? backup.uid : snap.me}
        backupName={backupName}
        clockOffset={snap.clockOffset}
        online={online}
        isHost={snap.isHost}
        dispatch={(a) => session.dispatch(a)}
        onReplay={() => {
          const err = session.start();
          if (err) void session.backToLobby();
        }}
        onLobby={() => void session.backToLobby()}
        shareUrl={props.shareUrl}
      />
    );
  }

  return <Lobby {...props} />;
}

function Lobby(props: Props & { session: MultiplayerSession; snap: SessionSnapshot }) {
  const { session, snap } = props;
  const [kick, setKick] = useState<LobbyPlayer | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const joinLink = `${props.joinUrl}?salle=${snap.code}`;
  const config = (snap.config ?? {}) as Record<string, unknown>;
  const host = snap.players.find((p) => p.isHost);
  const blocker = snap.isHost ? session.startBlocker() : null;
  const packs = (config['packs'] as string[] | undefined) ?? [];

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const share = async () => {
    const r = await shareSite({ title: `${props.gameName} | Jeux de soirée`, text: `Rejoins ma partie de ${props.gameName} (salle ${snap.code}) :`, url: joinLink });
    if (r === 'copied') setToast('Lien copié !');
  };

  return (
    <Screen
      actions={
        snap.isHost ? (
          <>
            {(blocker || startError) && (
              <p class="counter" style="text-align: center" role="status">
                {startError ?? blocker}
              </p>
            )}
            <Btn
              size="xl"
              disabled={!!blocker}
              onClick={() => {
                const err = session.start();
                setStartError(err);
                if (!err) play('start');
              }}
            >
              Lancer la partie
            </Btn>
          </>
        ) : (
          <p class="kicker" style="text-align: center" role="status">
            En attente que {host?.name ?? 'l’hôte'} lance la partie…
          </p>
        )
      }
    >
      <div class="lobby-code">
        <QrCode value={joinLink} label={`QR code pour rejoindre la salle ${snap.code}`} />
        <p class="kicker">Scannez pour rejoindre, ou code</p>
        <p class="room-code" aria-label={`Code de la salle : ${snap.code.split('').join(' ')}`}>
          {snap.code}
        </p>
        <Btn variant="ghost" size="sm" onClick={() => void share()}>
          Partager le lien
        </Btn>
      </div>

      <div class="setup-section">
        <h2>
          Joueurs ({snap.players.filter((p) => p.online).length})
        </h2>
        <ul class="lobby-players" aria-live="polite">
          {snap.players.map((p) => (
            <li key={p.uid} class={p.online ? '' : 'is-offline'}>
              <span class={`dot ${p.online ? 'dot--on' : ''}`} aria-label={p.online ? 'en ligne' : 'hors ligne'} />
              <span class="lobby-players__name">
                {p.name}
                {p.uid === snap.me && ' (toi)'}
              </span>
              {p.isHost && <span class="tag">Hôte</span>}
              {snap.isHost && !p.isHost && (
                <button type="button" class="icon-btn icon-btn--sm" aria-label={`Retirer ${p.name}`} onClick={() => setKick(p)}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {props.ConfigExtra && (
        <props.ConfigExtra
          config={config}
          setConfig={(c) => void session.setConfig(c)}
          players={snap.players.filter((p) => p.online)}
          editable={snap.isHost}
          setTeam={(uid, team) => (snap.isHost ? void session.setTeam(uid, team) : undefined)}
        />
      )}

      {snap.isHost ? (
        <PackPicker packs={props.packs} selected={packs} onChange={(ids) => void session.setConfig({ ...config, packs: ids })} />
      ) : (
        <p class="hint">
          Packs : {props.packs.filter((p) => packs.includes(p.id)).map((p) => p.label).join(', ') || '—'}
        </p>
      )}

      {kick && (
        <Dialog
          title={`Retirer ${kick.name} ?`}
          text="Ce joueur sera sorti de la salle."
          confirmLabel="Retirer"
          onConfirm={() => {
            void session.kick(kick.uid);
            setKick(null);
          }}
          onCancel={() => setKick(null)}
        />
      )}
      {toast && (
        <p class="toast" role="status">
          {toast}
        </p>
      )}
    </Screen>
  );
}
