#!/usr/bin/env node
// Génère les images Open Graph (1200×630) et l'icône Apple (180×180) à partir de SVG, avec sharp.
// Usage : npm run og. Les PNG produits sont committés (pas de génération en CI).
// Couleurs : palette « neon » (voir src/styles/themes.css). À relancer si la palette change.

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/og');
mkdirSync(OUT, { recursive: true });

const BG = '#0d0a17';
const INK = '#140f1f';
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const COLORS = {
  rigolol: ['#ffd23f', '#ff8a1f'],
  mimos: ['#c47bff', '#ff5cc8'],
  takotac: ['#2ee6d6', '#3b9bff'],
};

const GAMES = {
  rigolol: { name: 'Rigolol', tagline: 'ESSAYE DE NE PAS RIRE', line: 'Fais rire tes amis… sans craquer !' },
  mimos: { name: 'Mimos', tagline: 'LE JEU DES MIMES', line: '60 secondes, 5 expressions, zéro mot.' },
  takotac: { name: 'Takotac', tagline: 'JEU DE RAPIDITÉ', line: 'Cite 3 trucs en 7 secondes chrono !' },
};

/** Dessins des jeux (mêmes tracés que src/components/GameIcon.astro), dans un repère 120×120. */
function icon(game, gid) {
  const fill = `url(#${gid})`;
  if (game === 'rigolol')
    return `<circle cx="60" cy="62" r="46" fill="${fill}"/>
      <path d="M33 50c4-7 13-7 17 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
      <path d="M70 50c4-7 13-7 17 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
      <path d="M32 66h56c0 17-12.5 28-28 28S32 83 32 66Z" fill="${INK}"/>
      <path d="M44 84c4.5-5 27.5-5 32 0-4.5 5.5-10 8-16 8s-11.5-2.5-16-8Z" fill="#ff6b8a"/>
      <path d="M18 52c-5 7-6 12-2 15s9-1 8-7c-.6-3-3-5.5-6-8Z" fill="#7cd3ff"/>
      <path d="M102 52c5 7 6 12 2 15s-9-1-8-7c.6-3 3-5.5 6-8Z" fill="#7cd3ff"/>`;
  if (game === 'mimos')
    return `<path d="M60 12c24 0 40 18 40 44 0 30-18 52-40 52S20 86 20 56c0-26 16-44 40-44Z" fill="${fill}"/>
      <path d="M30 30c6-14 22-20 36-18 14 2 25 10 26 20-18-5-44-6-62-2Z" fill="${INK}"/>
      <circle cx="74" cy="11" r="5" fill="${INK}"/>
      <path d="M44 48l6 9-6 9-6-9Z" fill="${INK}"/><path d="M76 48l6 9-6 9-6-9Z" fill="${INK}"/>
      <path d="M50 84c6 3 14 3 20 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <rect x="56" y="70" width="8" height="26" rx="4" fill="#ffffff" stroke="${INK}" stroke-width="3"/>`;
  return `<rect x="50" y="6" width="20" height="10" rx="4" fill="${INK}"/>
      <rect x="56" y="14" width="8" height="8" fill="${INK}"/>
      <path d="M92 26l7 7" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="60" cy="66" r="44" fill="${fill}"/>
      <circle cx="60" cy="66" r="34" fill="none" stroke="${INK}" stroke-width="4" stroke-dasharray="2 8.7"/>
      <path d="M66 34L42 72h16l-6 28 26-40H61l5-26Z" fill="${INK}"/>`;
}

