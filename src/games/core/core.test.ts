import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { createDeck, drawCards } from './deck';
import { cleanName, nameError, ranking, type Player } from './players';
import { entriesForPacks } from './content';

describe('Rng', () => {
  it('est déterministe pour une même graine', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.float(), a.float(), a.int(10)]).toEqual([b.float(), b.float(), b.int(10)]);
  });
  it('mélange sans perdre ni dupliquer d’élément', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const out = new Rng(7).shuffle(items);
    expect([...out].sort((x, y) => x - y)).toEqual(items);
    expect(out).not.toEqual(items);
  });
  it('respecte approximativement la probabilité de chance()', () => {
    const rng = new Rng(1);
    let hits = 0;
    for (let i = 0; i < 10000; i++) if (rng.chance(0.41)) hits++;
    expect(hits / 10000).toBeGreaterThan(0.38);
    expect(hits / 10000).toBeLessThan(0.44);
  });
});

describe('Deck', () => {
  it('ne ressort jamais une carte tant que la pioche n’est pas épuisée', () => {
    const rng = new Rng(3);
    const ids = Array.from({ length: 30 }, (_, i) => `c${i}`);
    let deck = createDeck(ids, rng);
    const seen: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = drawCards(deck, 3, rng);
      seen.push(...r.cards);
      deck = r.deck;
    }
    expect(new Set(seen).size).toBe(30);
  });
  it('remélange les cartes déjà tirées quand la pioche est vide, sans doublon dans un tirage', () => {
    const rng = new Rng(9);
    let deck = createDeck(['a', 'b', 'c', 'd'], rng);
    deck = drawCards(deck, 3, rng).deck;
    const r = drawCards(deck, 3, rng);
    expect(r.cards).toHaveLength(3);
    expect(new Set(r.cards).size).toBe(3);
  });
});

describe('players', () => {
  it('nettoie et refuse les pseudos vides ou en double (casse et accents ignorés)', () => {
    expect(cleanName('  Léa   Dupont ')).toBe('Léa Dupont');
    expect(nameError('   ', [])).not.toBeNull();
    expect(nameError('lea', ['Léa'])).toContain('déjà');
    expect(nameError('Max', ['Léa'])).toBeNull();
  });
  it('classe avec des ex æquo', () => {
    const players: Player[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ];
    const rows = ranking(players, { a: 3, b: 5, c: 3 });
    expect(rows.map((r) => [r.player.id, r.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
    ]);
  });
});

describe('entriesForPacks', () => {
  it('garde les entrées d’au moins un pack coché', () => {
    const entries = [
      { id: '1', packs: ['tout-doux'] },
      { id: '2', packs: ['no-limit'] },
      { id: '3', packs: ['tout-doux', 'no-limit'] },
    ];
    expect(entriesForPacks(entries, ['tout-doux']).map((e) => e.id)).toEqual(['1', '3']);
    expect(entriesForPacks(entries, ['no-limit']).map((e) => e.id)).toEqual(['2', '3']);
  });
});
