/**
 * Configuration Firebase du projet « pannacottagames ».
 *
 * Ces valeurs sont PUBLIQUES par nature : elles identifient le projet, elles ne donnent aucun droit.
 * Ce qui protège les données, ce sont les règles de sécurité (database.rules.json), testées sur l'émulateur
 * (npm run test:rules). Voir docs/decisions.md.
 *
 * Firebase Analytics n'est volontairement PAS initialisé : il dépose des cookies, interdit avant consentement (RGPD).
 * La mesure d'audience sera branchée derrière la CMP en phase 5.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyACOnwrWF1UdzUOnAPC90H-w25tfZTLAjM',
  authDomain: 'pannacottagames-384a4.firebaseapp.com',
  databaseURL: 'https://pannacottagames-384a4-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'pannacottagames-384a4',
  storageBucket: 'pannacottagames-384a4.firebasestorage.app',
  messagingSenderId: '320739684273',
  appId: '1:320739684273:web:c94cc2dd5054ed7861d790',
} as const;

/** Émulateurs locaux (tests de bout en bout) : activés par PUBLIC_FIREBASE_EMULATOR=1 au build. */
export const EMULATOR = {
  enabled: import.meta.env.PUBLIC_FIREBASE_EMULATOR === '1',
  host: '127.0.0.1',
  authPort: 9099,
  databasePort: 9000,
} as const;