const grad = (id, [a, b]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

const glow = (id, color) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

const logoMark = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 48})">
  <path d="M24 4c11.6 0 20 7.6 20 17.5S35.6 39 24 39c-2.2 0-4.3-.3-6.3-.8L9 43.5c-1 .6-2.2-.3-1.9-1.4l2-7.6C6 31.4 4 26.8 4 21.5 4 11.6 12.4 4 24 4Z" fill="url(#brand)"/>
  <circle cx="15" cy="21.5" r="3.4" fill="${INK}"/><circle cx="24" cy="21.5" r="3.4" fill="${INK}"/><circle cx="33" cy="21.5" r="3.4" fill="${INK}"/></g>`;

const brandGrad = `<linearGradient id="brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORS.rigolol[0]}"/><stop offset=".5" stop-color="${COLORS.mimos[0]}"/><stop offset="1" stop-color="${COLORS.takotac[0]}"/></linearGradient>`;

const footer = `${logoMark(80, 520, 56)}
  <text x="150" y="560" font-family="${FONT}" font-weight="800" font-size="30" fill="#f5f0ff">Jeux de soirée</text>
  <text x="1120" y="560" text-anchor="end" font-family="${FONT}" font-weight="600" font-size="26" fill="#b7aecf">Gratuit · sans appli</text>`;

function gameSvg(slug) {
  const g = GAMES[slug];
  const [c1, c2] = COLORS[slug];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${grad('acc', [c1, c2])}${glow('glow1', c1)}${glow('glow2', c2)}${brandGrad}</defs>
  <rect width="1200" height="630" fill="${BG}"/>
  <circle cx="980" cy="120" r="520" fill="url(#glow1)"/>
  <circle cx="80" cy="640" r="420" fill="url(#glow2)"/>
  <text x="80" y="170" font-family="${FONT}" font-weight="800" font-size="30" letter-spacing="4" fill="${c1}">${g.tagline}</text>
  <text x="74" y="320" font-family="${FONT}" font-weight="900" font-size="150" fill="url(#acc)">${g.name}</text>
  <text x="80" y="400" font-family="${FONT}" font-weight="600" font-size="40" fill="#f5f0ff">${g.line}</text>
  <g transform="translate(790 120) scale(3.1)">${icon(slug, 'acc')}</g>
  ${footer}
</svg>`;
}

function homeSvg() {
  const defs = Object.entries(COLORS).map(([s, c]) => grad(`g-${s}`, c)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${defs}${brandGrad}${glow('gl1', COLORS.mimos[0])}${glow('gl2', COLORS.rigolol[0])}${glow('gl3', COLORS.takotac[0])}</defs>
  <rect width="1200" height="630" fill="${BG}"/>
  <circle cx="1050" cy="80" r="460" fill="url(#gl1)"/>
  <circle cx="100" cy="600" r="380" fill="url(#gl2)"/>
  <circle cx="700" cy="660" r="300" fill="url(#gl3)"/>
  <text x="80" y="140" font-family="${FONT}" font-weight="800" font-size="30" letter-spacing="4" fill="${COLORS.mimos[0]}">RIGOLOL · MIMOS · TAKOTAC</text>
  <text x="74" y="260" font-family="${FONT}" font-weight="900" font-size="112" fill="url(#brand)">Jeux de soirée</text>
  <text x="80" y="335" font-family="${FONT}" font-weight="600" font-size="44" fill="#f5f0ff">entre amis, sur ton téléphone</text>
  <g transform="translate(560 360) scale(1.25)">${icon('rigolol', 'g-rigolol')}</g>
  <g transform="translate(730 360) scale(1.25)">${icon('mimos', 'g-mimos')}</g>
  <g transform="translate(900 360) scale(1.25)">${icon('takotac', 'g-takotac')}</g>
  ${footer}
</svg>`;
}

function appleIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <defs>${brandGrad}</defs><rect width="180" height="180" fill="${BG}"/>${logoMark(26, 30, 128)}</svg>`;
}

const jobs = [
  ...Object.keys(GAMES).map((slug) => [gameSvg(slug), join(OUT, `${slug}.png`)]),
  [homeSvg(), join(OUT, 'accueil.png')],
  [appleIconSvg(), join(ROOT, 'public/apple-touch-icon.png')],
];

for (const [svg, file] of jobs) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(file);
  console.log('✓', file.replace(ROOT, '.'));
}
