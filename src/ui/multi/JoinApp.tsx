/**
 * Page « rejoindre » : lit le code de salle (?salle=XXXX ou saisie), vérifie la salle, affiche l'avertissement 18+
 * pour une salle No Limit, puis entre dans la partie.
 */
import '~/ui/play.css';
import { useEffect, useState } from 'preact/hooks';
import { MultiPlay } from './MultiPlay';
import { openBackend, savedRoom } from './connect';
import { normalizeRoomCode } from '~/net/roomCode';
import { MultiplayerSession } from '~/net/MultiplayerSession';
import type { RoomMeta } from '~/net/RoomBackend';
import type { GameSlug } from '~/games/meta';
import type { PackOption } from '../Setup';
import { AgeGate } from '../Setup';
import { Btn, Screen, TopBar } from '../components';
import { usePersistentState } from '../session';
import type { PlayUrls } from '../types';
import { RigololMultiView } from '~/games/rigolol/RigololMultiView';
import { MimosConfigExtra, MimosMultiView } from '~/games/mimos/MimosMultiView';
import { TakotacMultiView } from '~/games/takotac/TakotacMultiView';

const VIEWS = { rigolol: RigololMultiView, mimos: MimosMultiView, takotac: TakotacMultiView } as const;

type Step = { kind: 'code'; error?: string } | { kind: 'checking' } | { kind: 'ready'; code: string; meta: RoomMeta };

export default function JoinApp(props: { game: GameSlug; gameName: string; packs: PackOption[]; urls: PlayUrls; joinUrls: Record<string, string> }) {
  const [step, setStep] = useState<Step>({ kind: 'checking' });
  const [input, setInput] = useState('');
  const [ageOk, setAgeOk] = usePersistentState<boolean>('jds:age-ok', false);

  const check = async (raw: string) => {
    const code = normalizeRoomCode(raw);
    if (!code) return setStep({ kind: 'code', error: 'Le code fait 4 lettres.' });
    setStep({ kind: 'checking' });
    try {
      const meta = await MultiplayerSession.peek(await openBackend(), code);
      if (!meta) return setStep({ kind: 'code', error: `La salle ${code} n’existe pas ou a expiré.` });
      if (meta.game !== props.game) {
        // QR code d'un autre jeu : on redirige vers la bonne page.
        location.replace(`${props.joinUrls[meta.game]}?salle=${code}`);
        return;
      }
      history.replaceState(null, '', `?salle=${code}`);
      setStep({ kind: 'ready', code, meta });
    } catch {
      setStep({ kind: 'code', error: 'Connexion impossible. Vérifie ton réseau et réessaie.' });
    }
  };

  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get('salle');
    const saved = savedRoom.get();
    const code = fromUrl ?? (saved?.game === props.game ? saved.code : null);
    if (code) void check(code);
    else setStep({ kind: 'code' });
  }, []);

  const topBar = (o: { inGame: boolean; onQuit: () => void }) => (
    <TopBar title={props.gameName} backHref={props.urls.back} inGame={o.inGame} onQuit={o.onQuit} />
  );

  if (step.kind === 'ready') {
    if (step.meta.adult && !ageOk) {
      return (
        <div class="play">
          {topBar({ inGame: false, onQuit: () => undefined })}
          <AgeGate gameName={props.gameName} backHref={props.urls.back} onAccept={() => setAgeOk(true)} />
        </div>
      );
    }
    return (
      <MultiPlay
        game={props.game}
        gameName={props.gameName}
        adult={step.meta.adult}
        role="guest"
        code={step.code}
        packs={props.packs.filter((p) => step.meta.adult || !p.adult)}
        joinUrl={props.urls.join}
        shareUrl={props.urls.share}
        onExit={() => location.assign(props.urls.back)}
        View={VIEWS[props.game]}
        {...(props.game === 'mimos' ? { ConfigExtra: MimosConfigExtra } : {})}
        renderTopBar={topBar}
      />
    );
  }

  return (
    <div class="play">
      {topBar({ inGame: false, onQuit: () => undefined })}
      {step.kind === 'checking' ? (
        <Screen center>
          <div class="spinner" aria-hidden="true" />
          <p class="kicker" role="status">
            Recherche de la salle…
          </p>
        </Screen>
      ) : (
        <Screen
          actions={
            <Btn size="xl" disabled={input.replace(/[^a-z]/gi, '').length < 4} onClick={() => void check(input)}>
              Rejoindre
            </Btn>
          }
        >
          <h1 style="font-size: var(--fs-2xl); margin: 0">Rejoindre une partie de {props.gameName}</h1>
          <form
            class="setup-section"
            onSubmit={(e) => {
              e.preventDefault();
              void check(input);
            }}
          >
            <label for="room-code" style="font-family: var(--font-display); font-weight: 750">
              Code de la salle (4 lettres)
            </label>
            <input
              id="room-code"
              class="input room-code-input"
              autoComplete="off"
              autoCapitalize="characters"
              enterKeyHint="go"
              maxLength={4}
              value={input}
              onInput={(e) => setInput(e.currentTarget.value.toUpperCase())}
            />
            {step.error && (
              <p class="form-error" role="alert">
                {step.error}
              </p>
            )}
          </form>
          <p class="hint">Le code s’affiche sous le QR code, sur le téléphone de l’hôte.</p>
        </Screen>
      )}
    </div>
  );
}
