# Takotac — réponds le plus vite possible, gare aux lapsus ! : synthèse du gameplay

Source : `Takotac - Scripts/` (scripts Unity C#). Les textes de règles affichés en jeu sont dans les scènes Unity,
**absentes du dossier** : tout ce qui suit est déduit du code.

## Principe

Le joueur actif reçoit une consigne « **Cite 3** <catégorie> » (ou « Cite 4 ») et doit répondre en **7 secondes**.
Le groupe juge : **réussi = +2 points**, raté = 0. La pression du chrono provoque les lapsus.

## Joueurs

- **2 à 8 joueurs** (`maxPlayer = 8`). Pas de contrôle de pseudo en double.

## Packs de contenus

Un ou plusieurs packs cochés, au moins un requis.

| Pack | Statut Play Store | Volume | Remarques |
|---|---|---|---|
| Tout doux | gratuit | 455 catégories | Ex. « animaux qui ont des griffes », « trucs oranges » |
| Culture G | achat intégré | 202 catégories | Cinéma, peinture, littérature, français, télé, géo, musique, gastronomie, sport, nature, histoire, sciences, langues |
| No Limit | achat intégré | 172 catégories | Sections sexe, drogue, gras, clichés et insultes, horrible, autre |

Total : 829 catégories. 40 doublons (majoritairement Tout doux ↔ Culture G).
Format d'une entrée : un groupe nominal au pluriel, sans le nombre. Certaines visent un joueur (« trucs à faire avec
moi », « insultes envers moi ») → « moi » = le joueur qui lit.

## Tirage d'une consigne

- Catégorie tirée au hasard dans les packs cochés (**avec remise** dans l'app : répétitions possibles).
- Nombre à citer : **3 (65 %)** ou **4 (35 %)**.
- Texte : « Cite N <catégorie> » en solo, « Citez N <catégorie> » en coopération.

## Paramètres de partie

| Joueurs | Manches |
|---|---|
| 2 | 8 |
| 3 à 5 | 6 |
| 6 à 8 | 5 |

Une manche = chaque joueur joue une fois. Minuteur : **7 s**, buzzer à 0.

## Coopération (« coop »)

Au **début de chaque manche** :
- 41 % de chances qu'une coop ait lieu ; **toujours** s'il y a plus de 6 joueurs ; **jamais** à 2 joueurs.
- Deux joueurs tirés au hasard jouent **ensemble un seul tour** (icône poignée de main, « A vous de jouer ! »,
  consigne « Citez… »). Réussite : **+2 points à chacun**. Leur passage compte comme leur tour de la manche.

## Déroulé d'un tour

1. Écran caché (couleur du pack) : nom du joueur (ou « X et Y »), « A toi de jouer ! ».
2. Appui → l'écran se découvre, **le chrono de 7 s démarre**, la consigne s'affiche.
3. Le groupe appuie sur **« Validé »** (+2) ou **« Échec »** (0). Le chrono, s'il tourne encore, est arrêté.
   Quand le chrono atteint 0, seul le buzzer sonne : il faut quand même appuyer sur Validé/Échec.
4. Ordre des joueurs : ordre de la liste (les joueurs en coop passent quand on arrive au premier des deux).
5. Fin : classement par score ; boutons « Rejouer » (même joueurs), « Titre », partage capture + lien Play Store.
   L'app affichait une pub interstitielle tous les 10 tours (`adsCounter`).

## Ambiguïtés / manques

1. Qui juge la réponse ? Dans l'app, c'est « le téléphone » (donc le groupe). En multijoueur, je propose l'hôte ou un vote
   des autres joueurs (voir questions).
2. La réponse doit-elle être donnée **avant** la fin des 7 s ? (le code laisse valider après le buzzer).
3. Un lapsus ou une hésitation fait-il échouer ? Le « gare aux lapsus » est un slogan, pas une règle codée.
4. Pioche avec remise : je propose une pioche sans remise (meilleure expérience), sauf avis contraire.
5. Règles officielles, couleurs des packs, son du buzzer, visuel de la poignée de main : non fournis.

## Tranché le 2026-11-18 (voir `decisions.md`)

1. Le **joueur interrogé valide** lui-même ses points.
2. Il faut valider **avant la fin des 7 s** ; à 0, c'est un échec automatique.
3. Pas de règle de lapsus : une réponse « sortie toute seule » sous le stress ne fait pas échouer.
4. Pioche sans remise sur toute la partie.
