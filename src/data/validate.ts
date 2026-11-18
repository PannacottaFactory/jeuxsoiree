/**
 * Validation des contenus au build : importé par les pages Astro (côté serveur uniquement).
 * Un contenu invalide fait échouer `astro build`, donc la CI.
 */
import rigololRaw from './rigolol/content.json';
import mimosRaw from './mimos/content.json';
import takotacRaw from './takotac/content.json';
import { mimosContentSchema, rigololContentSchema, takotacContentSchema } from './schema';

let validated: ReturnType<typeof run> | undefined;

function run() {
  return {
    rigolol: rigololContentSchema.parse(rigololRaw),
    mimos: mimosContentSchema.parse(mimosRaw),
    takotac: takotacContentSchema.parse(takotacRaw),
  };
}

/** Contenus validés (mémorisés : la validation ne tourne qu'une fois par build). */
export function getValidatedContent() {
  validated ??= run();
  return validated;
}
