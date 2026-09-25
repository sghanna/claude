#!/usr/bin/env node
// tools/generate.mjs - builds ../levels.js (1,000 Word Wheel levels).
//
// Run from anywhere:   node tools/generate.mjs
// No dependencies. Seeded and deterministic: the same inputs always give the
// same levels.js, byte for byte. Inputs:
//   tools/sources/english-words.N, american-words.N   SCOWL final lists (Latin-1)
//   tools/sources/ldnoobw-en.txt                      bad-word list
//   tools/removed-words.txt (optional)                word<TAB>tier<TAB>reason,
//       tier "block"  = never a grid word, never accepted as a bonus word
//       tier "nogrid" = never a grid word, still accepted as a bonus word
//
// Word sets:
//   grid-eligible   SCOWL english+american sizes 10/20/35, a-z, 3-7 letters,
//                   minus LDNOOBW, minus every word in removed-words.txt.
//                   Levels 1-60 use only sizes 10 and 20.
//   bonus-eligible  SCOWL sizes 10-60, a-z, 3+ letters, minus LDNOOBW,
//                   minus block-tier words.
//
// Each level: a base word that uses every wheel letter, the other grid words
// found inside it, a connected crossword within 7x7 where every across/down
// run of 2+ letters is exactly one placed word, a shuffled wheel that does not
// spell a grid word, and every other acceptable word as a bonus word.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(HERE, 'sources');
const REMOVED = path.join(HERE, 'removed-words.txt');
const OUT = path.join(ROOT, 'levels.js');

const SEED = 20260924;
const LEVEL_COUNT = 1000;
const MAX_ROWS = 7;
const MAX_COLS = 7;
const SIZES = [10, 20, 35, 40, 50, 55, 60];
const EASY_MAX_SIZE = 20;   // levels 1-60
const GRID_MAX_SIZE = 35;   // levels 61+
const EASY_LAST_LEVEL = 60;
const LAYOUT_ATTEMPTS = 160;
const PREFERRED_TRIPLES = ['own', 'are', 'tap', 'eat', 'top'];

// ---------------------------------------------------------------- helpers

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash32(str) {           // FNV-1a
  let h = 0x811c9dc5 ^ SEED;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const rngFor = (label) => mulberry32(hash32(label));
const sortKey = (w) => [...w].sort().join('');

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------- word sets

function readScowl(file) {
  const p = path.join(SRC, file);
  if (!fs.existsSync(p)) throw new Error(`Missing source list: ${p}`);
  return fs.readFileSync(p, 'latin1').split(/\r?\n/).filter((w) => /^[a-z]+$/.test(w));
}

const sizeOf = new Map();  // word -> smallest SCOWL size it appears in
for (const size of SIZES) {
  for (const kind of ['english-words', 'american-words']) {
    for (const w of readScowl(`${kind}.${size}`)) if (!sizeOf.has(w)) sizeOf.set(w, size);
  }
}

const bad = new Set(
  fs.readFileSync(path.join(SRC, 'ldnoobw-en.txt'), 'utf8')
    .split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean)
);

