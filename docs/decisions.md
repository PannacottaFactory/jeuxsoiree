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
- **Takotac** : ordre de saisie ; le binôme de coopération joue quand on arrive au premier des deux.
  **Lecteur** (demande du propriétaire, 2026-11-18) : un autre joueur lit la consigne, personne ne lit la sienne. Le
  lecteur est le joueur précédent dans l'ordre de jeu (celui qui vient de répondre lit au suivant), et c'est lui qui
  valide. En multijoueur, le lecteur voit la consigne et valide ; le joueur interrogé ne voit que le chrono. Au gong,
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

## 2026-11-18 — Phase 4 : multijoueur « chacun son téléphone »

### Architecture (réseau isolé du jeu)
- `RoomBackend` (`src/net/RoomBackend.ts`) : interface neutre (salles, présence, vues, intentions, transfert
  d'hôte). Implémentations : `FirebaseBackend` (production) et `MemoryBackend` (tests). Changer de fournisseur
  = écrire une autre implémentation, sans toucher aux moteurs ni à l'UI.
- `MultiplayerSession` : orchestration hôte / invités, indépendante du fournisseur et du jeu.
- `MultiAdapter` par jeu (`src/games/<jeu>/multi.ts`) : composition du lobby, création, autorisations
  (`actors`/`authorize`), actions automatiques (fins de chrono), et **projection** de l'état en une vue publique plus
  une vue secrète par joueur.
- **L'hôte fait autorité.** Il garde l'état complet (pioche, générateur aléatoire), applique les intentions autorisées
  et publie les vues. L'état complet est stocké dans `hostState`, que lui seul peut lire : il sert à la reprise et au
  transfert d'hôte. Les invités reçoivent les **textes** déjà résolus, sans aucun contenu de jeu à télécharger.
- **Qui agit** : le farceur (Rigolol), le mimeur (Mimos) et le lecteur (Takotac) pilotent leur tour depuis leur
  téléphone. L'hôte ne peut jouer à leur place que si ce joueur est **hors ligne** (bandeau « Tu joues à la place
  de… »). Les fins de chrono sont déclenchées par l'hôte, sur l'horloge du serveur.
- **Temps** : toutes les dates sont en temps serveur (`.info/serverTimeOffset`). L'hôte recale l'horodatage d'une
  intention : 2 s de latence tolérées au maximum, jamais dans le futur.
- Les vues, états et intentions transitent en **JSON sérialisé** : la Realtime Database supprime les `null` et les
  tableaux vides, ce qui corromprait les états de jeu.

### Salles
- Code de 4 lettres, sans I, L, O ni chiffres. La salle expire après **6 h d'inactivité** (prolongée à chaque action
  de l'hôte).
- **Ménage sans serveur** : index `expiry/{tranche d'une heure}`. Une tranche n'est lisible qu'une fois écoulée, donc
  aucun code de salle active n'est exposé. À chaque création de salle, les 24 dernières tranches sont nettoyées.
  Une requête filtrée (`query.endAt <= now`) a d'abord été envisagée, puis écartée : l'émulateur ne la vérifie pas de
  façon fiable, et je ne voulais pas reposer la sécurité sur un comportement non testable.
- **Reconnexion** : l'uid anonyme Firebase est persistant (IndexedDB) et la dernière salle est mémorisée dans
  localStorage. Après un rafraîchissement ou une mise en veille, le joueur revient automatiquement dans la partie,
  avec sa fiche et son ordre d'arrivée.
- **Présence** : `onDisconnect` passe le joueur hors ligne. Si l'hôte est hors ligne depuis plus de **30 s**, le
  joueur en ligne arrivé le plus tôt devient hôte (condition revérifiée par les règles) et reprend la partie
  depuis `hostState`.
- Un joueur qui arrive pendant une partie attend la suivante. L'hôte peut retirer un joueur, relancer une partie
  avec les joueurs en ligne, ou revenir au lobby pour changer les packs ou les équipes.
- En Mimos par équipes, un joueur arrivé sans équipe est placé dans la moins remplie.

### Sécurité (database.rules.json)
- Lecture et écriture fermées par défaut ; utilisateur authentifié (anonyme) obligatoire ; impossible de lister les
  salles.
- `meta` : lisible par qui connaît le code. Création seulement si le code est libre ou expiré, et seulement à son
  propre nom. Transfert d'hôte seulement par un membre, si l'hôte est absent ou hors ligne depuis plus de 30 s.
- `players/{uid}` : chacun n'écrit que sa fiche (pseudo de 1 à 20 caractères, champs contrôlés) ; l'hôte peut
  retirer un joueur.
- `view` : membres seulement. `secrets/{uid}` : ce joueur seulement. `hostState` et `intents` en lecture : l'hôte
  seulement. Intentions : membres, en leur propre nom, 1 000 caractères au maximum.
- Tests : `npm run test:rules` (12 tests sur les émulateurs, y compris une partie réelle via `FirebaseBackend`),
  exécutés aussi en CI (job `rules`, Java 21).
- **Firebase Analytics n'est pas initialisé** (cookies avant consentement : interdit). Il sera branché en phase 5.

### Mise en production des règles (action manuelle)
- La base est en mode verrouillé tant que `database.rules.json` n'est pas publié. Deux options : copier-coller le
  fichier dans la console (Realtime Database → Règles → Publier), ou lancer
  `npx firebase-tools login` puis `npx firebase-tools deploy --only database`.
- Recommandé : dans Google Cloud Console → Identifiants, restreindre la clé API aux référents HTTP
  `pannacottafactory.github.io/*` et `localhost:*`.

### Tests
- 14 tests de session sur `MemoryBackend` : secrets, autorisations, fins de chrono, exclusion, reconnexion,
  transfert d'hôte.
- Tests de bout en bout dans Chrome, chaque téléphone dans un contexte isolé, contre les émulateurs : parties
  complètes des 3 jeux (3 à 4 joueurs), rafraîchissement en pleine partie, départ de l'hôte puis reprise par un
  invité. Aucune erreur JS.
