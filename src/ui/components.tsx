/**
 * Composants d'interface partagés par les 3 jeux (mode un seul téléphone, puis multijoueur).
 */
import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { muted, play, prefersReducedMotion, shareSite, toggleMute, vibrate } from './feedback';
import { useNow } from './hooks';
import type { RankingRow } from '~/games/core/players';

/* ------------------------------------------------------------------ Boutons */

type BtnVariant = 'primary' | 'ghost' | 'success' | 'danger';

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'xl';
}

export function Btn({ variant = 'primary', size = 'md', class: cls, type = 'button', ...rest }: BtnProps) {
  return <button type={type} class={`pbtn pbtn--${variant} ${size !== 'md' ? `pbtn--${size}` : ''} ${cls ?? ''}`} {...rest} />;
}

/* ------------------------------------------------------------------ Mise en page */

export function Screen(props: { children: ComponentChildren; actions?: ComponentChildren; center?: boolean; row?: boolean }) {
  return (
    <section class="screen">
      <div class={`screen__body ${props.center ? 'screen__body--center' : ''}`}>{props.children}</div>
      {props.actions && <div class={`screen__actions ${props.row ? 'screen__actions--row' : ''}`}>{props.actions}</div>}
    </section>
  );
}

const IconBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const IconSound = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M11 5L6 9H3v6h3l5 4V5z" />
    {off ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />}
  </svg>
);
const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * Barre du haut : retour à la page du jeu (hors partie) ou « Quitter » (en partie, avec confirmation),
 * titre, et bouton son.
 */
