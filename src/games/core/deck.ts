/**
 * Pioche sans remise (décision du 2026-11-18) : un contenu ne ressort pas pendant une partie.
 *
 * Filet de sécurité : si la pioche est vide (pack minuscule, partie très longue), les cartes déjà tirées sont
 * remélangées. Avec les volumes actuels (plus de 150 entrées par pack), cela n'arrive pas en pratique.
 */
import type { Rng } from './rng';

export interface Deck {
  /** Identifiants restant à tirer, dans l'ordre de tirage. */
  pile: string[];
  /** Identifiants déjà tirés. */
  used: string[];
}

export function createDeck(ids: readonly string[], rng: Rng): Deck {
  if (ids.length === 0) throw new Error('Impossible de créer une pioche vide');
  return { pile: rng.shuffle([...new Set(ids)]), used: [] };
}

/** Tire `count` cartes distinctes. Retourne les cartes et la nouvelle pioche (l'ancienne n'est pas modifiée). */
export function drawCards(deck: Deck, count: number, rng: Rng): { cards: string[]; deck: Deck } {
  let pile = [...deck.pile];
  let used = [...deck.used];
  const cards: string[] = [];
  while (cards.length < count) {
    if (pile.length === 0) {
      // Remélange de ce qui a déjà servi, sans reprendre les cartes du tirage en cours.
      const recyclable = used.filter((id) => !cards.includes(id));
      if (recyclable.length === 0) break;
      pile = rng.shuffle(recyclable);
      used = used.filter((id) => cards.includes(id));
    }
    const card = pile.shift()!;
    cards.push(card);
    used.push(card);
  }
  return { cards, deck: { pile, used } };
}

export function drawOne(deck: Deck, rng: Rng): { card: string; deck: Deck } {
  const { cards, deck: next } = drawCards(deck, 1, rng);
  const card = cards[0];
  if (card === undefined) throw new Error('Pioche vide');
  return { card, deck: next };
}
