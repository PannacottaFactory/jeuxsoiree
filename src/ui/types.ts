/** URL utiles à un écran de jeu, calculées par la page Astro (base path compris). */
export interface PlayUrls {
  /** Page du jeu (bouton retour). */
  back: string;
  /** URL absolue partagée en fin de partie. */
  share: string;
  /** URL absolue de la page « rejoindre » (QR code du multijoueur). */
  join: string;
  /** Page du mode adulte (lien depuis le mode tout public). */
  adult?: string;
  /** Page du mode tout public (retour depuis l'avertissement 18+). */
  normal?: string;
}
