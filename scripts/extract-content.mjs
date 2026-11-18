#!/usr/bin/env node
// Extraction des contenus des anciens jeux Unity vers des JSON typés.
//
// Usage : npm run extract -- "<dossier parent des dossiers « ... - Scripts »>"
//
// Les scripts Unity ne sont pas versionnés : ce script lit les fichiers PhraseMaker.cs, fusionne les doublons,
// attribue des identifiants stables, pré-classe chaque entrée (tout_public / adulte) puis écrit :
//   - src/data/<jeu>/content.json
//   - docs/contenus-a-relire.md (entrées signalées hors packs No Limit, à valider à la main)
// Les corrections manuelles de classement vont dans src/data/audience-overrides.json : elles priment toujours.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, normalizeKey, splitNote, stableId } from './content-utils.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Description des 3 jeux : dossier source, packs (nom Unity → id web) et types d'entrées. */
const GAMES = {
  rigolol: {
    folder: 'Essaye de ne pas rire RIGOLOL - Scripts',
    packs: [
      { unity: 'Tout doux', id: 'tout-doux', label: 'Tout doux', audience: 'tout_public' },
      { unity: 'Films', id: 'films', label: 'Films', audience: 'tout_public' },
      { unity: 'No Limit', id: 'no-limit', label: 'No Limit', audience: 'adulte' },
    ],
    kinds: { Phrase: 'phrases' },
    prefix: 'r',
  },
  mimos: {
    folder: 'Mimos - Scripts',
    packs: [
      { unity: 'Tout doux', id: 'tout-doux', label: 'Tout doux', audience: 'tout_public' },
      { unity: 'Célébrités', id: 'celebrites', label: 'Célébrités', audience: 'tout_public' },
      { unity: 'No Limit', id: 'no-limit', label: 'No Limit', audience: 'adulte' },
    ],
    kinds: { Sujet: 'subjects', Action: 'actions' },
    prefix: 'm',
  },
  takotac: {
    folder: 'Takotac - Scripts',
    packs: [
      { unity: 'Tout doux', id: 'tout-doux', label: 'Tout doux', audience: 'tout_public' },
      { unity: 'Culture G', id: 'culture-g', label: 'Culture G', audience: 'tout_public' },
      { unity: 'No Limit', id: 'no-limit', label: 'No Limit', audience: 'adulte' },
    ],
    kinds: { Phrase: 'categories' },
    prefix: 't',
  },
};

/** Lit un fichier texte en détectant l'encodage (UTF-8 avec/sans BOM, UTF-16 LE/BE). */
function readText(path) {
  const buf = readFileSync(path);
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  return new TextDecoder('utf-8').decode(buf).replace(/^﻿/, '');
}

/**
 * Lit un littéral de chaîne C# classique ("...") à partir de l'index du guillemet ouvrant.
 * Retourne la valeur décodée et l'index qui suit le guillemet fermant.
 */
function readCsString(src, start) {
  if (src[start] !== '"') throw new Error(`Littéral attendu à l'index ${start}`);
  let out = '';
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const n = src[i + 1];
      const map = { n: '\n', t: '\t', r: '', '"': '"', '\\': '\\', "'": "'", 0: '' };
      if (n === 'u') {
        out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      out += map[n] ?? n;
      i += 2;
      continue;
    }
    if (c === '"') return { value: out, end: i + 1 };
    out += c;
    i++;
  }
  throw new Error('Littéral non terminé');
}

