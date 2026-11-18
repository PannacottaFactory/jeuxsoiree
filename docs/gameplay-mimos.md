# Mimos — le jeu des mimes : synthèse du gameplay

Source : `Mimos - Scripts/` (scripts Unity C#). Les textes de règles affichés en jeu sont dans les scènes Unity,
**absentes du dossier** : tout ce qui suit est déduit du code.

## Principe

Le joueur actif mime une **expression composée d'un sujet + une action**, tirés séparément au hasard
(ex. « Un dentiste » + « Qui marche sur un Lego »). Les autres doivent deviner. **5 expressions maximum par passage**, en
**60 secondes**.

## Modes de jeu

| Mode | Joueurs | Contraintes | Scoring |
|---|---|---|---|
| **Chacun pour soi** (`ffa`) | 2 à 6 | — | +1 au **mimeur** par expression trouvée |
| **Équipes** (`team`) | 2 équipes de 2 à 4 | équipes **de même taille** obligatoire, ≥ 2 par équipe | +1 à **l'équipe** du mimeur |

Pseudos uniques (contrôle de doublon présent). En mode équipes, on choisit l'équipe avant d'ajouter un joueur.

## Packs de contenus

Un ou plusieurs packs cochés, au moins un requis.

| Pack | Statut Play Store | Sujets | Actions | Remarques |
|---|---|---|---|---|
| Tout doux | gratuit | 243 (sports/musique, animaux, métiers, autre) | 396 | Tout public |
| Célébrités | achat intégré | 214 (personnages fictifs, personnes réelles, acteurs) | **0** | Voir ambiguïté n°1 |
| No Limit | achat intégré | 93 | 160 (sexe, drogue, autre) | Sexe, drogue, mais aussi **sujets haineux/choquants** (« Hitler », « Un juif », « Un pendu », « Qui se suicide »…) |

Total : 550 sujets, 556 actions. 35 doublons (surtout dans Tout doux).
Quelques entrées ont une précision entre parenthèses (« Pongo (101 Dalmatiens) ») : à garder comme indice.

## Paramètres de partie

- Minuteur : **60 s** par passage (`maxTimer = 60`), buzzer sonore à 0.
- `max_expressions = 5` par passage.
- Nombre de manches : le code **voulait** `max_turn` = 5 si < 5 joueurs, 4 si 5 joueurs, 3 si 6 à 9 joueurs, avec la
  condition `turn < max_turn` (turn démarre à 1) → **4, 3 ou 2 passages par joueur**.
  **Mais** ce calcul est fait avant le chargement des joueurs (liste vide) → dans l'app publiée, c'est **toujours 4
  passages par joueur**, quel que soit le nombre de joueurs. Voir ambiguïté n°2.

## Déroulé d'un passage

1. Écran caché (couleur du pack) : « Au tour de <joueur> ». Le téléphone est passé au mimeur.
2. Le mimeur appuie sur « Prêt » → l'écran se découvre et le **chrono de 60 s démarre**.
3. Affichage sujet + action. Le mimeur mime.
   - **« Validé »** (`MimeValide`) : +1 point, expression suivante.
   - `NextExpression` est public et probablement relié à un bouton **« Passer »** dans la scène (sans point). Non confirmé.
4. Fin du passage :
   - 5 expressions traitées avant la fin du chrono → « Plus rien à faire deviner ! »
   - Chrono à 0 → buzzer, « Temps écoulé ! Fallait être plus rapide ! »
   Puis bouton « Joueur suivant ».
5. Ordre : en chacun pour soi, ordre de la liste. En équipes, **alternance équipe 1 / équipe 2**, chaque équipe faisant
   tourner ses joueurs dans l'ordre.
6. Fin de partie : classement individuel (chacun pour soi) ou score des 2 équipes ; partage capture + lien Play Store.

Remarque de code : la pioche est réinitialisée à chaque expression → répétitions possibles (le moteur web fera une pioche
sans remise, séparée pour sujets et actions).

## Ambiguïtés / manques

1. **Célébrités n'a aucune action.** Si seul ce pack est coché, l'app plante. Veux-tu : (a) mimer la célébrité seule,
   (b) combiner la célébrité avec une action de Tout doux, ou (c) autre ?
2. **Nombre de manches** : garder le comportement réel (4 passages par joueur toujours) ou l'intention du code
   (4/3/2 selon le nombre de joueurs) ?
3. Existe-t-il un bouton « Passer » ? Une expression passée compte-t-elle dans les 5 ?
4. En chacun pour soi, seul le mimeur marque : celui qui devine ne gagne rien. À confirmer.
5. Deux identifiants Play Store différents dans le code : `com.PannacottaFactory.Mimos` et
   `com.PannacottaFactory.MimosJeudesMimes`. Lequel est le bon ?
6. Règles officielles, couleurs des packs, sons (buzzer), visuels : non fournis.

## Tranché le 2026-11-18 (voir `decisions.md`)

1. Célébrités = sujets seulement, combinés avec les actions des autres packs cochés (actions de Tout doux si Célébrités est seul).
2. Passages par joueur : `clamp(round(12 / nbJoueurs), 2, 4)`.
3. « Passer » existe ; une expression passée consomme une des 5 opportunités, sans point.
4. En chacun pour soi, seul le mimeur marque (comportement de l'app conservé). C'est le mimeur qui valide « Trouvé ».
5. Fiches Play Store hors ligne : sans objet.
