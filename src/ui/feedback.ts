/**
 * Retours sensoriels : sons synthétisés (WebAudio, aucun fichier à télécharger), vibrations, coupure du son.
 * Tout est optionnel et silencieux en cas d'API indisponible.
 */
import { signal } from '@preact/signals';
import { storage } from './storage';

const MUTE_KEY = 'jds:muted';

/** Son coupé (bouton mute global, mémorisé sur l'appareil). */
export const muted = signal<boolean>(false);

export function initMute(): void {
  muted.value = storage.getJson<boolean>(MUTE_KEY) ?? false;
}

export function toggleMute(): void {
  muted.value = !muted.value;
  storage.setJson(MUTE_KEY, muted.value);
  if (!muted.value) play('tick');
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type Sound = 'tick' | 'buzzer' | 'success' | 'fail' | 'start' | 'fanfare';

/** Notes : [fréquence Hz, début s, durée s]. */
const SOUNDS: Record<Sound, { wave: OscillatorType; volume: number; notes: [number, number, number][] }> = {
  tick: { wave: 'square', volume: 0.06, notes: [[1200, 0, 0.04]] },
  start: { wave: 'triangle', volume: 0.18, notes: [[660, 0, 0.09], [990, 0.09, 0.14]] },
  success: { wave: 'triangle', volume: 0.2, notes: [[784, 0, 0.09], [1047, 0.08, 0.16]] },
  fail: { wave: 'sawtooth', volume: 0.08, notes: [[330, 0, 0.12], [247, 0.11, 0.2]] },
  buzzer: { wave: 'sawtooth', volume: 0.14, notes: [[150, 0, 0.55], [155, 0, 0.55]] },
  fanfare: {
    wave: 'triangle',
    volume: 0.18,
    notes: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.35]],
  },
};

export function play(sound: Sound): void {
  if (muted.value) return;
  const ac = audio();
  if (!ac) return;
  const { wave, volume, notes } = SOUNDS[sound];
  const now = ac.currentTime;
  for (const [freq, start, dur] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  }
}

/** Vibration (Android ; ignorée ailleurs). */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignoré */
  }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Partage du site (Web Share API), avec copie du lien en repli. Retourne ce qui s'est passé. */
export async function shareSite(data: { title: string; text: string; url: string }): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share(data);
      return 'shared';
    }
    await navigator.clipboard.writeText(`${data.text} ${data.url}`);
    return 'copied';
  } catch (e) {
    // L'utilisateur a fermé la feuille de partage : ce n'est pas une erreur.
    if (e instanceof DOMException && e.name === 'AbortError') return 'failed';
    return 'failed';
  }
}
