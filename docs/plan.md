# Plan d'implémentation — Jeux de soirée

Statut : **validé le 2026-11-18**. Phases 2 et 3 livrées (voir `decisions.md`). Phase suivante : 4 (multijoueur QR code).

## 1. Constat sur les sources

- Les dossiers ne contiennent que des **scripts Unity C#** : la logique et **tous les contenus** (dans `PhraseMaker.cs`)
  sont là. Les **scènes** (textes de règles, couleurs des packs, mises en page), **sons**, **polices** et **visuels**
  ne sont pas fournis.
- Contenus : Rigolol 909 phrases, Mimos 550 sujets + 556 actions, Takotac 829 catégories. Ils seront extraits
  automatiquement des `.cs` par un script (`scripts/extract-content.ts`), puis dédoublonnés et relus.
- Deux fichiers sont en UTF-16 (`MenuSelector.cs`) : l'extraction gère l'encodage.

## 2. Stack retenue (avec mes ajustements)

| Sujet | Choix | Pourquoi |
|---|---|---|
| Site | **Astro 7 + TypeScript strict** | HTML statique pour le SEO, JS seulement dans les îlots de jeu |
| Îlots de jeu | **Preact + @preact/signals** | ~4 ko, API React connue, signals adaptés à un état de jeu réactif |
| CSS | CSS natif + variables (pas de Tailwind) | Le design repose sur des tokens par jeu ; Tailwind n'apporte rien ici |
| Contenus | JSON dans `src/data/<jeu>/` + schéma **zod validé au build et en test** | zod n'est pas envoyé au navigateur |
| QR code | `uqr` (ou `qrcode-generator`) | Génération SVG, quelques ko, sans dépendance |
| Temps réel | **Firebase Realtime Database + Auth anonyme** (SDK modulaire, chargé uniquement en multijoueur) | Gratuit, `onDisconnect()` natif pour la présence et la reconnexion, règles de sécurité basées sur `auth.uid` |
| Tests | Vitest (moteurs), Playwright en 375 px (parcours clés) | |
| PWA | `@vite-pwa/astro` (Workbox) | Hors ligne pour le mode un seul téléphone |
| Déploiement | GitHub Actions → Pages ; `SITE_URL` et `BASE_PATH` en variables | Passage au domaine perso = changer 2 variables + `CNAME` |

Alternatives écartées : Supabase Realtime (plus de configuration, pas de présence aussi simple côté client) ;
PeerJS/WebRTC (l'hôte serait le serveur : une mise en veille de son téléphone casse la partie, et les réseaux 4G/NAT
nécessitent un serveur TURN). Grâce à `GameTransport`, on pourra changer plus tard.

### Point bloquant à connaître : AdSense et GitHub Pages

`ads.txt` doit être **à la racine du domaine**. Sur `pannacottafactory.github.io/jeuxsoiree/`, la racine est
`pannacottafactory.github.io`, qui appartient à un autre dépôt (`PannacottaFactory.github.io`). AdSense valide aussi
les sites par domaine. **Un domaine personnalisé est quasi indispensable pour la monétisation** (et meilleur pour le SEO).

## 3. Architecture

```
src/games/core/        types Player, Room, Phase ; machine à états générique ; pioche sans remise (seedable) ; scoring
src/games/<jeu>/engine.ts   moteur pur : (état, action) → nouvel état. Aucune dépendance UI/réseau. Testé.
src/games/<jeu>/views/      écrans Preact (hôte, joueur actif, spectateur, pass-and-play)
src/net/GameTransport.ts    interface : create/join/leave, publish(state), sendIntent(action), onState, onPresence
src/net/LocalTransport.ts   tout en mémoire (un seul téléphone)
src/net/FirebaseTransport.ts
```

- **L'hôte fait autorité** : les invités envoient des *intentions* (« je suis prêt », « trouvé ») ; seul l'hôte applique
  le moteur et publie l'état. Les informations secrètes (carte du mimeur…) sont publiées dans un nœud lisible
  **uniquement** par le joueur concerné (règle RTDB sur `auth.uid`).
- **Salle** : code 4 lettres parmi `ABCDEFGHJKMNPQRSTUVWXYZ` (sans I, L, O), TTL 6 h d'inactivité ; nettoyage par
  vérification `expiresAt` dans les règles + purge à la création de salle (pas de Cloud Function, donc pas de backend).
- **Reconnexion** : `playerId` + `auth.uid` anonyme persistés ; présence via `onDisconnect`. Si l'hôte est absent plus
  de 30 s, transfert automatique au joueur connecté le plus ancien.

### Adaptation multijoueur proposée par jeu (à valider)

| Jeu | Téléphone de l'hôte | Joueur actif | Autres joueurs |
|---|---|---|---|
| Rigolol | Valide « a ri / n'a pas ri » | Farceur : voit ses 3 phrases | Cible : « Ne ris pas ! » ; autres : qui joue contre qui |
| Mimos | Lance les passages, peut corriger | Mimeur : carte secrète + « Trouvé » / « Passer » + chrono | Chrono et score en direct (rien de secret) |
| Takotac | Valide / Échec | Voit la consigne + chrono 7 s | Voient la même consigne et le chrono (pour juger) |

## 4. Phases

1. **Phase 1 (ce document)** : synthèses `docs/gameplay-*.md`, questions, plan.
2. **Phase 2** : socle Astro + Preact, extraction des contenus en JSON validés, design system (je propose 3 palettes sur
   une page de démo avant de figer), accueil + 3 landing pages + pages règles, CI GitHub Pages.
3. **Phase 3** : `core` + 3 moteurs + tests Vitest, mode **un seul téléphone** complet (écrans « Passe le téléphone à X »,
   minuteurs, Wake Lock, vibration, sons, mute).
4. **Phase 4** : `FirebaseTransport`, création de salle, QR plein écran, `/<jeu>/rejoindre?salle=XXXX`, lobby,
   reconnexion, transfert d'hôte, règles de sécurité + tests avec l'émulateur Firebase.
5. **Phase 5** : PWA hors ligne ; CMP (Google Privacy & messaging) ; `<AdSlot>` ; pub paramétrable par mode ;
   **synthèse des règles AdSense à jour** avant de brancher les modes adultes ; analytics ; pages Confidentialité et
   Mentions légales ; `ads.txt`.
6. **Phase 6** : passe SEO/perf (Lighthouse ≥ 95 ×4 en mobile), JSON-LD, sitemap, pages longue traîne, tests réels
   iOS Safari / Android Chrome.

Chaque phase se termine par un commit, un résumé et une mise à jour de `docs/decisions.md`.

## 5. Contenus adultes

- Classement : est `adulte` exactement ce qui vient du pack No Limit (décision du 2026-11-18) ; tout le reste
  est accessible sans avertissement.
- On garde tous les contenus, y compris haineux ou choquants (décision du propriétaire). Cela compte pour AdSense :
  à intégrer dans la synthèse des règles avant la phase 5.
- URL dédiées en `noindex` (ex. `/<jeu>/jouer/no-limit/`), avertissement 18+ à l'entrée, config
  `ads: { enabled, network }` par mode.
