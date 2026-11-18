/**
 * Hooks Preact partagés par les écrans de jeu.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameTransport } from '~/net/GameTransport';

/** État courant d'un transport, mis à jour à chaque changement. */
export function useTransportState<S, A>(transport: GameTransport<S, A>): S {
  const [state, setState] = useState(() => transport.getState());
  useEffect(() => {
    setState(transport.getState());
    return transport.subscribe(setState);
  }, [transport]);
  return state;
}

/**
 * Garde l'écran allumé pendant la partie (Screen Wake Lock API).
 * Le verrou saute quand l'onglet passe en arrière-plan : on le redemande au retour.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
      } catch {
        /* refus (batterie faible, onglet caché…) : sans gravité */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

/** Heure courante rafraîchie régulièrement (pour les chronos). */
export function useNow(active: boolean, intervalMs = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

/** Valeur précédente d'une variable (pour déclencher des effets sur changement). */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

/** Remonte en haut de l'écran à chaque changement de clé (nouvel écran de jeu). */
export function useScrollTopOn(key: unknown): void {
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }, [key]);
}
