import { describe, expect, it } from 'vitest';
import { getValidatedContent } from './validate';
import { roundDown } from './stats';

// Normalisation identique à celle du script d'extraction, pour vérifier l'absence de doublons.
const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

describe('contenus des jeux', () => {
  const content = getValidatedContent();

  it('valide les 3 jeux avec leur schéma', () => {
    expect(content.rigolol.phrases.length).toBeGreaterThan(800);
    expect(content.mimos.subjects.length).toBeGreaterThan(500);
    expect(content.mimos.actions.length).toBeGreaterThan(500);
    expect(content.takotac.categories.length).toBeGreaterThan(700);
  });

  it('chaque pack contient des entrées', () => {
    for (const p of content.rigolol.packs) expect(content.rigolol.phrases.some((e) => e.packs.includes(p.id))).toBe(true);
    for (const p of content.takotac.packs) expect(content.takotac.categories.some((e) => e.packs.includes(p.id))).toBe(true);
    for (const p of content.mimos.packs) expect(content.mimos.subjects.some((e) => e.packs.includes(p.id))).toBe(true);
  });

  it("le pack Célébrités n'apporte que des sujets (décision 2026-11-18)", () => {
    expect(content.mimos.actions.some((e) => e.packs.includes('celebrites'))).toBe(false);
  });

  it('toutes les entrées des packs No Limit seuls sont classées adulte', () => {
    const lists = [content.rigolol.phrases, content.mimos.subjects, content.mimos.actions, content.takotac.categories];
    for (const list of lists) {
      for (const e of list) if (e.packs.every((p) => p === 'no-limit')) expect(e.audience).toBe('adulte');
    }
  });

  it('aucun doublon de texte au sein d’une même liste', () => {
    const lists = [content.rigolol.phrases, content.mimos.subjects, content.mimos.actions, content.takotac.categories];
    for (const list of lists) {
      const keys = list.map((e) => norm(e.text + (e.note ?? '')));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('chaque pack tout public garde assez de contenu tout public pour jouer', () => {
    const tp = (list: { packs: string[]; audience: string }[], pack: string) =>
      list.filter((e) => e.packs.includes(pack) && e.audience === 'tout_public').length;
    expect(tp(content.rigolol.phrases, 'tout-doux')).toBeGreaterThan(300);
    expect(tp(content.rigolol.phrases, 'films')).toBeGreaterThan(150);
    expect(tp(content.mimos.actions, 'tout-doux')).toBeGreaterThan(300);
    expect(tp(content.takotac.categories, 'culture-g')).toBeGreaterThan(150);
  });
});

describe('roundDown', () => {
  it('arrondit vers le bas pour les formulations « plus de N »', () => {
    expect(roundDown(897)).toBe(850);
    expect(roundDown(533)).toBe(500);
    expect(roundDown(155)).toBe(150);
    expect(roundDown(42)).toBe(40);
  });
});
