/**
 * Choix du mode de jeu. « Chacun son téléphone » est mis en avant : chaque joueur découvre le site.
 */
import { Screen } from '../components';

export function ModeChooser(props: {
  gameName: string;
  onMulti: () => void;
  onLocal: () => void;
  resume?: { label: string; onResume: () => void } | null;
}) {
  return (
    <Screen>
      {props.resume && (
        <div class="resume">
          <p>{props.resume.label}</p>
          <button type="button" class="pbtn pbtn--primary pbtn--sm" onClick={props.resume.onResume}>
            Reprendre
          </button>
        </div>
      )}
      <h1 style="font-size: var(--fs-2xl); margin: 0">Comment voulez-vous jouer ?</h1>
      <button type="button" class="mode-card mode-card--featured" onClick={props.onMulti}>
        <span class="mode-card__badge">Recommandé</span>
        <span class="mode-card__icon" aria-hidden="true">
          📱📱📱
        </span>
        <span class="mode-card__title">Chacun son téléphone</span>
        <span class="mode-card__text">
          Crée une salle, les autres scannent le QR code. Chacun voit ses cartes secrètes sur son écran.
        </span>
      </button>
      <button type="button" class="mode-card" onClick={props.onLocal}>
        <span class="mode-card__icon" aria-hidden="true">
          📱
        </span>
        <span class="mode-card__title">Un seul téléphone</span>
        <span class="mode-card__text">On se passe le téléphone. Fonctionne même sans réseau.</span>
      </button>
    </Screen>
  );
}
