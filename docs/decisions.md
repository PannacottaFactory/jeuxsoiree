# Journal des décisions

Chaque entrée : date, décision, raison. Les règles de jeu tranchées ici complètent les synthèses `gameplay-*.md`.

## 2026-11-18 — Phase 1 : réponses du propriétaire

### Règles communes
- **Pioche sans remise** dans les 3 jeux : aucun contenu ne revient pendant une partie ; la pioche est remise à zéro à
  chaque nouvelle partie.
- **Tous les packs sont gratuits** sur le web (fin des achats intégrés), le site est financé par la publicité.
- **On garde tous les contenus**, y compris les plus trash des packs No Limit (« c'est pour le jeu »).
- En multijoueur, **c'est le joueur actif qui valide ses points** (farceur dans Rigolol, mimeur dans Mimos, joueur
  interrogé dans Takotac). L'hôte garde un bouton de secours si ce joueur est déconnecté.
- Fiches Play Store hors ligne : aucun lien ni redirection à prévoir.
- Éditeur du site : **Pannacotta Factory** (confirmé).
- Les scripts Unity ne sont **pas** versionnés dans le dépôt.

### Rigolol
- Le farceur **choisit une phrase parmi les 3** affichées.
- Barème et nombre de cycles inchangés par rapport à l'app (voir `gameplay-rigolol.md`).

### Mimos
- **Célébrités** n'ajoute que des sujets (personnages). Ils rejoignent la pioche des sujets et sont combinés avec les
  actions des autres packs cochés. Si Célébrités est le seul pack coché, on utilise les actions de Tout doux (sinon le
  jeu serait injouable).
- **Passer** est autorisé, mais une expression passée **consomme une des 5 opportunités** du passage, sans point.
- **Nombre de passages par joueur** (délégué) : `clamp(round(12 / nbJoueurs), 2, 4)`.
  Résultat : 2 joueurs → 4 passages chacun, 3 → 4, 4 → 3, 5 → 2, 6 → 2 ; en équipes, 4 joueurs → 3, 6 → 2, 8 → 2.
  Cela donne 8 à 16 passages d'une minute environ, soit **10 à 20 min** de partie : rapide, mais chacun joue
  plusieurs fois.

### Takotac
- Il faut **valider avant la fin des 7 s**. Si le chrono atteint 0 sans validation, c'est un **échec automatique**.
- Pas de règle de lapsus : une réponse « sortie toute seule » sous le stress ne fait pas échouer, elle fait rire.
  Le texte du site doit le formuler ainsi, et non comme une règle sur les lapsus.

## 2026-11-18 — Phase 2 : socle technique

- **Astro 7.4.12**. Astro 6 a d'abord été envisagé (compatible avec le Node 22.16 du poste), puis écarté : `npm audit`
  y signale des failles corrigées seulement en 7.x (dont une RCE critique via l'optimisation d'images AVIF et
  plusieurs XSS de rendu). Conséquences :
  - **Node ≥ 22.23.4** et **npm ≥ 11** sont requis (`engines`, `.nvmrc`). npm 10, livré avec Node 22, plante sur
    l'arbre de dépendances (bug arborist `edgesOut`) : la CI installe npm 11.
  - Pendant la phase 2, j'ai compilé avec un Node 22.23.5 portable, sans toucher au Node du système.
    Node système mis à jour en 22.23.5 via winget le 2026-11-18 (npm 11.6.2 déjà présent).
- **Preact 10.29** plutôt que 11 (sorti fin septembre 2026) : branche mûre, compatible avec @preact/signals 2.
- **Polices** : Bricolage Grotesque (variable, 41 Ko, préchargée) pour les titres et les boutons ; **police système**
  pour le texte courant (Inter abandonnée, 48 Ko économisés).
- **CSS inliné dans chaque page** (`inlineStylesheets: 'always'`) : aucune requête bloquante. Les pages SEO n'ont
  **aucun JS** (seulement le JSON-LD) et pèsent 8 à 11 Ko gzippées.
- **`compressHTML: false`** : la compression d'Astro supprimait les espaces aux retours à la ligne autour des balises
  inline (« une <strong>action</strong> » rendu « uneaction »).
- **Drapeaux `FEATURES`** (`src/games/meta.ts`) : `play` et `multiplayer` sont à `false`. Les pages affichent
  « Jouer (bientôt) » et décrivent le QR code comme « bientôt », pour ne rien promettre d'inexistant.
  Il faudra les passer à `true` en phases 3 et 4.
- **Pages `/<jeu>/jouer/`** : provisoires en phase 2 (noindex, hors sitemap).
- **Images OG** : générées par `scripts/generate-og.mjs` (sharp) et committées. librsvg n'accède pas aux polices web,
  donc le texte est en Segoe UI. À régénérer si la palette change.
- **Pas de Tailwind** : le thème repose sur des variables CSS par jeu (`[data-game]`) ; un CSS natif suffit et reste
  plus léger.
