// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

/**
 * URL publique et sous-dossier de déploiement.
 * - GitHub Pages (défaut) : https://pannacottafactory.github.io + /jeuxsoiree
 * - Domaine perso : SITE_URL=https://mondomaine.fr BASE_PATH=/ (et ajouter public/CNAME)
 */
const SITE_URL = process.env.SITE_URL ?? 'https://pannacottafactory.github.io';
const BASE_PATH = process.env.BASE_PATH ?? '/jeuxsoiree';

// Pages exclues du sitemap : démo de design, écrans de jeu (pas de contenu SEO), modes 18+.
const SITEMAP_EXCLUDE = [/\/design\/$/, /\/jouer\//, /\/rejoindre\//, /\/no-limit\//, /\/404\/?$/];

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  // La compression HTML d'Astro supprime les espaces aux retours à la ligne autour des balises inline
  // (« une <strong>action</strong> » devenait « uneaction »). Gain négligeable après gzip : désactivée.
  compressHTML: false,
  build: {
    format: 'directory',
    // Toutes les feuilles de style sont injectées dans le HTML : aucune requête CSS bloquante.
    inlineStylesheets: 'always',
  },
  integrations: [
    preact(),
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.some((re) => re.test(page)),
    }),
  ],
});
