#!/usr/bin/env node
// tests/levels.test.mjs - checks every level in ../levels.js.
//
// Run: node tests/levels.test.mjs   (from the word-wheel folder or anywhere)
// No dependencies. Rebuilds the word sets from tools/sources and
// tools/removed-words.txt on its own (it does not import the generator), then
// checks all 1,000 levels. Prints a summary; exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'tools', 'sources');
const REMOVED = path.join(ROOT, 'tools', 'removed-words.txt');
const LEVELS_FILE = path.join(ROOT, 'levels.js');

// ------------------------------------------------------------- word sets

const SIZES = [10, 20, 35, 40, 50, 55, 60];
const sizeOf = new Map();
for (const size of SIZES) {
  for (const kind of ['english-words', 'american-words']) {
    const text = fs.readFileSync(path.join(SRC, `${kind}.${size}`), 'latin1');
    for (const w of text.split(/\r?\n/)) {
      if (/^[a-z]+$/.test(w) && !sizeOf.has(w)) sizeOf.set(w, size);
    }
  }
}
const bad = new Set(fs.readFileSync(path.join(SRC, 'ldnoobw-en.txt'), 'utf8')
  .split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean));

const removedAny = new Set();   // both tiers: never in a grid
const blockTier = new Set();    // never accepted at all
if (fs.existsSync(REMOVED)) {
  for (const line of fs.readFileSync(REMOVED, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const [rawWord, rawTier = ''] = line.split('\t');
    const w = rawWord.trim().toLowerCase();
    const tier = rawTier.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (!/^[a-z]+$/.test(w) || tier === 'tier') continue;  // skip a header row
    removedAny.add(w);
    if (tier !== 'nogrid') blockTier.add(w);
  }
}

const gridEligible = (w, maxSize) => {
  const s = sizeOf.get(w);
  return s !== undefined && s <= maxSize && w.length >= 3 && w.length <= 7 &&
    !bad.has(w) && !removedAny.has(w);
};
const bonusEligible = (w) => sizeOf.has(w) && w.length >= 3 && !bad.has(w) && !blockTier.has(w);

// Every bonus-eligible word, grouped by its sorted letters.
const byKey = new Map();
for (const w of sizeOf.keys()) {
  if (!bonusEligible(w)) continue;
  const k = [...w].sort().join('');
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(w);
}

function formable(word, letters) {
  const pool = [...letters];
  for (const ch of word) {
    const i = pool.indexOf(ch);
    if (i < 0) return false;
    pool.splice(i, 1);
  }
  return true;
}

function allFormable(letters) {
  const L = [...letters].sort();
  const keys = new Set();
  for (let m = 1; m < (1 << L.length); m++) {
    let k = '';
    for (let i = 0; i < L.length; i++) if (m & (1 << i)) k += L[i];
    if (k.length >= 3) keys.add(k);
  }
  const out = new Set();
  for (const k of keys) for (const w of byKey.get(k) || []) out.add(w);
  return out;
}

// ------------------------------------------------------------- expectations

const rampLetters = (id) => (id <= 4 ? 3 : id <= 20 ? 4 : id <= 60 ? 5 : 6);
const BANDS = { 3: [2, 3], 4: [3, 5], 5: [4, 7], 6: [6, 10] };
const maxSizeFor = (id) => (id <= 60 ? 20 : 35);

// ------------------------------------------------------------- load

await import(pathToFileURL(LEVELS_FILE).href);
const LEVELS = globalThis.LEVELS;

const failures = [];
const fail = (id, msg) => { if (failures.length < 200) failures.push(`level ${id}: ${msg}`); else if (failures.length === 200) failures.push('...more failures not shown'); };

if (!Array.isArray(LEVELS)) {
  console.error('FAIL: globalThis.LEVELS is not an array');
  process.exit(1);
}
if (LEVELS.length !== 1000) fail('-', `expected 1000 levels, found ${LEVELS.length}`);

// ------------------------------------------------------------- per level

const seenLetterSets = new Map();   // sorted wheel letters -> level id
const seenBase = new Map();         // full-length grid word -> level id
const stats = {};                    // letters -> { levels, words[], maxRows, maxCols }
let bonusTotal = 0, gridTotal = 0, maxRows = 0, maxCols = 0, size35 = 0;

LEVELS.forEach((L, index) => {
  const id = L && L.id;
  if (id !== index + 1) fail(index + 1, `id is ${id}, expected ${index + 1}`);
  const n = rampLetters(index + 1);

  // Letters
  if (typeof L.letters !== 'string' || !/^[A-Z]+$/.test(L.letters)) { fail(id, `bad letters "${L.letters}"`); return; }
  if (L.letters.length !== n) fail(id, `${L.letters.length} letters, ramp says ${n}`);
  const letters = L.letters.toLowerCase();

  // Words
  if (!Array.isArray(L.words) || L.words.length < 2) { fail(id, 'fewer than 2 grid words'); return; }
  const [lo, hi] = BANDS[n] || [2, 99];
  if (L.words.length < lo || L.words.length > hi) fail(id, `${L.words.length} grid words, band is ${lo}-${hi}`);
  const words = [];
  for (const x of L.words) {
    if (typeof x.w !== 'string' || !/^[A-Z]{3,}$/.test(x.w)) { fail(id, `bad word ${JSON.stringify(x)}`); return; }
    if (x.d !== 'a' && x.d !== 'd') fail(id, `${x.w}: bad direction ${x.d}`);
    if (!Number.isInteger(x.r) || !Number.isInteger(x.c)) fail(id, `${x.w}: bad r/c`);
    const w = x.w.toLowerCase();
    words.push(w);
    if (!formable(w, letters)) fail(id, `${x.w} cannot be spelled from ${L.letters}`);
    if (!gridEligible(w, maxSizeFor(id))) {
      fail(id, `${x.w} is not grid-eligible for this level` + (removedAny.has(w) ? ' (in removed-words.txt)' : ''));
    }
    if (sizeOf.get(w) === 35) size35++;
  }
  if (new Set(words).size !== words.length) fail(id, 'a grid word repeats');

  // Plain plurals
  const set = new Set(words);
  for (const w of words) {
    if (set.has(w + 's') || set.has(w + 'es')) fail(id, `both ${w} and its plural`);
  }

  // Base word(s): grid words that use every wheel letter
  const full = words.filter((w) => w.length === letters.length);
  if (!full.length) fail(id, 'no grid word uses all the wheel letters');
  for (const w of full) {
    if (seenBase.has(w)) fail(id, `base word ${w} already used in level ${seenBase.get(w)}`);
    seenBase.set(w, id);
  }
  const sorted = [...letters].sort().join('');
  if (seenLetterSets.has(sorted)) fail(id, `same wheel letters as level ${seenLetterSets.get(sorted)}`);
  seenLetterSets.set(sorted, id);

  // Wheel order must not spell a grid word
  for (const w of words) {
    if (letters.includes(w)) fail(id, `wheel order ${L.letters} spells ${w.toUpperCase()}`);
  }

  // Bonus
  if (!Array.isArray(L.bonus)) { fail(id, 'bonus is not an array'); return; }
  const accepted = allFormable(letters);
  const bonusSet = new Set();
  for (const b of L.bonus) {
    if (typeof b !== 'string' || !/^[A-Z]{3,}$/.test(b)) { fail(id, `bad bonus word ${b}`); continue; }
    const w = b.toLowerCase();
    if (bonusSet.has(w)) fail(id, `bonus ${b} repeats`);
    bonusSet.add(w);
    if (!formable(w, letters)) fail(id, `bonus ${b} cannot be spelled from ${L.letters}`);
    if (!bonusEligible(w)) fail(id, `bonus ${b} is not bonus-eligible` + (blockTier.has(w) ? ' (block tier)' : ''));
    if (set.has(w)) fail(id, `bonus ${b} is also a grid word`);
  }
  for (const w of accepted) {
    if (!set.has(w) && !bonusSet.has(w)) fail(id, `accepted word ${w.toUpperCase()} missing from bonus`);
  }
  const sortedBonus = [...L.bonus].sort();
  if (sortedBonus.join() !== L.bonus.join()) fail(id, 'bonus list is not sorted');
  bonusTotal += L.bonus.length;
  gridTotal += words.length;

  // Grid geometry
  const { rows, cols } = L;
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) { fail(id, 'bad rows/cols'); return; }
  if (rows > 7 || cols > 7) fail(id, `grid ${rows}x${cols} is larger than 7x7`);
  maxRows = Math.max(maxRows, rows); maxCols = Math.max(maxCols, cols);
  const cell = new Map();       // "r,c" -> letter
  const owners = new Map();     // "r,c" -> [word index, ...]
  let minR = Infinity, minC = Infinity, maxR = -1, maxC = -1;
  L.words.forEach((x, wi) => {
    for (let i = 0; i < x.w.length; i++) {
      const r = x.r + (x.d === 'd' ? i : 0);
      const c = x.c + (x.d === 'a' ? i : 0);
      if (r < 0 || c < 0 || r >= rows || c >= cols) fail(id, `${x.w} runs outside the ${rows}x${cols} grid`);
      minR = Math.min(minR, r); minC = Math.min(minC, c); maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
      const k = `${r},${c}`;
      if (cell.has(k) && cell.get(k) !== x.w[i]) fail(id, `letters disagree at ${k}`);
      cell.set(k, x.w[i]);
      if (!owners.has(k)) owners.set(k, []);
      owners.get(k).push(wi);
    }
  });
  if (minR !== 0 || minC !== 0 || maxR !== rows - 1 || maxC !== cols - 1) fail(id, 'rows/cols are not the tight bounding box');

  // Every maximal run of 2+ letters is exactly one placed word
  const starts = new Map();
  for (const x of L.words) starts.set(`${x.d}:${x.r},${x.c}`, x);
  for (const d of ['a', 'd']) {
    const outerN = d === 'a' ? rows : cols, innerN = d === 'a' ? cols : rows;
    for (let o = 0; o < outerN; o++) {
      let i = 0;
      while (i < innerN) {
        const key = (j) => (d === 'a' ? `${o},${j}` : `${j},${o}`);
        if (!cell.has(key(i))) { i++; continue; }
        let j = i;
        let text = '';
        while (j < innerN && cell.has(key(j))) { text += cell.get(key(j)); j++; }
        if (text.length >= 2) {
          const [r, c] = key(i).split(',').map(Number);
          const x = starts.get(`${d}:${r},${c}`);
          if (!x || x.w !== text) fail(id, `${d === 'a' ? 'across' : 'down'} run "${text}" at ${r},${c} is not a placed word`);
        }
        i = j;
      }
    }
  }

  // Every word crosses another; the grid is connected
  const adj = L.words.map(() => new Set());
  for (const list of owners.values()) {
    for (const a of list) for (const b of list) if (a !== b) adj[a].add(b);
  }
  L.words.forEach((x, wi) => {
    if (!adj[wi].size) fail(id, `${x.w} does not cross another word`);
    for (const other of adj[wi]) if (L.words[other].d === x.d) fail(id, `${x.w} overlaps a parallel word`);
  });
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) for (const b of adj[stack.pop()]) if (!seen.has(b)) { seen.add(b); stack.push(b); }
  if (seen.size !== L.words.length) fail(id, 'grid is not connected');

  const s = (stats[n] ||= { levels: 0, counts: [] });
  s.levels++;
  s.counts.push(L.words.length);
});