export function TopBar(props: { title: string; backHref: string; inGame: boolean; onQuit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <header class="topbar">
      {props.inGame ? (
        <button class="icon-btn" type="button" aria-label="Quitter la partie" onClick={() => setConfirm(true)}>
          <IconClose />
        </button>
      ) : (
        <a class="icon-btn" href={props.backHref} aria-label="Retour">
          <IconBack />
        </a>
      )}
      <p class="topbar__title">{props.title}</p>
      <button
        class="icon-btn"
        type="button"
        aria-pressed={!muted.value}
        aria-label={muted.value ? 'Activer le son' : 'Couper le son'}
        onClick={toggleMute}
      >
        <IconSound off={muted.value} />
      </button>
      {confirm && (
        <Dialog
          title="Quitter la partie ?"
          text="Les scores de cette partie seront perdus."
          confirmLabel="Quitter"
          onConfirm={() => {
            setConfirm(false);
            props.onQuit();
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </header>
  );
}

export function Dialog(props: { title: string; text: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && props.onCancel()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <h2 id="dialog-title">{props.title}</h2>
        <p>{props.text}</p>
        <Btn variant="ghost" onClick={props.onCancel}>
          {props.cancelLabel ?? 'Annuler'}
        </Btn>
        <Btn variant="danger" onClick={props.onConfirm}>
          {props.confirmLabel}
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Résultats et scores */

export function ResultBanner(props: { emoji: string; text: string; good: boolean }) {
  return (
    <div class={`result ${props.good ? 'result--good' : 'result--bad'}`} role="status">
      <span class="result__emoji" aria-hidden="true">
        {props.emoji}
      </span>
      <p class="result__text">{props.text}</p>
    </div>
  );
}

export function ScoreStrip(props: { items: { id: string; label: string; score: number }[] }) {
  return (
    <ul class="scores" aria-label="Scores">
      {props.items.map((i) => (
        <li key={i.id}>
          {i.label} <b>{i.score}</b>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ Écran « passe le téléphone » */

/**
 * Écran de transition du mode un seul téléphone : cache l'information secrète jusqu'à ce que le bon joueur
 * ait le téléphone en main et appuie.
 */
export function Handoff(props: {
  kicker: string;
  name: string;
  sub?: ComponentChildren;
  progress: string;
  banner?: ComponentChildren;
  scores?: ComponentChildren;
  buttonLabel: string;
  onReady: () => void;
}) {
  return (
    <Screen
      center
      actions={
        <Btn size="xl" onClick={props.onReady}>
          {props.buttonLabel}
        </Btn>
      }
    >
      {props.banner}
      <p class="progress">{props.progress}</p>
      <p class="kicker">{props.kicker}</p>
      <p class="big-name gradient-text">{props.name}</p>
      {props.sub}
      {props.scores && <div style="margin-top: var(--sp-4)">{props.scores}</div>}
    </Screen>
  );
}

/* ------------------------------------------------------------------ Chrono */

/**
 * Chrono circulaire. Appelle `onExpire` une seule fois quand l'échéance est passée
 * (y compris au retour d'une mise en veille). Tic sonore sur les 3 dernières secondes.
 */
export function Timer(props: { deadline: number; durationMs: number; onExpire: () => void; small?: boolean }) {
  const now = useNow(true, 100);
  const remaining = Math.max(0, props.deadline - now);
  const seconds = Math.ceil(remaining / 1000);
  const expired = remaining <= 0;
  const fired = useRef(false);
  const lastSecond = useRef(seconds);

  useEffect(() => {
    fired.current = false;
  }, [props.deadline]);

  useEffect(() => {
    if (seconds !== lastSecond.current) {
      lastSecond.current = seconds;
      if (seconds > 0 && seconds <= 3) {
        play('tick');
        vibrate(30);
      }
    }
    if (expired && !fired.current) {
      fired.current = true;
      play('buzzer');
      vibrate([200, 80, 200]);
      props.onExpire();
    }
  }, [seconds, expired]);

  const urgent = seconds <= 3;
  return (
    <div
      class={`timer ${props.small ? 'timer--small' : ''} ${urgent ? 'timer--urgent' : ''}`}
      style={{ '--p': String(remaining / props.durationMs) }}
      role="timer"
      aria-label={`${seconds} secondes restantes`}
    >
      <span class="timer__value" aria-hidden="true">
        {seconds}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ Confettis */

/** Pluie de confettis légère (canvas), ignorée si l'utilisateur préfère réduire les animations. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || prefersReducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(canvas);
    const colors = ['--accent', '--accent-2', '--rigolol-1', '--mimos-1', '--takotac-1'].map((v) => css.getPropertyValue(v).trim() || '#fff');
    const parts = Array.from({ length: 140 }, () => ({
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.5,
      vx: (Math.random() - 0.5) * 2.5,
      vy: 2 + Math.random() * 3.5,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)]!,
    }));
    const startAt = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const elapsed = t - startAt;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - 2500) / 1000);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < 3500) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas class="confetti" ref={ref} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ Fin de partie */

const MEDALS = ['🥇', '🥈', '🥉'];

export function EndScreen(props: {
  rows: { id: string; name: string; score: number; rank: number }[];
  gameName: string;
  shareUrl: string;
  onReplay: () => void;
  onEdit: () => void;
  footer?: ComponentChildren;
}) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    play('fanfare');
    vibrate([60, 40, 60, 40, 120]);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const winners = props.rows.filter((r) => r.rank === 1);
  const title =
    winners.length === 1 ? `${winners[0]!.name} gagne !` : `Égalité : ${joinNames(winners.map((w) => w.name))} !`;

  const share = async () => {
    const result = await shareSite({
      title: `${props.gameName} | Jeux de soirée`,
      text: `On vient de jouer à ${props.gameName}, c'était génial ! Gratuit et sans appli :`,
      url: props.shareUrl,
    });
    if (result === 'copied') setToast('Lien copié !');
  };

  return (
    <Screen
      actions={
        <>
          <Btn size="xl" onClick={props.onReplay}>
            Rejouer
          </Btn>
          <div class="screen__actions--row" style="display: flex; gap: var(--sp-2)">
            <Btn variant="ghost" onClick={props.onEdit} style="flex: 1">
              Modifier
            </Btn>
            <Btn variant="ghost" onClick={share} style="flex: 1">
              Partager
            </Btn>
          </div>
        </>
      }
    >
      <Confetti />
      <div style="text-align: center">
        <p class="kicker">Fin de la partie</p>
        <h1 class="big-name gradient-text" style="font-size: clamp(2rem, 9vw, 3rem)">
          {title}
        </h1>
      </div>
      <ol class="podium">
        {props.rows.map((r) => (
          <li key={r.id}>
            <span class="podium__rank" aria-label={`${r.rank}e`}>
              {MEDALS[r.rank - 1] ?? r.rank}
            </span>
            <span class="podium__name">{r.name}</span>
            <span class="podium__score">{r.score} pt{r.score > 1 ? 's' : ''}</span>
          </li>
        ))}
      </ol>
      {props.footer}
      {toast && (
        <p class="toast" role="status">
          {toast}
        </p>
      )}
    </Screen>
  );
}

export function rankingRows(rows: RankingRow[]) {
  return rows.map((r) => ({ id: r.player.id, name: r.player.name, score: r.score, rank: r.rank }));
}

/** Liste de prénoms lisible : « Léa », « Léa et Max », « Léa, Max et Tom ». */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}