const blockTier = new Set();
const nogridTier = new Set();
if (fs.existsSync(REMOVED)) {
  for (const line of fs.readFileSync(REMOVED, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const [rawWord, rawTier = ''] = line.split('\t');
    const word = rawWord.trim().toLowerCase();
    const tier = rawTier.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (!/^[a-z]+$/.test(word) || tier === 'tier') continue;  // skip a header row
    // Anything not clearly "nogrid" is treated as "block" (the safer tier).
    if (tier === 'nogrid') nogridTier.add(word); else blockTier.add(word);
  }
}
// A word listed in both tiers is blocked.
for (const w of blockTier) nogridTier.delete(w);

function gridEligible(w, maxSize) {
  const s = sizeOf.get(w);
  return s !== undefined && s <= maxSize && w.length >= 3 && w.length <= 7 &&
    !bad.has(w) && !blockTier.has(w) && !nogridTier.has(w);
}

function bonusEligible(w) {
  return sizeOf.has(w) && w.length >= 3 && !bad.has(w) && !blockTier.has(w);
}

// sorted-letters key -> bonus-eligible words (grid-eligible words are a subset)
const byKey = new Map();
for (const w of sizeOf.keys()) {
  if (!bonusEligible(w)) continue;
  const k = sortKey(w);
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(w);
}
for (const list of byKey.values()) list.sort();

// Every accepted word (3+ letters) formable from the letters, each used once.
function formableWords(letters) {
  const L = [...letters].sort();
  const n = L.length;
  const keys = new Set();
  for (let m = 1; m < (1 << n); m++) {
    let k = '';
    for (let i = 0; i < n; i++) if (m & (1 << i)) k += L[i];
    if (k.length >= 3) keys.add(k);
  }
  const out = [];
  for (const k of keys) for (const w of byKey.get(k) || []) out.push(w);
  return out.sort();
}

// "Plain plural": word + s or word + es.
function pluralPair(a, b) {
  return b === a + 's' || b === a + 'es' || a === b + 's' || a === b + 'es';
}

// ---------------------------------------------------------------- crossword

const GW = 40;       // working canvas; coordinates stay well inside it
const OFF = 16;

function newGrid() {
  return {
    ch: new Uint8Array(GW * GW),        // 0 = empty, else char code
    ac: new Int16Array(GW * GW).fill(-1), // index of across word using the cell
    dn: new Int16Array(GW * GW).fill(-1), // index of down word using the cell
    cells: [],
    words: [],                          // { w, r, c, d }
    minR: 0, maxR: -1, minC: 0, maxC: -1,
    crossings: 0,
  };
}

const at = (r, c) => (r + OFF) * GW + (c + OFF);

// Returns the number of crossings if the word can go at (r, c, d), else -1.
function canPlace(g, w, r, c, d) {
  const len = w.length;
  const dr = d === 'd' ? 1 : 0;
  const dc = d === 'a' ? 1 : 0;
  const r2 = r + dr * (len - 1);
  const c2 = c + dc * (len - 1);
  if (g.words.length) {
    const minR = Math.min(g.minR, r), maxR = Math.max(g.maxR, r2);
    const minC = Math.min(g.minC, c), maxC = Math.max(g.maxC, c2);
    if (maxR - minR + 1 > MAX_ROWS || maxC - minC + 1 > MAX_COLS) return -1;
  } else if (r2 - r + 1 > MAX_ROWS || c2 - c + 1 > MAX_COLS) return -1;
  if (g.ch[at(r - dr, c - dc)] || g.ch[at(r2 + dr, c2 + dc)]) return -1;
  let cross = 0;
  for (let i = 0; i < len; i++) {
    const rr = r + dr * i, cc = c + dc * i;
    const idx = at(rr, cc);
    const code = w.charCodeAt(i);
    if (g.ch[idx]) {
      if (g.ch[idx] !== code) return -1;
      if ((d === 'a' ? g.ac[idx] : g.dn[idx]) >= 0) return -1;
      cross++;
    } else if (g.ch[at(rr + dc, cc + dr)] || g.ch[at(rr - dc, cc - dr)]) {
      return -1;  // a new letter may not touch a parallel neighbor
    }
  }
  if (g.words.length && (cross === 0 || cross === len)) return -1;
  return cross;
}

function place(g, w, r, c, d, cross) {
  const wi = g.words.length;
  const dr = d === 'd' ? 1 : 0;
  const dc = d === 'a' ? 1 : 0;
  for (let i = 0; i < w.length; i++) {
    const idx = at(r + dr * i, c + dc * i);
    if (!g.ch[idx]) { g.ch[idx] = w.charCodeAt(i); g.cells.push(idx); }
    if (d === 'a') g.ac[idx] = wi; else g.dn[idx] = wi;
  }
  const r2 = r + dr * (w.length - 1), c2 = c + dc * (w.length - 1);
  if (!wi) { g.minR = r; g.maxR = r2; g.minC = c; g.maxC = c2; } else {
    g.minR = Math.min(g.minR, r); g.maxR = Math.max(g.maxR, r2);
    g.minC = Math.min(g.minC, c); g.maxC = Math.max(g.maxC, c2);
  }
  g.crossings += cross;
  g.words.push({ w, r, c, d });
}

function placements(g, w) {
  const out = [];
  const seen = new Set();
  for (const idx of g.cells) {
    const code = g.ch[idx];
    const r = Math.floor(idx / GW) - OFF, c = (idx % GW) - OFF;
    for (let i = 0; i < w.length; i++) {
      if (w.charCodeAt(i) !== code) continue;
      if (g.ac[idx] < 0) {
        const key = `a${r},${c - i}`;
        if (!seen.has(key)) {
          seen.add(key);
          const x = canPlace(g, w, r, c - i, 'a');
          if (x > 0) out.push({ r, c: c - i, d: 'a', cross: x });
        }
      }
      if (g.dn[idx] < 0) {
        const key = `d${r - i},${c}`;
        if (!seen.has(key)) {
          seen.add(key);
          const x = canPlace(g, w, r - i, c, 'd');
          if (x > 0) out.push({ r: r - i, c, d: 'd', cross: x });
        }
      }
    }
  }
  return out;
}

function shapeAfter(g, w, p) {
  const r2 = p.r + (p.d === 'd' ? w.length - 1 : 0);
  const c2 = p.c + (p.d === 'a' ? w.length - 1 : 0);
  const rows = Math.max(g.maxR, r2) - Math.min(g.minR, p.r) + 1;
  const cols = Math.max(g.maxC, c2) - Math.min(g.minC, p.c) + 1;
  return { rows, cols };
}

const famBonus = (w) => {
  const s = sizeOf.get(w);
  return s <= 10 ? 0.6 : s <= 20 ? 0.3 : -1.2;
};

// One randomized greedy build: base first, then the pool in a jittered
// longest-and-most-familiar-first order; words that do not fit are skipped.
function buildOnce(base, pool, target, rng) {
  const g = newGrid();
  place(g, base, 0, 0, rng() < 0.7 ? 'a' : 'd', 0);
  const order = pool
    .map((w) => ({ w, k: w.length + famBonus(w) + rng() * 2.2 }))
    .sort((a, b) => b.k - a.k || (a.w < b.w ? -1 : 1))
    .map((x) => x.w);
  const used = new Set([base]);
  while (g.words.length < target) {
    let placed = false;
    for (const w of order) {
      if (used.has(w)) continue;
      let clash = false;
      for (const u of used) if (pluralPair(u, w)) { clash = true; break; }
      if (clash) continue;
      const ps = placements(g, w);
      if (!ps.length) continue;
      let best = null, bestScore = -Infinity;
      for (const p of ps) {
        const { rows, cols } = shapeAfter(g, w, p);
        const s = p.cross * 3 - rows * cols * 0.25 - Math.abs(rows - cols) * 0.6 + rng() * 2.5;
        if (s > bestScore) { bestScore = s; best = p; }
      }
      place(g, w, best.r, best.c, best.d, best.cross);
      used.add(w);
      placed = true;
      break;
    }
    if (!placed) break;
  }
  return g;
}

function layoutScore(g) {
  const rows = g.maxR - g.minR + 1, cols = g.maxC - g.minC + 1;
  let fam = 0;
  for (const x of g.words) fam += famBonus(x.w);
  return g.words.length * 1000 + g.crossings * 4 - rows * cols * 0.5 -
    Math.abs(rows - cols) * 2 + fam * 1.5;
}

const layoutCache = new Map();
function bestLayout(base, pool, target) {
  const cacheKey = `${base}|${target}|${pool.join(',')}`;
  if (layoutCache.has(cacheKey)) return layoutCache.get(cacheKey);
  const rng = rngFor(`layout:${base}:${target}`);
  let best = null, bestScore = -Infinity, hits = 0;
  for (let t = 0; t < LAYOUT_ATTEMPTS; t++) {
    const g = buildOnce(base, pool, target, rng);
    const s = layoutScore(g);
    if (s > bestScore) { best = g; bestScore = s; }
    if (g.words.length === target && ++hits >= 40) break;
  }
  layoutCache.set(cacheKey, best);
  return best;
}

function normalize(g) {
  return {
    rows: g.maxR - g.minR + 1,
    cols: g.maxC - g.minC + 1,
    words: g.words.map((x) => ({ w: x.w, r: x.r - g.minR, c: x.c - g.minC, d: x.d })),
  };
}

// Independent check of a finished layout (same rules as tests/levels.test.mjs).
function checkLayout(lay) {
  const cell = new Map();
  const put = (r, c, ch) => {
    const k = r * 16 + c;
    if (cell.has(k) && cell.get(k) !== ch) throw new Error('letter clash');
    cell.set(k, ch);
  };
  for (const x of lay.words) {
    for (let i = 0; i < x.w.length; i++) {
      const r = x.r + (x.d === 'd' ? i : 0), c = x.c + (x.d === 'a' ? i : 0);
      if (r < 0 || c < 0 || r >= lay.rows || c >= lay.cols) throw new Error('out of bounds');
      put(r, c, x.w[i]);
    }
  }
  const starts = new Set(lay.words.map((x) => `${x.d}${x.r},${x.c},${x.w.length}`));
  const has = (r, c) => cell.has(r * 16 + c);
  for (const d of ['a', 'd']) {
    const outer = d === 'a' ? lay.rows : lay.cols, inner = d === 'a' ? lay.cols : lay.rows;
    for (let o = 0; o < outer; o++) {
      let i = 0;
      while (i < inner) {
        const occ = (j) => (d === 'a' ? has(o, j) : has(j, o));
        if (!occ(i)) { i++; continue; }
        let j = i;
        while (j < inner && occ(j)) j++;
        if (j - i >= 2) {
          const key = d === 'a' ? `a${o},${i},${j - i}` : `d${i},${o},${j - i}`;
          if (!starts.has(key)) throw new Error(`stray run ${key}`);
        }
        i = j;
      }
    }
  }
}

// ---------------------------------------------------------------- wheel

// Returns { letters, clean }. clean = the order spells no grid word and is not
// itself a full-length word.
function shuffleWheel(base, gridWords, fullLength, rng) {
  const upperGrid = gridWords.map((w) => w.toUpperCase());
  let best = null, bestPen = Infinity;
  for (let t = 0; t < 400; t++) {
    const s = shuffleInPlace([...base.toUpperCase()], rng).join('');
    let pen = fullLength.has(s) ? 1000 : 0;
    for (const g of upperGrid) if (s.includes(g)) pen += g.length * 10;
    if (pen < bestPen) { bestPen = pen; best = s; if (!pen) break; }
  }
  return { letters: best, clean: bestPen === 0 };
}

// ---------------------------------------------------------------- plan

function letterCount(id) {
  if (id <= 4) return 3;
  if (id <= 20) return 4;
  if (id <= 60) return 5;
  return 6;
}

const BANDS = { 3: [2, 3], 4: [3, 5], 5: [4, 7], 6: [6, 10] };
const BAND_START = { 3: 1, 4: 5, 5: 21, 6: 61 };
const BAND_END = { 3: 4, 4: 20, 5: 60, 6: LEVEL_COUNT };

// Target grid-word count: starts at the low end of the band and drifts up,
// with a little seeded jitter from level 21 on.
function targetCount(id) {
  const n = letterCount(id);
  const [lo, hi] = BANDS[n];
  if (n === 3) return id === 1 ? 2 : 3;
  const span = BAND_END[n] - BAND_START[n] + 1;
  const p = (id - BAND_START[n]) / span;
  let t = lo + Math.floor(p * (hi - lo + 1));
  if (n >= 5) {
    const x = rngFor(`target:${id}`)();
    if (x < 0.25) t -= 1; else if (x > 0.9) t += 1;
  }
  return Math.max(lo, Math.min(hi, t));
}

// ---------------------------------------------------------------- build

function buildLevel(base, gridWordsPool, target) {
  const pool = gridWordsPool.filter((w) => w !== base && !pluralPair(base, w));
  return bestLayout(base, pool, target);
}

// Adds the wheel and bonus words. Returns null if no wheel order avoids
// spelling a grid word (the caller then tries another base word).
function finishLevel(id, lay, fixedLetters) {
  const gridWords = lay.words.map((x) => x.w);
  const base = gridWords[0];
  const all = formableWords(base);
  const fullLength = new Set(all.filter((w) => w.length === base.length).map((w) => w.toUpperCase()));
  let letters = fixedLetters;
  if (!letters) {
    const wheel = shuffleWheel(base, gridWords, fullLength, rngFor(`wheel:${id}:${base}`));
    if (!wheel.clean) return null;
    letters = wheel.letters;
  }
  const gridSet = new Set(gridWords);
  const bonus = all.filter((w) => !gridSet.has(w)).map((w) => w.toUpperCase());
  checkLayout(lay);
  return {
    id,
    letters,
    rows: lay.rows,
    cols: lay.cols,
    words: lay.words.map((x) => ({ w: x.w.toUpperCase(), r: x.r, c: x.c, d: x.d })),
    bonus,
  };
}

const t0 = Date.now();
const levels = [];
const usedKeys = new Set();   // sorted letters of every level's wheel

// Level 1: fixed. Wheel T C A, CAT across, ACT down through the A.
{
  for (const w of ['cat', 'act']) {
    if (!gridEligible(w, EASY_MAX_SIZE)) throw new Error(`Level 1 needs "${w}" but it is not grid-eligible`);
  }
  levels.push(finishLevel(1, {
    rows: 3, cols: 3,
    words: [{ w: 'cat', r: 0, c: 0, d: 'a' }, { w: 'act', r: 0, c: 1, d: 'd' }],
  }, 'TCA'));
  usedKeys.add(sortKey('cat'));
}

// Levels 2-4: 3-letter anagram sets from sizes 10/20.
{
  const sets = new Map();
  for (const w of sizeOf.keys()) {
    if (w.length !== 3 || !gridEligible(w, EASY_MAX_SIZE)) continue;
    const k = sortKey(w);
    if (!sets.has(k)) sets.set(k, []);
    sets.get(k).push(w);
  }
  const ordered = [...sets.entries()]
    .filter(([k, ws]) => ws.length >= 2 && !usedKeys.has(k))
    .map(([k, ws]) => {
      const pref = PREFERRED_TRIPLES.findIndex((p) => ws.includes(p));
      return { k, ws: ws.sort(), rank: (pref < 0 ? 100 : pref) + (ws.length >= 3 ? 0 : 1000) };
    })
    .sort((a, b) => a.rank - b.rank || (a.k < b.k ? -1 : 1));
  for (let id = 2; id <= 4; id++) {
    const set = ordered.shift();
    if (!set) throw new Error('Not enough 3-letter anagram sets');
    const pref = PREFERRED_TRIPLES.find((p) => set.ws.includes(p));
    const base = pref || set.ws[0];
    const target = Math.min(targetCount(id), set.ws.length);
    const g = buildLevel(base, set.ws, target);
    const level = g.words.length >= 2 ? finishLevel(id, normalize(g)) : null;
    if (!level) throw new Error(`Level ${id}: could not build a level from ${set.ws}`);
    levels.push(level);
    usedKeys.add(set.k);
  }
}

// Levels 5-1000: base words of 4, 5 and 6 letters.
const candidateCache = new Map();
function candidates(n, maxSize) {
  const ck = `${n}:${maxSize}`;
  if (candidateCache.has(ck)) return candidateCache.get(ck);
  const list = [];
  for (const w of sizeOf.keys()) {
    if (w.length !== n || !gridEligible(w, maxSize)) continue;
    const sub = formableWords(w).filter((x) => gridEligible(x, maxSize));
    const pool = sub.filter((x) => x !== w && !pluralPair(w, x));
    if (pool.length + 1 < BANDS[n][0]) continue;
    const plural = (w.endsWith('s') && sizeOf.has(w.slice(0, -1))) ? 1.5 : 0;
    const sizePen = sizeOf.get(w) <= 10 ? 0 : sizeOf.get(w) <= 20 ? 0.6 : 2.2;
    const k = sizePen + plural + rngFor(`order:${w}`)() * 2.5;
    list.push({ w, key: sortKey(w), sub, k });
  }
  list.sort((a, b) => a.k - b.k || (a.w < b.w ? -1 : 1));
  candidateCache.set(ck, list);
  return list;
}

for (let id = 5; id <= LEVEL_COUNT; id++) {
  const n = letterCount(id);
  const maxSize = id <= EASY_LAST_LEVEL ? EASY_MAX_SIZE : GRID_MAX_SIZE;
  const [lo] = BANDS[n];
  const target = targetCount(id);
  const list = candidates(n, maxSize);
  let chosen = null, fallback = null, tried = 0;
  for (const cand of list) {
    if (usedKeys.has(cand.key)) continue;
    if (cand.sub.length < lo) continue;
    if (cand.cap !== undefined && cand.cap < target - 1) continue;
    tried++;
    const g = buildLevel(cand.w, cand.sub, target);
    const count = g.words.length;
    if (count < target) cand.cap = Math.min(cand.cap ?? 99, count);
    if (count === target || (!fallback && count >= Math.max(lo, target - 1))) {
      const level = finishLevel(id, normalize(g));
      if (level && count === target) { chosen = { cand, level }; break; }
      if (level) fallback = { cand, level };
    }
    if (fallback && tried >= 30) break;
  }
  if (!chosen) chosen = fallback;
  if (!chosen) throw new Error(`Level ${id}: no base word could be laid out`);
  levels.push(chosen.level);
  usedKeys.add(chosen.cand.key);
}

// ---------------------------------------------------------------- write

const jsStr = (s) => JSON.stringify(s);
function levelLine(L) {
  const words = L.words.map((x) => `{w:${jsStr(x.w)},r:${x.r},c:${x.c},d:${jsStr(x.d)}}`).join(',');
  const bonus = L.bonus.map(jsStr).join(',');
  return `{id:${L.id},letters:${jsStr(L.letters)},rows:${L.rows},cols:${L.cols},words:[${words}],bonus:[${bonus}]}`;
}

const perCount = {};
let gridTotal = 0, bonusTotal = 0;
for (const L of levels) {
  perCount[L.letters.length] = (perCount[L.letters.length] || 0) + 1;
  gridTotal += L.words.length;
  bonusTotal += L.bonus.length;
}

const header = [
  '/* Word Wheel levels. Generated by tools/generate.mjs - do not edit by hand.',
  `   ${levels.length} levels (${Object.entries(perCount).map(([k, v]) => `${v} with ${k} letters`).join(', ')}),`,
  `   ${gridTotal} grid words, ${bonusTotal} bonus words. Seed ${SEED}.`,
  `   Removed words applied: ${blockTier.size + nogridTier.size} (${blockTier.size} block, ${nogridTier.size} nogrid).`,
  '   Format: { id, letters (wheel order), rows, cols, words: [{ w, r, c, d: "a"|"d" }], bonus: [...] }.',
  '   words[0] is the base word that uses every wheel letter. */',
];
const body = `${header.join('\n')}\nglobalThis.LEVELS = [\n${levels.map(levelLine).join(',\n')}\n];\n`;
fs.writeFileSync(OUT, body);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`Wrote ${path.relative(process.cwd(), OUT) || OUT}: ${levels.length} levels, ` +
  `${gridTotal} grid words, ${bonusTotal} bonus words, ${(body.length / 1024).toFixed(0)} KB, ` +
  `removed words ${blockTier.size + nogridTier.size}, ${secs}s`);