// Level 1 is CAT / ACT
{
  const L1 = LEVELS[0];
  const ws = L1 ? L1.words.map((x) => x.w).sort().join(',') : '';
  if (!L1 || ws !== 'ACT,CAT' || [...L1.letters].sort().join('') !== 'ACT') fail(1, `must be CAT and ACT on the wheel C A T (got ${L1 && L1.letters}: ${ws})`);
}

// ------------------------------------------------------------- report

const kb = (fs.statSync(LEVELS_FILE).size / 1024).toFixed(0);
console.log('Word Wheel levels.test.mjs');
console.log(`  levels: ${LEVELS.length}   file: ${kb} KB   removed words: ${removedAny.size} (${blockTier.size} block)`);
for (const n of Object.keys(stats).sort()) {
  const c = stats[n].counts;
  const avg = (c.reduce((a, b) => a + b, 0) / c.length).toFixed(2);
  console.log(`  ${n} letters: ${stats[n].levels} levels, grid words avg ${avg}, min ${Math.min(...c)}, max ${Math.max(...c)} (band ${BANDS[n].join('-')})`);
}
console.log(`  grid words: ${gridTotal} (${size35} from SCOWL size 35)   bonus words: ${bonusTotal}`);
console.log(`  largest grid: ${maxRows} rows x ${maxCols} cols`);

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} problem(s)`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log('\nPASS: all levels OK');
