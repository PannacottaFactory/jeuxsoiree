/**
 * Schémas zod des contenus des jeux.
 * Utilisés uniquement au build (validation dans les pages Astro) et dans les tests :
 * ce module ne doit jamais être importé par un îlot client, pour ne pas envoyer zod au navigateur.
 */
import { z } from 'zod';

export const audienceSchema = z.enum(['tout_public', 'adulte']);

export const packSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    label: z.string().min(1),
    audience: audienceSchema,
  })
  .strict();

/** Une entrée de contenu : phrase, sujet, action ou catégorie selon le jeu. */
const entrySchema = (idPattern: RegExp) =>
  z
    .object({
      id: z.string().regex(idPattern),
      packs: z.array(z.string()).min(1),
      text: z.string().min(1),
      note: z.string().min(1).optional(),
      audience: audienceSchema,
    })
    .strict();

/** Vérifie que chaque entrée référence des packs existants et que les identifiants sont uniques. */
function checkRefs(packs: { id: string }[], lists: Record<string, { id: string; packs: string[] }[]>, ctx: z.RefinementCtx) {
  const packIds = new Set(packs.map((p) => p.id));
  const seen = new Set<string>();
  for (const [name, list] of Object.entries(lists)) {
    list.forEach((entry, i) => {
      if (seen.has(entry.id)) ctx.addIssue({ code: 'custom', path: [name, i, 'id'], message: `Identifiant en double : ${entry.id}` });
      seen.add(entry.id);
      for (const p of entry.packs) {
        if (!packIds.has(p)) ctx.addIssue({ code: 'custom', path: [name, i, 'packs'], message: `Pack inconnu : ${p}` });
      }
    });
  }
}

export const rigololContentSchema = z
  .object({
    game: z.literal('rigolol'),
    packs: z.array(packSchema).min(1),
    phrases: z.array(entrySchema(/^rp-[0-9a-z]{7}$/)).min(3),
  })
  .strict()
  .superRefine((c, ctx) => checkRefs(c.packs, { phrases: c.phrases }, ctx));

export const mimosContentSchema = z
  .object({
    game: z.literal('mimos'),
    packs: z.array(packSchema).min(1),
    subjects: z.array(entrySchema(/^ms-[0-9a-z]{7}$/)).min(1),
    actions: z.array(entrySchema(/^ma-[0-9a-z]{7}$/)).min(1),
  })
  .strict()
  .superRefine((c, ctx) => checkRefs(c.packs, { subjects: c.subjects, actions: c.actions }, ctx));

export const takotacContentSchema = z
  .object({
    game: z.literal('takotac'),
    packs: z.array(packSchema).min(1),
    categories: z.array(entrySchema(/^tc-[0-9a-z]{7}$/)).min(1),
  })
  .strict()
  .superRefine((c, ctx) => checkRefs(c.packs, { categories: c.categories }, ctx));

export type Audience = z.infer<typeof audienceSchema>;
export type Pack = z.infer<typeof packSchema>;
export type ContentEntry = z.infer<ReturnType<typeof entrySchema>>;
export type RigololContent = z.infer<typeof rigololContentSchema>;
export type MimosContent = z.infer<typeof mimosContentSchema>;
export type TakotacContent = z.infer<typeof takotacContentSchema>;
