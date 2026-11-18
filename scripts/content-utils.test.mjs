import { describe, expect, it } from 'vitest';
import { classify, normalizeKey, splitNote, stableId } from './content-utils.mjs';

describe('splitNote', () => {
  it('sépare une précision finale entre parenthèses', () => {
    expect(splitNote('Partons à Toulouse. (contrepèterie)')).toEqual({ text: 'Partons à Toulouse.', note: 'contrepèterie' });
    expect(splitNote('Pongo (101 Dalmatiens)')).toEqual({ text: 'Pongo', note: '101 Dalmatiens' });
  });
  it('ne coupe pas les marques de genre ni les parenthèses internes', () => {
    expect(splitNote("T'es content(e) ?")).toEqual({ text: "T'es content(e) ?" });
    expect(splitNote('Que fait un poussin ? (Crier fort) : PIOU !')).toEqual({ text: 'Que fait un poussin ? (Crier fort) : PIOU !' });
  });
});

describe('normalizeKey', () => {
  it('unifie casse, apostrophes et ponctuation finale', () => {
    expect(normalizeKey('Qui cherche ses clés ')).toBe(normalizeKey('qui cherche ses clés.'));
    expect(normalizeKey('L’ami du feu')).toBe(normalizeKey("l'ami du feu"));
  });
});

describe('stableId', () => {
  it('est déterministe et préfixé', () => {
    const a = stableId('r', 'phrases', 'abc');
    expect(a).toMatch(/^rp-[0-9a-z]{7}$/);
    expect(stableId('r', 'phrases', 'abc')).toBe(a);
    expect(stableId('r', 'phrases', 'abd')).not.toBe(a);
  });
});

describe('classify', () => {
  it('classe les contrepèteries en adulte', () => {
    expect(classify('Partons à Toulouse.', 'contrepèterie').audience).toBe('adulte');
  });
  it('détecte les thèmes adultes avec des limites de mot accentuées', () => {
    expect(classify('Pas commencer à jouer avec mes couilles').audience).toBe('adulte');
    expect(classify('Rechercher un nazi').reason).toBe('haine');
  });
  it('évite les faux positifs connus', () => {
    expect(classify('Un violoniste').reason).toBe('aucun');
    expect(classify('Qui envoie un baiser').reason).toBe('aucun');
    expect(classify("Qu'est-ce qu'un bonbon avec une béquille ? Une sucette.").reason).toBe('aucun');
    expect(classify('Un cul de jatte').reason).toBe('aucun');
  });
  it('laisse les vulgarités légères en tout public', () => {
    expect(classify('Ça va chier dans le ventilo.')).toEqual({ audience: 'tout_public', reason: 'vulgaire (laissé tout public)' });
  });
});
