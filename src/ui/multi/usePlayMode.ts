/**
 * Mode de jeu choisi sur la page « jouer » : choix, un seul téléphone, ou chacun son téléphone.
 * Si une salle multijoueur de ce jeu est en cours sur ce téléphone, on y retourne directement (reconnexion).
 */
import { useEffect, useState } from 'preact/hooks';
import { savedRoom } from './connect';
import type { GameSlug } from '~/games/meta';

export type PlayMode = 'choose' | 'local' | 'multi';

export function usePlayMode(game: GameSlug, adult: boolean): [PlayMode, (m: PlayMode) => void] {
  const [mode, setMode] = useState<PlayMode>('choose');
  useEffect(() => {
    const r = savedRoom.get();
    if (r && r.game === game && r.adult === adult) setMode('multi');
  }, [game, adult]);
  return [mode, setMode];
}
