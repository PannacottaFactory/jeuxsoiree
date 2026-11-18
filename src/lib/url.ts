/**
 * Construction des URL en tenant compte du sous-dossier de déploiement (BASE_PATH).
 * Toujours passer par ces fonctions : aucun lien interne ne doit être écrit « en dur » avec un « / » initial.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Ajoute le slash final pour les chemins de page (trailingSlash: 'always'), pas pour les fichiers. */
function withTrailingSlash(path: string): string {
  const [pathname = '', rest = ''] = path.split(/(?=[?#])/);
  if (pathname.endsWith('/') || /\.[a-z0-9]+$/i.test(pathname)) return pathname + rest;
  return `${pathname}/${rest}`;
}

/** Chemin interne relatif au site : href('/mimos') → '/jeuxsoiree/mimos/'. */
export function href(path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return withTrailingSlash(`${BASE}${clean}`);
}

/** URL absolue (canonical, Open Graph, JSON-LD) : nécessite `site` dans astro.config. */
export function absoluteUrl(path: string, site: URL | undefined): string {
  if (!site) throw new Error('`site` doit être défini dans astro.config.mjs');
  return new URL(href(path), site).toString();
}
