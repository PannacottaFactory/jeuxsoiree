/**
 * Cycle de vie d'une partie en mode « un seul téléphone » : préparation mémorisée, lancement, reprise après
 * rafraîchissement, abandon. Commun aux 3 jeux.
 */
import { useCallback, useEffect, useState } from 'preact/hooks';
import { LocalTransport } from '~/net/LocalTransport';
import type { Reducer } from '~/net/GameTransport';
import { storage } from './storage';
import { initMute } from './feedback';

/** État persistant sur l'appareil (préparation de partie, consentement 18+…). Chargé après le montage (SSR-safe). */
export function usePersistentState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const stored = storage.getJson<T>(key);
    if (stored !== null) setValue(stored);
  }, [key]);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      storage.setJson(key, v);
    },
    [key],
  );
  return [value, set];
}

export function useGameSession<S extends { phase: string }, A>(saveKey: string, reducer: Reducer<S, A>) {
  const [transport, setTransport] = useState<LocalTransport<S, A> | null>(null);
  const [saved, setSaved] = useState<S | null>(null);
  const [phase, setPhase] = useState<string | null>(null);

  // Suit la phase pour savoir si une partie est en cours (la barre du haut propose alors « Quitter »).
  useEffect(() => {
    if (!transport) return setPhase(null);
    setPhase(transport.getState().phase);
    return transport.subscribe((s) => setPhase(s.phase));
  }, [transport]);

  useEffect(() => {
    initMute();
    const s = LocalTransport.loadSaved<S>(saveKey);
    // Une partie terminée n'est pas proposée à la reprise.
    setSaved(s && s.phase !== 'finished' ? s : null);
  }, [saveKey]);

  const start = useCallback(
    (initial: S) => {
      transport?.close();
      setTransport(new LocalTransport(reducer, initial, saveKey));
      setSaved(null);
    },
    [transport, reducer, saveKey],
  );

  const resume = useCallback(() => saved && start(saved), [saved, start]);

  const discard = useCallback(() => {
    LocalTransport.forget(saveKey);
    setSaved(null);
  }, [saveKey]);

  /** Quitte la partie en cours (retour à la préparation) et oublie la sauvegarde. */
  const quit = useCallback(() => {
    transport?.close({ forget: true });
    setTransport(null);
  }, [transport]);

  /** Vrai pendant une partie non terminée. */
  const inProgress = !!transport && phase !== null && phase !== 'finished';

  return { transport, saved, start, resume, discard, quit, inProgress };
}
