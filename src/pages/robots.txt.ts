/**
 * robots.txt généré avec l'URL absolue du sitemap.
 * Attention : les robots ne lisent ce fichier qu'à la racine de l'hôte. Il n'est donc effectif
 * qu'avec un domaine perso (BASE_PATH=/). Voir docs/decisions.md.
 */
import type { APIRoute } from 'astro';
import { absoluteUrl } from '~/lib/url';

export const GET: APIRoute = ({ site }) => {
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${absoluteUrl('/sitemap-index.xml', site)}`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
