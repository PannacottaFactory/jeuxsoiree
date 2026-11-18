/**
 * Générateurs de données structurées schema.org (JSON-LD).
 * Rendu dans <head> par le composant Seo.astro.
 */
import { SITE, type GameMeta } from '~/games/meta';

export type JsonLd = Record<string, unknown>;

export interface Crumb {
  name: string;
  url: string;
}

export interface FaqItem {
  question: string;
  /** Réponse en texte brut (pas de HTML) : sert à la fois au rendu et au JSON-LD. */
  answer: string;
}

const publisher = { '@type': 'Organization', name: SITE.publisher };

export function websiteLd(url: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url,
    inLanguage: 'fr',
    description: SITE.description,
    publisher,
  };
}

export function gameLd(game: GameMeta, url: string, image: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': ['VideoGame', 'WebApplication'],
    name: game.name,
    alternateName: game.tagline,
    description: game.seo.description,
    url,
    image,
    inLanguage: 'fr',
    genre: ['Jeu de soirée', 'Party game'],
    gamePlatform: 'Navigateur web',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Tous (navigateur web)',
    playMode: 'MultiPlayer',
    numberOfPlayers: { '@type': 'QuantitativeValue', minValue: game.players.min, maxValue: game.players.max },
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    publisher,
  };
}

export function breadcrumbLd(crumbs: Crumb[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  };
}

export function faqLd(items: FaqItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  };
}

/** Sérialise pour une balise <script type="application/ld+json"> en neutralisant « </script> ». */
export function serializeLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
