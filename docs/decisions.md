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
- Éditeur du site : **Pannacotta Factory** (à confirmer : la réponse disait « Pannacotta Factor »).
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
    **À faire de ton côté : mettre à jour Node** (22 LTS récent ou 24 LTS).
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
- **Contrepèteries** de Rigolol (38) classées `adulte` : le texte est anodin, le sens caché ne l'est pas.
- **Pas de Tailwind** : le thème repose sur des variables CSS par jeu (`[data-game]`) ; un CSS natif suffit et reste
  plus léger.
- **Contenus** : extraits des `.cs` Unity par `scripts/extract-content.mjs` (le chemin des sources est passé en
  argument), puis committés en JSON dans `src/data/<jeu>/`. Schémas zod dans `src/data/schema.ts`, validés au build et
  en test. zod n'est jamais envoyé au navigateur.
- **Classement des contenus** : chaque entrée a `audience: "tout_public" | "adulte"`. Les packs No Limit sont entièrement
  `adulte`. Dans les autres packs, des entrées sont signalées `adulte` (mots-clés, contrepèteries) et
  **ne sont tirées que si la partie inclut un pack adulte** (donc après l'avertissement 18+). Rien n'est supprimé.
  La liste à relire est dans `docs/contenus-a-relire.md`.
- **Base path** : `SITE_URL` et `BASE_PATH` en variables d'environnement (par défaut
  `https://pannacottafactory.github.io` et `/jeuxsoiree`). Pour un domaine perso : `SITE_URL=https://mondomaine.fr`,
  `BASE_PATH=/`, plus un fichier `public/CNAME`.
- **Limite de GitHub Pages en sous-dossier** : `robots.txt` et `ads.txt` ne sont lus qu'à la racine de l'hôte
  (`pannacottafactory.github.io/`), pas sous `/jeuxsoiree/`. Ils sont générés quand même, et deviendront effectifs avec
  un domaine perso. Le sitemap peut être déclaré à la main dans Google Search Console en attendant.
- **Palettes** : 3 propositions côte à côte sur la page `/design/` (noindex) : Néon (défaut), Bonbon, Club.
  Pour changer la palette du site, il suffit de modifier la valeur par défaut de la prop `palette` dans
  `BaseLayout.astro`. Contrastes vérifiés : accents ≥ 6:1 sur le fond, texte foncé sur accent ≥ 5,8:1.
- **Mode sombre uniquement** pour l'instant (`color-scheme: dark`). Un thème clair reste possible grâce aux tokens,
  s'il est demandé.
