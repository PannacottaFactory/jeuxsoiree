/**
 * Joueurs, scores et classement : communs aux 3 jeux.
 */

export interface Player {
  /** Identifiant stable (survit à un renommage et, en multijoueur, à une reconnexion). */
  id: string;
  name: string;
  /** Équipe (Mimos en mode équipes uniquement). */
  team?: 0 | 1;
}

export type Scores = Record<string, number>;

export const NAME_MAX_LENGTH = 20;

export function emptyScores(players: readonly Player[]): Scores {
  return Object.fromEntries(players.map((p) => [p.id, 0]));
}

/** Normalise un pseudo saisi : espaces superflus retirés, longueur bornée. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LENGTH);
}

/**
 * Vérifie qu'un pseudo peut être ajouté. Retourne un message d'erreur à afficher, ou null.
 * Les doublons sont refusés sans tenir compte de la casse ni des accents (« Léa » = « lea »).
 */
export function nameError(name: string, existing: readonly string[]): string | null {
  const clean = cleanName(name);
  if (!clean) return 'Entre un prénom.';
  const key = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (existing.some((n) => key(n) === key(clean))) return `${clean} est déjà dans la partie.`;
  return null;
}

export interface RankingRow {
  player: Player;
  score: number;
  /** Rang avec ex æquo : 1, 1, 3… */
  rank: number;
}

/** Classement décroissant. À score égal, l'ordre de saisie est conservé et le rang est partagé. */
export function ranking(players: readonly Player[], scores: Scores): RankingRow[] {
  const rows = players
    .map((player, index) => ({ player, score: scores[player.id] ?? 0, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return rows.map((row, i) => {
    const firstSame = rows.findIndex((r) => r.score === row.score);
    return { player: row.player, score: row.score, rank: firstSame === i ? i + 1 : firstSame + 1 };
  });
}

export function playerById(players: readonly Player[], id: string): Player {
  const p = players.find((x) => x.id === id);
  if (!p) throw new Error(`Joueur inconnu : ${id}`);
  return p;
}
