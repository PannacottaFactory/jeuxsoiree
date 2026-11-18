import { beforeEach, describe, expect, it } from 'vitest';
import { LocalTransport } from './LocalTransport';

// localStorage minimal pour l'environnement Node de Vitest.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

type S = { n: number };
type A = { type: 'inc' } | { type: 'noop' };
const reducer = (s: S, a: A): S => (a.type === 'inc' ? { n: s.n + 1 } : s);

describe('LocalTransport', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  });

  it('applique les actions et notifie les abonnés', () => {
    const t = new LocalTransport(reducer, { n: 0 });
    const seen: number[] = [];
    t.subscribe((s) => seen.push(s.n));
    t.dispatch({ type: 'inc' });
    t.dispatch({ type: 'inc' });
    expect(t.getState().n).toBe(2);
    expect(seen).toEqual([1, 2]);
  });

  it('ne notifie pas quand le moteur ignore une action', () => {
    const t = new LocalTransport(reducer, { n: 0 });
    let calls = 0;
    t.subscribe(() => calls++);
    t.dispatch({ type: 'noop' });
    expect(calls).toBe(0);
  });

  it('sauvegarde la partie et permet de la reprendre, puis de l’oublier', () => {
    const t = new LocalTransport(reducer, { n: 0 }, 'save-test');
    t.dispatch({ type: 'inc' });
    expect(LocalTransport.loadSaved<S>('save-test')).toEqual({ n: 1 });
    t.close({ forget: true });
    expect(LocalTransport.loadSaved<S>('save-test')).toBeNull();
  });
});
