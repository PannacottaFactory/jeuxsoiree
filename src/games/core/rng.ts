/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 *
 * L'état du générateur (un entier 32 bits) est stocké DANS l'état de la partie : un moteur reste une fonction pure
 * (même état + même action = même résultat). C'est indispensable pour les tests et pour le multijoueur, où seul
 * l'hôte fait les tirages et publie l'état obtenu.
 */

export type RngState = number;

/** Graine aléatoire « réelle », à utiliser uniquement au lancement d'une partie (hors moteur). */
export function randomSeed(): RngState {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  }
  return Math.floor(Math.random() * 2 ** 32);
}

/**
 * Enveloppe mutable pratique à l'intérieur d'un réducteur :
 *   const rng = new Rng(state.rng); ...; return { ...state, rng: rng.state };
 */
export class Rng {
  constructor(public state: RngState) {}

  /** Nombre dans [0, 1). */
  float(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(this.state ^ (this.state >>> 15), this.state | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier dans [0, max). */
  int(max: number): number {
    return Math.floor(this.float() * max);
  }

  /** Vrai avec une probabilité p. */
  chance(p: number): boolean {
    return this.float() < p;
  }

  /** Copie mélangée (Fisher-Yates), le tableau d'origine n'est pas modifié. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}
