# Rigolol — « Essaye de ne pas rire » : synthèse du gameplay

Source : `Essaye de ne pas rire RIGOLOL - Scripts/` (scripts Unity C#). Les textes de règles affichés en jeu
(`rulesPanel`, `firstPanel`) sont dans les scènes Unity, **absentes du dossier** : tout ce qui suit est déduit du code.

## Principe

À chaque tour, un joueur (le **farceur**, `currentPlayer`) essaie de faire rire un autre joueur (la **cible**,
`currentLaugher`) en lui lisant une phrase drôle. Le jeu propose **3 phrases** tirées au hasard ; le farceur en choisit une
(le choix est implicite : les 3 sont affichées, rien n'est validé dans le code).

## Joueurs

- **2 à 6 joueurs** (`maxPlayer = 6`, bouton « Jouer » actif si `currentPlayer > 1`).
- Saisie des pseudos un par un, suppression possible. **Pas de contrôle de doublon** de pseudo (contrairement à Mimos),
  alors que la suppression et le score se basent sur le nom → bug latent à corriger côté web (identifiants uniques).

## Packs de contenus (« modes »)

On peut cocher **un ou plusieurs packs** ; les phrases des packs cochés sont mélangées. Au moins un pack requis.

| Pack | Statut Play Store | Volume | Remarques |
|---|---|---|---|
| Tout doux | gratuit | 430 phrases | Blagues, jeux de mots, 38 **contrepèteries** (marquées « (contrepèterie) », souvent grivoises : « Partons à Toulouse », « Elle habite Laval »…) |
| Films | achat intégré | 211 répliques | Répliques cultes de films/séries (parfois suivies de la source entre parenthèses, ex. « (Friends) »). **Plusieurs répliques sont crues** (sexe, insultes) |
| No Limit | achat intégré | 268 phrases | Humour sexuel, noir, scatologique |

Volume total : **909 phrases**. 8 doublons détectés (dont 1 entre Tout doux et No Limit).
Certaines phrases contiennent des marques de genre « amoureux(se) », « content(e) » : à conserver telles quelles.

Chaque pack a une couleur (`ModeData.color`) qui colore le fond pendant la partie ; **les valeurs sont dans la scène, non
fournies**. Si plusieurs packs sont cochés, c'est la couleur du dernier pack de la liste qui gagne.

## Paramètres de partie

| Joueurs | `maxRound` | Cycles de « cible » effectifs | Tours de jeu au total |
|---|---|---|---|
| 2 | 5 | 4 | 4 × 2 × 1 = 8 |
| 3 | 3 | 2 | 2 × 3 × 2 = 12 |
| 4 | 3 | 2 | 2 × 4 × 3 = 24 |
| 5 | 2 | 1 | 1 × 5 × 4 = 20 |
| 6 | 2 | 1 | 1 × 6 × 5 = 30 |

`laugherMax` démarre à 1 et la partie s'arrête quand il atteint `maxRound` → nombre de cycles = `maxRound − 1`.
Un **cycle** = chaque joueur est la cible une fois, et pendant qu'il est cible, **chacun des autres joueurs** tente de le
faire rire une fois.

**Pas de minuteur** dans Rigolol.

## Déroulé

1. Début : farceur et cible tirés au hasard (distincts).
2. Écran de tour : nom du farceur en grand, « Essaye de faire rire : <cible> », 3 phrases.
3. Le farceur lit une phrase à la cible. Deux boutons :
   - **« A ri »** (`Laugh`) : le farceur gagne **N points** (N = nombre de joueurs).
   - **« N'a pas ri »** (`DidntLaugh`) : la cible gagne **1 point**.
4. Tour suivant : prochain farceur = premier joueur (dans l'ordre de la liste) qui n'a pas encore joué contre la cible
   actuelle. Quand tous l'ont fait, la cible suivante = premier joueur dont le compteur de cible est en retard.
5. Fin : classement décroissant par score, bandeau à la couleur du pack, bouton partage (capture d'écran + lien Play
   Store), retour au titre. Demande de note après 2 parties (spécifique Play Store, à ne pas reprendre tel quel).

Remarques de code : les 3 phrases sont tirées sans doublon **au sein d'un tour**, mais la liste est réinitialisée à chaque
tour → une phrase peut revenir dans la même partie. `EndGame()` peut être appelé deux fois (scores affichés en double).
Ce sont des défauts d'implémentation, pas des règles : le moteur web les corrigera (pioche sans remise).

## Ambiguïtés / manques

1. Texte officiel des règles (panneaux Unity) absent.
2. Le farceur choisit-il réellement 1 phrase parmi 3, ou doit-il lire les 3 ? (le code affiche 3 phrases sans sélection).
3. Qui appuie sur « A ri / N'a pas ri » ? En pass-and-play, c'est le téléphone du farceur ; en multijoueur, à définir.
4. Asymétrie voulue du barème (N points vs 1 point) : je la conserve telle quelle sauf avis contraire.
5. Couleurs des packs, logo, icônes, sons : non fournis.
6. Pas de contrôle de pseudo en double.

## Tranché le 2026-11-18 (voir `decisions.md`)

- Le farceur **choisit 1 phrase parmi 3** ; c'est **lui qui valide** « a ri / n'a pas ri ».
- Barème et nombre de cycles inchangés. Pioche sans remise sur toute la partie.
