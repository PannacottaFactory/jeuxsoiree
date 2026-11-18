# Jeux de soirée

Rigolol, Mimos et Takotac : trois jeux de soirée gratuits, jouables dans le navigateur du téléphone.
Site statique Astro + Preact, déployé sur GitHub Pages.

## Démarrer

Prérequis : **Node ≥ 22.23.4** et **npm ≥ 11** (`npm install -g npm@11`).

```sh
npm ci
npm run dev      # http://localhost:4321/jeuxsoiree/
npm test         # tests unitaires (Vitest)
npm run build    # vérification des types + build dans dist/
npm run test:rules  # règles de sécurité Firebase sur les émulateurs (Java 21 requis)
```

## Multijoueur (Firebase)

- Configuration publique : `src/net/firebase/config.ts`. Règles de sécurité : `database.rules.json`.
- **Publier les règles** après chaque modification : console Firebase → Realtime Database → Règles, ou
  `npx firebase-tools login` puis `npx firebase-tools deploy --only database`.
- Tester en local contre les émulateurs : lancer `npx firebase-tools emulators:start --only auth,database`, puis
  `PUBLIC_FIREBASE_EMULATOR=1 npm run build && npm run preview`.

## Scripts utiles

| Commande | Rôle |
|---|---|
| `npm run extract -- "<dossier des scripts Unity>"` | Régénère `src/data/*/content.json` à partir des anciens `PhraseMaker.cs` |
| `npm run og` | Régénère les images Open Graph (`public/og/`) et l'icône Apple |

## Domaine personnalisé

1. Créer `public/CNAME` contenant le domaine (ex. `jeuxdesoiree.fr`).
2. Dans GitHub → Settings → Secrets and variables → Actions → **Variables** : `SITE_URL=https://jeuxdesoiree.fr`, `BASE_PATH=/`.
3. Configurer le DNS, puis le domaine dans Settings → Pages.

## Organisation

```
src/
  pages/        accueil, landing pages, règles, jouer (+ no-limit 18+), légal
  layouts/      BaseLayout, GameLayout, RulesLayout
  components/   composants Astro partagés (dont PlayPage)
  games/        métadonnées, moteurs purs (core/, rigolol/, mimos/, takotac/) et écrans Preact
  net/          GameTransport, LocalTransport (puis transport temps réel en phase 4)
  ui/           composants de jeu partagés, sons, hooks, préparation de partie
  data/         contenus JSON + schémas zod
  styles/       tokens, palette Néon et thèmes par jeu
  lib/          URL (base path), JSON-LD
scripts/        extraction des contenus, images OG
docs/           synthèses de gameplay, plan, décisions
```

Les décisions d'architecture et de règles sont tracées dans [`docs/decisions.md`](docs/decisions.md).