/** Extrait toutes les entrées `new <Kind>Data("catégorie", "texte")` d'un fichier C# (hors lignes commentées). */
function parseEntries(src) {
  const entries = [];
  const re = /new\s+(\w+)Data\s*\(\s*"/g;
  let m;
  while ((m = re.exec(src))) {
    // Ignore les entrées en commentaire de ligne
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    if (/^\s*\/\//.test(src.slice(lineStart, m.index))) continue;
    const first = readCsString(src, m.index + m[0].length - 1);
    const comma = src.indexOf('"', first.end);
    const second = readCsString(src, comma);
    entries.push({ kind: m[1], category: first.value, text: second.value });
    re.lastIndex = second.end;
  }
  return entries;
}

function main() {
  const sourceRoot = process.argv[2];
  if (!sourceRoot || !existsSync(sourceRoot)) {
    console.error('Usage : npm run extract -- "<dossier contenant les dossiers « ... - Scripts »>"');
    process.exit(1);
  }
  const overridesPath = join(ROOT, 'src/data/audience-overrides.json');
  /** @type {Record<string, 'tout_public' | 'adulte'>} */
  const overrides = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {};

  const review = [];
  const summary = [];

  for (const [game, cfg] of Object.entries(GAMES)) {
    const src = readText(join(sourceRoot, cfg.folder, 'PhraseMaker.cs'));
    const raw = parseEntries(src);
    const packByUnity = new Map(cfg.packs.map((p) => [p.unity, p]));

    /** @type {Record<string, Map<string, any>>} une Map par type d'entrée, clé = texte normalisé */
    const buckets = Object.fromEntries(Object.values(cfg.kinds).map((k) => [k, new Map()]));
    let duplicates = 0;

    for (const e of raw) {
      const kindKey = cfg.kinds[e.kind];
      const pack = packByUnity.get(e.category);
      if (!kindKey || !pack) throw new Error(`${game} : entrée inconnue ${e.kind} / ${e.category}`);
      const { text, note } = splitNote(e.text.trim().replace(/\s+/g, ' '));
      const key = normalizeKey(text + (note ? ` (${note})` : ''));
      const bucket = buckets[kindKey];
      const existing = bucket.get(key);
      if (existing) {
        duplicates++;
        if (!existing.packs.includes(pack.id)) existing.packs.push(pack.id);
        continue;
      }
      bucket.set(key, { id: stableId(cfg.prefix, kindKey, key), packs: [pack.id], text, ...(note ? { note } : {}) });
    }

    const out = { game, packs: cfg.packs.map(({ unity, ...p }) => p) };
    const adultPacks = new Set(cfg.packs.filter((p) => p.audience === 'adulte').map((p) => p.id));
    for (const [kindKey, bucket] of Object.entries(buckets)) {
      const ids = new Set();
      out[kindKey] = [...bucket.values()].map((entry) => {
        if (ids.has(entry.id)) throw new Error(`Collision d'identifiant ${entry.id}`);
        ids.add(entry.id);
        const onlyAdultPacks = entry.packs.every((p) => adultPacks.has(p));
        const auto = onlyAdultPacks ? { audience: 'adulte', reason: 'pack' } : classify(entry.text, entry.note);
        const audience = overrides[entry.id] ?? auto.audience;
        if (!onlyAdultPacks && auto.reason !== 'aucun') {
          review.push({ game, kindKey, ...entry, audience, reason: auto.reason, overridden: entry.id in overrides });
        }
        return { ...entry, audience };
      });
      const adults = out[kindKey].filter((x) => x.audience === 'adulte').length;
      summary.push(`${game}.${kindKey} : ${out[kindKey].length} entrées (${adults} adulte)`);
    }

    summary.push(`${game} : ${duplicates} doublons fusionnés`);
    const dir = join(ROOT, 'src/data', game);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'content.json'), toJsonLines(out));
  }

  writeReview(review);
  console.log(summary.join('\n'));
  console.log(`${review.length} entrées hors No Limit à relire → docs/contenus-a-relire.md`);
}

/** JSON valide avec une entrée par ligne : compact et lisible dans les diffs git. */
function toJsonLines(obj) {
  const parts = Object.entries(obj).map(([k, v]) => {
    if (!Array.isArray(v)) return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
    return `  ${JSON.stringify(k)}: [\n${v.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`;
  });
  return `{\n${parts.join(',\n')}\n}\n`;
}

/** Écrit la liste des entrées signalées, pour relecture humaine. */
function writeReview(review) {
  const lines = [
    '# Contenus à relire',
    '',
    'Généré par `npm run extract`. Entrées des packs **tout public** que le pré-classement a signalées.',
    'Une entrée `adulte` n\'est tirée **que si la partie inclut un pack 18+** ; rien n\'est supprimé.',
    '',
    'Pour corriger un classement : ajouter `"<id>": "tout_public"` (ou `"adulte"`) dans',
    '`src/data/audience-overrides.json`, puis relancer `npm run extract`.',
    '',
  ];
  let current = '';
  for (const r of review) {
    const section = `${r.game} — ${r.kindKey}`;
    if (section !== current) {
      lines.push('', `## ${section}`, '', '| id | packs | classement | motif | texte |', '|---|---|---|---|---|');
      current = section;
    }
    const text = (r.text + (r.note ? ` (${r.note})` : '')).replace(/\|/g, '\\|');
    lines.push(`| \`${r.id}\` | ${r.packs.join(', ')} | ${r.audience}${r.overridden ? ' ✋' : ''} | ${r.reason} | ${text} |`);
  }
  writeFileSync(join(ROOT, 'docs/contenus-a-relire.md'), lines.join('\n') + '\n');
}

main();