- **Contenus** : extraits des `.cs` Unity par `scripts/extract-content.mjs` (le chemin des sources est passé en
  argument), puis committés en JSON dans `src/data/<jeu>/`. Schémas zod dans `src/data/schema.ts`, validés au build et
  en test. zod n'est jamais envoyé au navigateur.
- **Classement des contenus** : chaque entrée a `audience: "tout_public" | "adulte"`.
  **Mis à jour le 2026-11-18 à la demande du propriétaire** : est `adulte` exactement ce qui appartient uniquement au
  pack No Limit. Tout le reste (Films, contrepèteries de Tout doux…) reste `tout_public` et accessible sans
  avertissement 18+. Le pré-classement par mots-clés et la liste de relecture ont été supprimés. Un test vérifie la règle.
- **Base path** : `SITE_URL` et `BASE_PATH` en variables d'environnement (par défaut
  `https://pannacottafactory.github.io` et `/jeuxsoiree`). Pour un domaine perso : `SITE_URL=https://mondomaine.fr`,
  `BASE_PATH=/`, plus un fichier `public/CNAME`.
- **Limite de GitHub Pages en sous-dossier** : `robots.txt` et `ads.txt` ne sont lus qu'à la racine de l'hôte
  (`pannacottafactory.github.io/`), pas sous `/jeuxsoiree/`. Ils sont générés quand même, et deviendront effectifs avec
  un domaine perso. Le sitemap peut être déclaré à la main dans Google Search Console en attendant.
- **Palette « Néon » validée le 2026-11-18** (jaune soleil / violet-magenta / cyan électrique). Bonbon et Club sont
  supprimées, et la page `/design/` (noindex) sert de vitrine du design system. Contrastes vérifiés : accents ≥ 6:1 sur
  le fond, texte foncé sur accent ≥ 6,5:1.
- **Mode sombre uniquement** pour l'instant (`color-scheme: dark`). Un thème clair reste possible grâce aux tokens,
  s'il est demandé.

## 2026-11-18 — Phase 3 : moteurs et mode « un seul téléphone »

### Architecture
- **Moteurs purs** (`src/games/<jeu>/engine.ts`) : `createGame(...)` et `reduce(state, action)`, sans dépendance à
  l'UI, au réseau ni à l'horloge. Une action invalide dans la phase courante est ignorée (état renvoyé à l'identique),
  ce qui rendra le multijoueur robuste aux intentions en double.
- **Hasard déterministe** : l'état du générateur (mulberry32) vit dans l'état de la partie. Même graine + mêmes
  actions = même partie. Indispensable pour les tests et pour le multijoueur où seul l'hôte tire au sort.
- **Temps** : les actions chronométrées portent leur horodatage (`at`, ms). Le moteur compare à `deadline` :
  un « Trouvé » ou un « Validé » horodaté au gong ou après ne compte pas. En multijoueur, c'est l'horloge de l'hôte
  qui fera foi.
- **Transport** : interface `GameTransport` (`src/net/`) ; `LocalTransport` applique le réducteur sur place et
  sauvegarde l'état dans localStorage à chaque action. Un rafraîchissement ou une mise en veille propose de
  **reprendre la partie** (sauvegarde ignorée après 12 h ou si son format change).
- **UI** : îlots Preact montés sur `/<jeu>/jouer/` ; composants partagés dans `src/ui/`. Environ 25 Ko de JS gzippé
  au total. Les pages de jeu pèsent 20 à 35 Ko gzippées, contenus compris. Les landing pages restent sans JS.

### Règles d'implémentation (sans contradiction avec les règles du jeu)
- **Rigolol** : à chaque tour, 3 phrases sont tirées ; les 2 non choisies sont défaussées (pas de retour en pioche),
  pour qu'aucune phrase vue ne revienne. L'ordre des joueurs est tiré au hasard en début de partie, puis chaque cible
  affronte tous les autres joueurs à la suite.
- **Mimos** : chacun pour soi, ordre de saisie ; en équipes, alternance A1, B1, A2, B2… L'expression affichée au gong
  compte comme ratée dans le bilan du passage.
- **Takotac** : ordre de saisie ; le binôme de coopération joue quand on arrive au premier des deux. Au gong,
  l'échec est automatique (son + vibration) et on passe au joueur suivant.

### Mode No Limit (18+)
- URL dédiée `/<jeu>/jouer/no-limit/` : `noindex, nofollow`, hors sitemap, avertissement 18+ à l'entrée (mémorisé
  sur l'appareil). La page tout public ne propose qu'un lien vers ce mode et **ne contient aucune donnée No Limit**
  dans son HTML (vérifié en test navigateur).

### Confort de jeu
- Écran « Passe le téléphone à X » avant toute information secrète, bouton d'action dans la zone du pouce.
- Chrono circulaire, tic sonore sur les 3 dernières secondes, buzzer + vibration au gong.
- Sons synthétisés en WebAudio (aucun fichier), bouton son global mémorisé, Wake Lock pendant la partie,
  confettis en fin de partie (désactivés si `prefers-reduced-motion`), partage via la Web Share API avec copie du
  lien en repli.
- Préparation (joueurs, packs, mode) mémorisée par jeu : « Rejouer » relance avec les mêmes joueurs.
