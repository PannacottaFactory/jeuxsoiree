/**
 * Métadonnées des 3 jeux : source unique pour la navigation, les pages SEO, le JSON-LD et les images OG.
 * Les règles décrites ici reprennent docs/gameplay-*.md et docs/decisions.md : ne rien y inventer.
 */

export type GameSlug = 'rigolol' | 'mimos' | 'takotac';

/**
 * Fonctionnalités disponibles : les pages adaptent leurs textes pour ne jamais promettre ce qui n'existe pas encore.
 * Phase 3 → play: true ; phase 4 → multiplayer: true.
 */
export const FEATURES = {
  play: false,
  multiplayer: false,
} as const;

export interface PackInfo {
  id: string;
  label: string;
  adult: boolean;
  description: string;
}

export interface GameMeta {
  slug: GameSlug;
  name: string;
  /** Sous-titre court, affiché sous le nom. */
  tagline: string;
  /** Une phrase qui résume le jeu. */
  pitch: string;
  players: { min: number; max: number; label: string };
  duration: string;
  packs: PackInfo[];
  seo: { title: string; description: string; rulesTitle: string; rulesDescription: string };
}

export const GAMES: Record<GameSlug, GameMeta> = {
  rigolol: {
    slug: 'rigolol',
    name: 'Rigolol',
    tagline: 'Essaye de ne pas rire',
    pitch: 'Lis une phrase à un ami en le regardant droit dans les yeux. S’il rit, tu marques gros.',
    players: { min: 2, max: 6, label: '2 à 6 joueurs' },
    duration: '10 à 20 min',
    packs: [
      { id: 'tout-doux', label: 'Tout doux', adult: false, description: 'Blagues, jeux de mots et devinettes pour tout le monde.' },
      { id: 'films', label: 'Films', adult: false, description: 'Des répliques cultes de films et de séries.' },
      { id: 'no-limit', label: 'No Limit', adult: true, description: 'Humour noir, trash et sans filtre. Réservé aux adultes.' },
    ],
    seo: {
      title: 'Rigolol : le jeu « Essaye de ne pas rire » entre amis',
      description:
        'Jeu « Essaye de ne pas rire » gratuit sur téléphone : lis une blague à un ami, s’il rit tu marques. Plus de 850 phrases, de 2 à 6 joueurs, sans appli.',
      rulesTitle: 'Règles de Rigolol, le jeu « Essaye de ne pas rire »',
      rulesDescription:
        'Toutes les règles de Rigolol : déroulé d’un tour, choix de la phrase, points, nombre de manches selon le nombre de joueurs et packs de phrases.',
    },
  },
  mimos: {
    slug: 'mimos',
    name: 'Mimos',
    tagline: 'Le jeu des mimes',
    pitch: 'Mime « un dentiste qui marche sur un Lego » sans un mot. 60 secondes, 5 expressions, à toi de jouer.',
    players: { min: 2, max: 8, label: '2 à 8 joueurs' },
    duration: '10 à 20 min',
    packs: [
      { id: 'tout-doux', label: 'Tout doux', adult: false, description: 'Métiers, animaux, sports et actions du quotidien.' },
      { id: 'celebrites', label: 'Célébrités', adult: false, description: 'Des personnages réels et fictifs à combiner avec les actions.' },
      { id: 'no-limit', label: 'No Limit', adult: true, description: 'Des expressions osées et sans tabou. Réservé aux adultes.' },
    ],
    seo: {
      title: 'Mimos : jeu de mime en ligne gratuit pour vos soirées',
      description:
        'Mime « un dentiste qui marche sur un Lego » en 60 secondes ! Jeu de mime gratuit sur téléphone, chacun pour soi ou en équipes, de 2 à 8 joueurs.',
      rulesTitle: 'Règles de Mimos, le jeu de mime pour soirée',
      rulesDescription:
        'Toutes les règles de Mimos : mode chacun pour soi ou en équipes, chrono de 60 secondes, 5 expressions par passage, points et packs.',
    },
  },
  takotac: {
    slug: 'takotac',
    name: 'Takotac',
    tagline: 'Réponds vite, tant pis si ça dérape !',
    pitch: 'Cite 3 trucs oranges en 7 secondes. Sous la pression, on dit souvent n’importe quoi… et c’est tout l’intérêt.',
    players: { min: 2, max: 8, label: '2 à 8 joueurs' },
    duration: '5 à 15 min',
    packs: [
      { id: 'tout-doux', label: 'Tout doux', adult: false, description: 'Des catégories du quotidien, faciles à lancer.' },
      { id: 'culture-g', label: 'Culture G', adult: false, description: 'Cinéma, histoire, sciences, géographie, musique…' },
      { id: 'no-limit', label: 'No Limit', adult: true, description: 'Des catégories qui piquent. Réservé aux adultes.' },
    ],
    seo: {
      title: 'Takotac : jeu de rapidité pour soirée, cite 3 trucs en 7 s',
      description:
        'Cite 3 trucs oranges en 7 secondes… pas si facile sous la pression ! Jeu de rapidité gratuit sur téléphone pour l’apéro, de 2 à 8 joueurs, sans appli.',
      rulesTitle: 'Règles de Takotac, le jeu de rapidité pour soirée',
      rulesDescription:
        'Toutes les règles de Takotac : 7 secondes pour citer 3 ou 4 réponses, points, tours en coopération, nombre de manches et packs.',
    },
  },
};

export const GAME_LIST: GameMeta[] = [GAMES.rigolol, GAMES.mimos, GAMES.takotac];

export const SITE = {
  name: 'Jeux de soirée',
  publisher: 'Pannacotta Factory',
  locale: 'fr_FR',
  title: 'Jeux de soirée entre amis, gratuits sur téléphone',
  description:
    'Rigolol, Mimos et Takotac : 3 jeux d’apéro gratuits pour rire entre amis, directement dans le navigateur de ton téléphone. Sans appli, sans inscription.',
} as const;
