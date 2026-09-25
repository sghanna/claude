// Screen tests for Word Wheel in WebKit (Safari's engine), styled after ~/claude/hearts/tests/ui.test.mjs.
// Needs the game served, e.g.:
//   python3 -m http.server 8767 --bind 127.0.0.1   (from ~/claude, so the URL is .../word-wheel/)
//   node word-wheel/tests/ui.test.mjs [baseUrl]     (from ~/claude)
//
// Shared-contract notes this file relies on (see .work/word-wheel-prompt.md):
//   window.LEVELS[i]: { id (1-based), letters (uppercase, wheel order), rows, cols,
//                        words: [{ w, r, c, d:'a'|'d' }], bonus: [...] }
//   window.__wordwheel: { state(), level(), letterCenter(i)->{x,y}, cellRect(r,c)->{x,y,width,height}, rules, saveKey }
//   state(): { levelIndex (0-based), found[], revealed[], bonusFound[], current }
//   ?level=N uses the 1-based level id (so state().levelIndex === N-1 right after a fresh load).
//   ?fresh=1 clears the separate test save; ?fast=1 removes motion delays.
import { webkit, chromium } from '/opt/homebrew/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8767/word-wheel/';
let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.log('FAIL:', msg); } };
const phone = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

const SHOTS_DIR = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS_DIR, { recursive: true });
const shotPath = name => SHOTS_DIR + name;

const browser = await webkit.launch();

async function newPage(w = 390, h = 844, query = '') {
  const ctx = await browser.newContext(phone(w, h));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push('console: ' + m.text()); });
  await page.goto(BASE + 'index.html?fast=1' + query);
  await page.waitForFunction(() => window.__wordwheel);
  return page;
}
const state = page => page.evaluate(() => window.__wordwheel.state());

// ---- wheel / grid helpers ----------------------------------------------------------------
async function wheelLetters(page) {
  return page.evaluate(() => [...document.querySelectorAll('.wheel-letter[data-i]')]
    .map(el => ({ i: +el.dataset.i, letter: (el.textContent || '').trim().toUpperCase() })));
}
async function letterCenter(page, i) {
  return page.evaluate(i => window.__wordwheel.letterCenter(i), i);
}
async function cellRectCenter(page, r, c) {
  return page.evaluate(([r, c]) => {
    const rect = window.__wordwheel.cellRect(r, c);
    const x = rect.x ?? rect.left, y = rect.y ?? rect.top;
    return { x: x + rect.width / 2, y: y + rect.height / 2 };
  }, [r, c]);
}
function letterQueues(letterList) {
  const avail = {};
  for (const { i, letter } of letterList) (avail[letter] ??= []).push(i);
  return avail;
}
async function indicesForWord(page, word) {
  const avail = letterQueues(await wheelLetters(page));
  const idxs = [];
  for (const ch of word.toUpperCase()) {
    const arr = avail[ch];
    if (!arr || !arr.length) throw new Error(`indicesForWord: no unused wheel tile for "${ch}" in "${word}"`);
    idxs.push(arr.shift());
  }
  return idxs;
}

// Real swipe: press the first letter, drag through the rest, lift.
async function swipe(page, word) {
  const idxs = await indicesForWord(page, word);
  const centers = [];
  for (const i of idxs) centers.push(await letterCenter(page, i));
  await page.mouse.move(centers[0].x, centers[0].y);
  await page.mouse.down();
  for (let k = 1; k < centers.length; k++) await page.mouse.move(centers[k].x, centers[k].y, { steps: 8 });
  await page.mouse.up();
}

// Tap each letter, then Enter.
async function tapWord(page, word) {
  const idxs = await indicesForWord(page, word);
  for (const i of idxs) {
    const c = await letterCenter(page, i);
    await page.mouse.click(c.x, c.y);
  }
  await page.locator('#enter').click();
}

// Touch variant: dispatch real PointerEvents (pointerType 'touch') instead of driving the mouse,
// to prove the wheel also responds to touch input, not just Playwright's synthetic mouse.
let touchPointerId = 500;
async function touchSwipe(page, word) {
  const idxs = await indicesForWord(page, word);
  const centers = [];
  for (const i of idxs) centers.push(await letterCenter(page, i));
  const points = [centers[0]];
  for (let k = 1; k < centers.length; k++) {
    const a = centers[k - 1], b = centers[k];
    for (let s = 1; s <= 8; s++) points.push({ x: a.x + (b.x - a.x) * s / 8, y: a.y + (b.y - a.y) * s / 8 });
  }
  const pointerId = touchPointerId++;
  await page.evaluate(({ points, pointerId }) => {
    const mk = (type, p) => new PointerEvent(type, { clientX: p.x, clientY: p.y, pointerId, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true });
    const target = document.elementFromPoint(points[0].x, points[0].y);
    target.dispatchEvent(mk('pointerdown', points[0]));
    for (let i = 1; i < points.length - 1; i++) target.dispatchEvent(mk('pointermove', points[i]));
    target.dispatchEvent(mk('pointerup', points[points.length - 1]));
  }, { points, pointerId });
}

async function shookOrCleared(page, timeoutMs = 1200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await page.evaluate(() => ({
      shake: document.getElementById('strip').classList.contains('shake'),
      current: window.__wordwheel.state().current
    }));
    if (r.shake || r.current === '') return true;
    await page.waitForTimeout(30);
  }
  return false;
}

function rectsIntersect(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

async function textFits(page) {
  return page.evaluate(() => {
    const sel = 'button, h1, h2, h3, h4, #strip, .status, #status, [aria-live], dialog p, dialog li, .dialog p, .dialog li';
    return [...document.querySelectorAll(sel)]
      .filter(el => el.getBoundingClientRect().width > 0)
      .every(el => el.scrollWidth <= el.clientWidth + 1);
  });
}

// Best-effort: the shared contract only names the dialog ids, not their menu trigger ids.
// menu-dialog and help-dialog open directly from top-bar buttons; settings/new-game are guessed
// from likely selectors (mirroring the Hearts convention) inside the menu.
async function openDialog(page, id) {
  if (id === 'menu-dialog') { await page.locator('#menu-button').click(); await page.waitForTimeout(50); return page.locator('#menu-dialog').isVisible(); }
  if (id === 'help-dialog') { await page.locator('#help-button').click(); await page.waitForTimeout(50); return page.locator('#help-dialog').isVisible(); }
  await page.locator('#menu-button').click();
  await page.waitForTimeout(50);
  const candidates = id === 'settings-dialog'
    ? ['#menu-settings', '[data-open="settings-dialog"]', '[data-dialog="settings"]']
    : id === 'goto-dialog' ? ['#menu-goto']
    : ['#menu-new', '#menu-new-game', '#new-game', '[data-open="new-dialog"]', '[data-dialog="new"]'];
  let clicked = false;
  for (const sel of candidates) {
    const loc = page.locator(sel);
    if (await loc.count()) { await loc.first().click(); clicked = true; break; }
  }
  if (!clicked) console.log(`WARNING: no known trigger found for #${id} among menu children; tried ${candidates.join(', ')}`);
  await page.waitForTimeout(50);
  return page.locator('#' + id).isVisible();
}
async function closeAnyDialog(page) {
  const candidates = ['[data-close]', '.dialog-close', 'dialog[open] [data-close]', 'button[aria-label="Close"]'];
  for (const sel of candidates) {
    const loc = page.locator(sel);
    if (await loc.count()) { await loc.first().click().catch(() => {}); break; }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(50);
}

// Every permutation of `letters` at length `len` (small n, used to build a guaranteed non-word).
function permsOfLength(letters, len) {
  const res = [], used = new Array(letters.length).fill(false), cur = [];
  (function rec() {
    if (cur.length === len) { res.push(cur.join('')); return; }
    for (let i = 0; i < letters.length; i++) {
      if (used[i]) continue;
      used[i] = true; cur.push(letters[i]);
      rec();
      cur.pop(); used[i] = false;
    }
  })();
  return res;
}
function findWrongWord(lvl) {
  const letters = lvl.letters.split('');
  const accepted = new Set([...lvl.words.map(w => w.w.toUpperCase()), ...(lvl.bonus || []).map(w => w.toUpperCase())]);
  for (let len = 3; len <= letters.length; len++) {
    for (const cand of permsOfLength(letters, len)) if (!accepted.has(cand)) return cand;
  }
  return null;
}
function occupiedCells(lvl) {
  const cells = [];
  for (const w of lvl.words) for (let k = 0; k < w.w.length; k++) {
    cells.push({ r: w.d === 'd' ? w.r + k : w.r, c: w.d === 'a' ? w.c + k : w.c });
  }
  return cells;
}
function largestGridLevelIndex(levels) {
  let best = 0, bestScore = -1;
  // Worst case for sizing: the widest/tallest grid, then the most squares, then the most wheel letters.
  levels.forEach((l, i) => { const s = Math.max(l.rows, l.cols) * 1000 + l.rows * l.cols * 10 + l.letters.length; if (s > bestScore) { bestScore = s; best = i; } });
  return best;
}
function pickExtraLevelIds(n, levelsLength) {
  const ids = [];
  if (levelsLength >= 21) ids.push(21);
  if (levelsLength >= 61) ids.push(61);
  if (levelsLength >= 45 && ids.length < 3) ids.push(45);
  let next = n + 1;
  while (ids.length < 3) { ids.push(Math.min(levelsLength, next)); next++; }
  return ids.slice(0, 3);
}

async function finishLevelWith(page, levelIndex0, lvl, inputFn, label) {
  const s0 = await state(page);
  ok(s0.levelIndex === levelIndex0, `${label}: levelIndex is ${levelIndex0} before playing (got ${s0.levelIndex})`);
  for (const w of lvl.words.map(x => x.w)) await inputFn(page, w);
  const shown = await page.locator('#next-level').waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
  ok(shown, `${label}: #next-level becomes visible after finishing all words`);
  return shown;
}
async function advanceToNext(page, levelIndex0, label) {
  await page.locator('#next-level').click();
  await page.waitForTimeout(50);
  const s1 = await state(page);
  ok(s1.levelIndex === levelIndex0 + 1, `${label}: clicking #next-level advances levelIndex to ${levelIndex0 + 1} (got ${s1.levelIndex})`);
}

// Fetch LEVELS once up front.
const levels = await (async () => {
  const ctx = await browser.newContext(phone(390, 844));
  const page = await ctx.newPage();
  await page.goto(BASE + 'index.html?fast=1');
  await page.waitForFunction(() => window.__wordwheel);
  const l = await page.evaluate(() => window.LEVELS);
  await ctx.close();
  return l;
})();
if (!Array.isArray(levels) || levels.length === 0) {
  console.log('FAIL: window.LEVELS is missing or empty; cannot run the suite.');
  await browser.close();
  console.log(`${checks} checks, ${failures + 1} failed.`);
  process.exit(1);
}
if (levels.length < 20) console.log(`WARNING: only ${levels.length} level(s) in LEVELS (stub?) - ranges below are adapted to what exists.`);

// 1. Finish levels 1-10 by real swipes, 3 more by taps+Enter, and one full level by touch PointerEvents.
try {
  const n = Math.min(10, levels.length);
  const page = await newPage(390, 844, '&level=1&fresh=1');
  await page.screenshot({ path: shotPath('390x844-play.png') });
  for (let li = 0; li < n; li++) {
    try {
      const shown = await finishLevelWith(page, li, levels[li], swipe, `level ${li + 1} (swipe)`);
      if (li === 0 && shown) await page.screenshot({ path: shotPath('390x844-level-complete.png') });
      if (shown) await advanceToNext(page, li, `level ${li + 1} (swipe)`);
      else break;
    } catch (e) { ok(false, `level ${li + 1} (swipe): unexpected error - ` + e.message); break; }
  }
  ok(page.errors.length === 0, 'swipe-through levels 1-10: no page errors ' + page.errors.join(' | '));
  await page.close();

  const extraIds = pickExtraLevelIds(n, levels.length);
  for (const id of extraIds) {
    try {
      const idx = id - 1;
      const p = await newPage(390, 844, `&level=${id}&fresh=1`);
      const shown = await finishLevelWith(p, idx, levels[idx], tapWord, `level ${id} (tap+Enter)`);
      if (shown) await advanceToNext(p, idx, `level ${id} (tap+Enter)`);
      ok(p.errors.length === 0, `level ${id} (tap+Enter): no page errors ` + p.errors.join(' | '));
      await p.close();
    } catch (e) { ok(false, `level ${id} (tap+Enter): unexpected error - ` + e.message); }
  }

  const tp = await newPage(390, 844, '&level=1&fresh=1');
  const shownTouch = await finishLevelWith(tp, 0, levels[0], touchSwipe, 'level 1 (touch PointerEvents)');
  ok(tp.errors.length === 0, 'touch-input level: no page errors ' + tp.errors.join(' | '));
  await tp.close();
} catch (e) { ok(false, '1. levels 1-10/tap/touch section: unexpected error - ' + e.message); }

// 2. Wrong word, repeated word, bonus word.
try {
  const idx = 0;
  const page = await newPage(390, 844, `&level=${idx + 1}&fresh=1`);
  const lvl = levels[idx];
  const before = await state(page);

  const wrong = findWrongWord(lvl);
  if (wrong) {
    await swipe(page, wrong);
    const settled = await shookOrCleared(page);
    ok(settled, `wrong word "${wrong}": strip shows shake or current clears`);
    const after = await state(page);
    ok(JSON.stringify(after.found) === JSON.stringify(before.found) && after.bonusFound.length === before.bonusFound.length,
      `wrong word "${wrong}": found/bonus state unchanged`);
  } else {
    console.log(`WARNING: could not construct a non-word from letters "${lvl.letters}" for level ${idx + 1}; wrong-word check skipped`);
  }
  ok(page.errors.length === 0, 'wrong word: no page errors ' + page.errors.join(' | '));

  const realWord = lvl.words[0].w;
  await swipe(page, realWord);
  await page.waitForTimeout(150);
  const afterFirst = await state(page);
  ok(afterFirst.found.length === before.found.length + 1, `found word "${realWord}" is added to found`);
  await swipe(page, realWord);
  await page.waitForTimeout(150);
  const afterRepeat = await state(page);
  ok(JSON.stringify(afterRepeat.found) === JSON.stringify(afterFirst.found), `repeating found word "${realWord}" leaves found list unchanged`);

  const bonusIdx = levels.findIndex(l => l.bonus && l.bonus.length > 0);
  if (bonusIdx >= 0) {
    const pageB = await newPage(390, 844, `&level=${bonusIdx + 1}&fresh=1`);
    const s0b = await state(pageB);
    const bonusWord = levels[bonusIdx].bonus[0];
    await swipe(pageB, bonusWord);
    await pageB.screenshot({ path: shotPath('390x844-bonus.png') });
    await pageB.waitForTimeout(150);
    const s1b = await state(pageB);
    ok(s1b.bonusFound.length === s0b.bonusFound.length + 1, `bonus word "${bonusWord}" (level ${bonusIdx + 1}) grows bonusFound by 1`);
    ok(pageB.errors.length === 0, 'bonus word: no page errors ' + pageB.errors.join(' | '));
    await pageB.close();
  } else {
    console.log(`WARNING: no level among ${levels.length} has bonus words; bonus-word check skipped`);
  }
  await page.close();
} catch (e) { ok(false, '2. wrong/repeat/bonus word section: unexpected error - ' + e.message); }

// 3. Shuffle: wheel order changes (within 5 tries), found unchanged.
try {
  const page = await newPage(390, 844, '&level=1&fresh=1');
  // Letters keep their elements and move on screen, so compare where each letter sits, read left to right by angle.
  const arrangement = () => page.evaluate(() => {
    const L = window.__wordwheel.level().letters;
    const pts = [...L].map((ch, i) => ({ ch, p: window.__wordwheel.letterCenter(i) }));
    const cx = pts.reduce((a, b) => a + b.p.x, 0) / pts.length, cy = pts.reduce((a, b) => a + b.p.y, 0) / pts.length;
    return pts.sort((a, b) => Math.atan2(a.p.y - cy, a.p.x - cx) - Math.atan2(b.p.y - cy, b.p.x - cx)).map(x => x.ch).join('');
  });
  const before = await arrangement();
  const beforeFound = (await state(page)).found;
  let changed = false;
  for (let attempt = 0; attempt < 5 && !changed; attempt++) {
    await page.locator('#shuffle').click();
    await page.waitForTimeout(60);
    const after = await arrangement();
    if (after !== before) changed = true;
  }
  ok(changed, 'shuffle: wheel order changes within 5 presses');
  const afterFound = (await state(page)).found;
  ok(JSON.stringify(afterFound) === JSON.stringify(beforeFound), 'shuffle: found list unchanged');
  ok(page.errors.length === 0, 'shuffle: no page errors ' + page.errors.join(' | '));
  await page.close();
} catch (e) { ok(false, '3. shuffle section: unexpected error - ' + e.message); }

// 4. Hint reveals exactly one new cell per press, finishing a word by hints alone; Pick a square.
try {
  const page = await newPage(390, 844, '&level=1&fresh=1');
  const lvl = levels[0];
  let s = await state(page);
  ok(s.revealed.length === 0, 'hint setup: no cells revealed at a fresh start');
  let prevLen = s.revealed.length, prevFoundLen = s.found.length, completed = false;
  const maxHints = Math.min(60, occupiedCells(lvl).length + 5);
  for (let press = 0; press < maxHints; press++) {
    await page.locator('#hint').click();
    await page.waitForTimeout(40);
    if (press === 0) await page.screenshot({ path: shotPath('390x844-hint.png') });
    s = await state(page);
    ok(s.revealed.length === prevLen + 1, `hint press ${press + 1}: exactly one new cell revealed (was ${prevLen}, now ${s.revealed.length})`);
    prevLen = s.revealed.length;
    if (s.found.length > prevFoundLen) { completed = true; break; }
  }
  ok(completed, 'hint: pressing until a word completes adds it to found');
  ok(page.errors.length === 0, 'hint: no page errors ' + page.errors.join(' | '));
  await page.close();
} catch (e) { ok(false, '4a. hint section: unexpected error - ' + e.message); }
try {
  const page = await newPage(390, 844, '&level=1&fresh=1');
  const lvl = levels[0];
  const cells = occupiedCells(lvl);
  const target = cells[0], target2 = cells.find(c => !(c.r === target.r && c.c === target.c)) || cells[0];

  await page.locator('#pick').click();
  await page.screenshot({ path: shotPath('390x844-pick.png') });
  const promptShown = (await page.evaluate(() => document.body.innerText.toLowerCase())).includes('blank square');
  ok(promptShown, 'pick mode: status prompts to tap a blank square');
  let c = await cellRectCenter(page, target.r, target.c);
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(60);
  let s = await state(page);
  ok(s.revealed.length === 1 && s.revealed.some(rc => rc === `${target.r},${target.c}`),
    `pick: tapping cell (${target.r},${target.c}) reveals exactly that cell`);

  await page.locator('#pick').click();
  await page.locator('#pick').click();
  c = await cellRectCenter(page, target2.r, target2.c);
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(60);
  s = await state(page);
  ok(s.revealed.length === 1, 'pick: pressing #pick twice cancels the mode, so a later tap reveals nothing further');
  ok(page.errors.length === 0, 'pick a square: no page errors ' + page.errors.join(' | '));
  await page.close();
} catch (e) { ok(false, '4b. pick a square section: unexpected error - ' + e.message); }

// 5. Wheel input details: long hold, drift, back-up, tap-to-remove.
try {
  const page = await newPage(390, 844, '&level=1&fresh=1');
  const letters = await wheelLetters(page);

  const c0 = await letterCenter(page, letters[0].i);
  await page.mouse.move(c0.x, c0.y);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await page.waitForTimeout(50);
  let s = await state(page);
  ok(s.current === letters[0].letter, `long hold (900ms) on one letter adds exactly that letter (current="${s.current}")`);

  await page.mouse.click(c0.x, c0.y);
  await page.waitForTimeout(50);
  s = await state(page);
  ok(s.current === '', 'tapping the last-added letter again removes it');

  const wheelBox = await page.locator('#wheel').boundingBox();
  const wc = { x: wheelBox.x + wheelBox.width / 2, y: wheelBox.y + wheelBox.height / 2 };
  const letter1 = letters[1] || letters[0];
  const c1 = await letterCenter(page, letter1.i);
  const dx = wc.x - c1.x, dy = wc.y - c1.y, mag = Math.hypot(dx, dy) || 1;
  const drifted = { x: c1.x + dx / mag * 25, y: c1.y + dy / mag * 25 };
  await page.mouse.move(c1.x, c1.y);
  await page.mouse.down();
  await page.mouse.move(drifted.x, drifted.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(50);
  s = await state(page);
  ok(s.current === letter1.letter, `drift 25px toward wheel center adds only that one letter (current="${s.current}")`);
  await page.mouse.click(c1.x, c1.y);
  await page.waitForTimeout(50);

  const letterB = letters[1] || letters[0];
  const cA = await letterCenter(page, letters[0].i), cB = await letterCenter(page, letterB.i);
  await page.mouse.move(cA.x, cA.y);
  await page.mouse.down();
  await page.mouse.move(cB.x, cB.y, { steps: 5 });
  await page.mouse.move(cA.x, cA.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(50);
  s = await state(page);
  ok(s.current === letters[0].letter || s.current === '', `back-up (A->B->A) leaves current as just A or nothing (current="${s.current}")`);
  ok(s.found.length === 0, 'back-up (A->B->A) did not submit anything');
  ok(page.errors.length === 0, 'wheel input details: no page errors ' + page.errors.join(' | '));
  await page.close();
} catch (e) { ok(false, '5. wheel input details section: unexpected error - ' + e.message); }

// 6. Buttons: long hold / slide-before-lift on #back, quick tap after long hold, long slide far away, no text selection.
try {
  const page = await newPage(390, 844, '&level=1&fresh=1');
  const letters = await wheelLetters(page);
  async function addLetter(i) { const c = await letterCenter(page, i); await page.mouse.click(c.x, c.y); }
  await addLetter(letters[0].i);
  await addLetter((letters[1] || letters[0]).i);
  await addLetter((letters[2 % letters.length] || letters[0]).i);
  await page.screenshot({ path: shotPath('390x844-strip.png') });
  let s = await state(page);
  const startLen = s.current.length;
  ok(startLen >= 2, 'button test setup: current has multiple letters to remove from');

  const backBox = await page.locator('#back').boundingBox();
  const bx = backBox.x + backBox.width / 2, by = backBox.y + backBox.height / 2;

  await page.mouse.move(bx, by); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await page.waitForTimeout(60);
  s = await state(page);
  ok(s.current.length === startLen - 1, `long hold (700ms) on #back removes exactly one letter (was ${startLen}, now ${s.current.length})`);

  let lenBefore = s.current.length;
  await page.mouse.move(bx, by); await page.mouse.down(); await page.mouse.move(bx, by - 30, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(60);
  s = await state(page);
  ok(s.current.length === lenBefore - 1, `#back slide 30px up before lifting removes exactly one letter (was ${lenBefore}, now ${s.current.length})`);

  let lenBefore2 = s.current.length;
  await page.mouse.move(bx, by); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await page.mouse.click(bx, by);
  await page.waitForTimeout(80);
  s = await state(page);
  ok(s.current.length === Math.max(0, lenBefore2 - 2), `quick tap right after a long hold on #back is not lost (was ${lenBefore2}, now ${s.current.length})`);

  while ((await state(page)).current.length < 1) await addLetter(letters[0].i);
  const lenBefore3 = (await state(page)).current.length;
  await page.mouse.move(bx, by); await page.mouse.down(); await page.mouse.move(bx, by - 150, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(80);
  s = await state(page);
  ok(s.current.length === lenBefore3, `long slide 150px away from #back does nothing (stayed at ${lenBefore3})`);

  const gridBox = await page.locator('#grid').boundingBox();
  await page.mouse.move(gridBox.x + gridBox.width / 2, gridBox.y + gridBox.height / 2);
  await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  const stripBox = await page.locator('#strip').boundingBox();
  await page.mouse.move(stripBox.x + stripBox.width / 2, stripBox.y + stripBox.height / 2);
  await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  const selection = await page.evaluate(() => window.getSelection().toString());
  ok(selection === '', `no text selection after long presses on grid and strip (got "${selection}")`);
  ok(page.errors.length === 0, 'buttons: no page errors ' + page.errors.join(' | '));
  await page.close();
} catch (e) { ok(false, '6. buttons section: unexpected error - ' + e.message); }

// 7. Save and restore mid-level; damaged save.
try {
  const page = await newPage(390, 844, '&level=1&fresh=1');
  const lvl = levels[0];
  await swipe(page, lvl.words[0].w);
  await page.waitForTimeout(150);
  const before = await state(page);
  ok(before.found.length >= 1, 'save/restore setup: one word found before reload');

  await page.goto(BASE + 'index.html?fast=1&level=1');
  await page.waitForFunction(() => window.__wordwheel);
  const after = await state(page);
  ok(JSON.stringify(after.found) === JSON.stringify(before.found), 'reload without fresh=1 restores found words');
  ok(JSON.stringify(after.revealed) === JSON.stringify(before.revealed), 'reload without fresh=1 restores revealed cells');
  ok(after.levelIndex === before.levelIndex, 'reload without fresh=1 restores levelIndex');
  ok(page.errors.length === 0, 'save/restore: no page errors ' + page.errors.join(' | '));

  const saveKey = await page.evaluate(() => window.__wordwheel.saveKey);
  ok(!!saveKey, 'hook exposes __wordwheel.saveKey');
  if (saveKey) {
    await page.evaluate(key => localStorage.setItem(key, '{not valid json!!'), saveKey);
    await page.goto(BASE + 'index.html?fast=1&level=1');
    await page.waitForFunction(() => window.__wordwheel);
    await page.waitForTimeout(200);
    await page.screenshot({ path: shotPath('390x844-damaged-save.png') });
    const dialogVisible = await page.evaluate(() =>
      [...document.querySelectorAll('dialog')].some(d => d.open) ||
      [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],.dialog')].some(d => {
        const r = d.getBoundingClientRect(), cs = getComputedStyle(d);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      }));
    ok(dialogVisible, 'damaged save: a visible notice dialog appears');
    const s2 = await state(page);
    ok(Array.isArray(s2.found) && s2.found.length === 0 && s2.revealed.length === 0, 'damaged save: fresh valid state after damage');
    ok(page.errors.length === 0, 'damaged save: no page errors ' + page.errors.join(' | '));
  }
  await page.close();
} catch (e) { ok(false, '7. save/restore/damaged-save section: unexpected error - ' + e.message); }

// 8. Sizes on the level with the largest grid.
try {
  const idx = largestGridLevelIndex(levels);
  const lvl = levels[idx];
  console.log(`sizes test: using level ${idx + 1} (${lvl.rows}x${lvl.cols} grid)`);
  for (const [w, h] of [[390, 844], [390, 763], [390, 740], [375, 667]]) {
   try {
    const page = await newPage(w, h, `&level=${idx + 1}&fresh=1`);
    await page.locator('#hint').click();
    await page.waitForTimeout(60);
    const m = await page.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const cellEls = [...document.querySelectorAll('.cell[data-r][data-c]')].map(box);
      const wheelEls = [...document.querySelectorAll('.wheel-letter[data-i]')].map(box);
      const buttons = [...document.querySelectorAll('button')].filter(e => e.offsetParent).map(e => ({ box: box(e), fs: parseFloat(getComputedStyle(e).fontSize), fw: parseInt(getComputedStyle(e).fontWeight) || 400 }));
      const btnRowEls = ['shuffle', 'hint', 'pick'].map(id => document.getElementById(id)).filter(Boolean).map(box);
      const union = rects => rects.length ? { left: Math.min(...rects.map(r => r.left)), top: Math.min(...rects.map(r => r.top)), right: Math.max(...rects.map(r => r.right)), bottom: Math.max(...rects.map(r => r.bottom)) } : null;
      const firstWheelLetter = document.querySelector('.wheel-letter[data-i]');
      const filledCell = [...document.querySelectorAll('.cell[data-r][data-c]')].find(e => (e.textContent || '').trim().length > 0);
      const statusEl = document.querySelector('#status, .status, [aria-live], [data-role="status"]');
      return {
        cellSizes: cellEls.map(r => Math.min(r.width, r.height)),
        wheelSizes: wheelEls.map(r => Math.min(r.width, r.height)),
        buttons: buttons.map(b => ({ w: b.box.width, h: b.box.height, fs: b.fs, fw: b.fw })),
        gridBox: box(document.getElementById('grid')),
        stripBox: box(document.getElementById('strip')),
        wheelBox: box(document.getElementById('wheel')),
        btnRow: union(btnRowEls),
        wheelFont: firstWheelLetter ? parseFloat(getComputedStyle(firstWheelLetter).fontSize) : 0,
        cellFontRatio: filledCell ? parseFloat(getComputedStyle(filledCell).fontSize) / filledCell.getBoundingClientRect().width : null,
        statusInfo: statusEl ? { fs: parseFloat(getComputedStyle(statusEl).fontSize), fw: parseInt(getComputedStyle(statusEl).fontWeight) || 400 } : null,
        scrollH: document.documentElement.scrollHeight, scrollW: document.documentElement.scrollWidth,
        innerH: innerHeight, innerW: innerWidth
      };
    });
    const cellMin = (w === 390 && h === 844) ? 44 : 38;
    ok(m.cellSizes.length > 0 && m.cellSizes.every(s => s >= cellMin), `${w}x${h}: grid cells >= ${cellMin}px (min ${Math.round(Math.min(...m.cellSizes))})`);
    ok(m.wheelSizes.length > 0 && m.wheelSizes.every(s => s >= 64), `${w}x${h}: wheel letter circles >= 64px wide (min ${Math.round(Math.min(...m.wheelSizes))})`);
    ok(m.buttons.length > 0 && m.buttons.every(b => b.w >= 44 && b.h >= 44), `${w}x${h}: every visible button >= 44x44`);
    ok(m.buttons.every(b => b.fs >= 18 && b.fw >= 600), `${w}x${h}: button text >= 18px and bold (weight >= 600)`);
    ok(m.wheelFont >= 40, `${w}x${h}: wheel letter font >= 40px (got ${m.wheelFont})`);
    if (m.cellFontRatio === null) console.log(`WARNING: ${w}x${h}: no revealed/found grid cell with text found; grid-letter font ratio check skipped`);
    else ok(m.cellFontRatio >= 0.6, `${w}x${h}: grid letter font >= 0.6x cell size (ratio ${m.cellFontRatio.toFixed(2)})`);
    if (!m.statusInfo) console.log(`WARNING: ${w}x${h}: no status-line element found by #status/.status/[aria-live]; status-line size check skipped`);
    else ok(m.statusInfo.fs >= 18 && m.statusInfo.fw >= 600, `${w}x${h}: status line text >= 18px and bold`);
    ok(m.scrollH <= m.innerH + 1 && m.scrollW <= m.innerW + 1, `${w}x${h}: documentElement fits without scrolling`);
    const regions = [m.gridBox, m.stripBox, m.wheelBox, m.btnRow].filter(Boolean);
    let noOverlap = true;
    for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) if (rectsIntersect(regions[i], regions[j])) noOverlap = false;
    ok(noOverlap, `${w}x${h}: grid, strip, button row and wheel do not overlap`);
    const within = r => r.left >= -1 && r.top >= -1 && r.right <= m.innerW + 1 && r.bottom <= m.innerH + 1;
    ok(regions.every(within), `${w}x${h}: grid, strip, button row and wheel stay inside the viewport`);
    await page.screenshot({ path: shotPath(`${w}x${h}-largegrid.png`) });
    ok(page.errors.length === 0, `${w}x${h}: no page errors ` + page.errors.join(' | '));
    await page.close();
   } catch (e) { ok(false, `8. sizes ${w}x${h}: unexpected error - ` + e.message); }
  }
} catch (e) { ok(false, '8. sizes section: unexpected error - ' + e.message); }

// 9. Languages en, es, vi: everything fits, all dialogs open and fit, level-complete panel fits.
for (const lang of ['en', 'es', 'vi']) {
  try {
    const page = await newPage(390, 844, `&level=1&fresh=1&lang=${lang}`);
    await page.screenshot({ path: shotPath(`390x844-lang-${lang}.png`) });
    ok(await textFits(page), `lang ${lang}: strip/status/buttons/headings fit on the play screen`);

    ok(await openDialog(page, 'menu-dialog'), `lang ${lang}: #menu-dialog opens`);
    if (lang === 'en') await page.screenshot({ path: shotPath('390x844-menu.png') });
    ok(await textFits(page), `lang ${lang}: #menu-dialog text fits`);
    if (lang === 'en') {
      await closeAnyDialog(page);
      ok(await openDialog(page, 'goto-dialog'), 'lang en: #goto-dialog opens from #menu-goto');
      ok(await textFits(page), 'lang en: #goto-dialog text fits');
      await page.screenshot({ path: shotPath('390x844-go-to-level.png') });
      await closeAnyDialog(page);
      await openDialog(page, 'menu-dialog');
    }
    await closeAnyDialog(page);

    ok(await openDialog(page, 'help-dialog'), `lang ${lang}: #help-dialog opens`);
    if (lang === 'en') await page.screenshot({ path: shotPath('390x844-help.png') });
    ok(await textFits(page), `lang ${lang}: #help-dialog text fits`);
    await closeAnyDialog(page);

    ok(await openDialog(page, 'settings-dialog'), `lang ${lang}: #settings-dialog opens`);
    if (lang === 'en') await page.screenshot({ path: shotPath('390x844-settings.png') });
    ok(await textFits(page), `lang ${lang}: #settings-dialog text fits`);
    await closeAnyDialog(page);

    ok(await openDialog(page, 'new-dialog'), `lang ${lang}: #new-dialog opens`);
    if (lang === 'en') await page.screenshot({ path: shotPath('390x844-new-game.png') });
    ok(await textFits(page), `lang ${lang}: #new-dialog text fits`);
    await closeAnyDialog(page);

    for (const w of levels[0].words.map(x => x.w)) await swipe(page, w);
    const shown = await page.locator('#next-level').waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
    ok(shown, `lang ${lang}: level-complete panel shows (#next-level visible)`);
    ok(await textFits(page), `lang ${lang}: level-complete panel text fits`);

    ok(page.errors.length === 0, `lang ${lang}: no page errors ` + page.errors.join(' | '));
    await page.close();
  } catch (e) { ok(false, `9. language ${lang} section: unexpected error - ` + e.message); }
}

// 10. No page errors anywhere: checked per-block above via page.errors; nothing further to add here.

// 11. Offline (Chromium): after one visit and the service worker taking control, the game still works with the network off.
try {
  const chrome = await chromium.launch();
  const ctx = await chrome.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + 'index.html?fast=1&level=1&fresh=1');
  await page.waitForFunction(() => window.__wordwheel);
  const ready = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'no service worker support';
    const reg = await navigator.serviceWorker.ready;
    return reg.active ? 'active' : 'not active';
  }).catch(e => 'error: ' + e.message);
  if (ready === 'active') {
    await page.reload();
    await ctx.setOffline(true);
    let offlineOk = false, wordFound = false;
    try {
      await page.reload();
      offlineOk = await page.evaluate(() => !!window.__wordwheel);
      if (offlineOk) {
        const wheelList = await wheelLetters(page);
        const avail = letterQueues(wheelList);
        const word = levels[0].words[0].w;
        const idxs = [];
        for (const ch of word.toUpperCase()) idxs.push(avail[ch] ? avail[ch].shift() : null);
        if (idxs.every(i => i !== null)) {
          const centers = [];
          for (const i of idxs) centers.push(await letterCenter(page, i));
          await page.mouse.move(centers[0].x, centers[0].y);
          await page.mouse.down();
          for (let k = 1; k < centers.length; k++) await page.mouse.move(centers[k].x, centers[k].y, { steps: 8 });
          await page.mouse.up();
          await page.waitForTimeout(150);
          const s = await state(page);
          wordFound = s.found.length >= 1;
        }
      }
    } catch (e) { offlineOk = false; }
    ok(offlineOk, 'offline: __wordwheel exists after reloading with the network off');
    ok(wordFound, 'offline: a word can be found while offline');
  } else {
    ok(false, 'offline: service worker not active (' + ready + ')');
  }
  ok(errs.length === 0, 'offline: no page errors ' + errs.join(' | '));
  await chrome.close();
} catch (e) { ok(false, '11. offline section: unexpected error - ' + e.message); }

await browser.close();
console.log(`${checks} checks, ${failures} failed.`);
process.exit(failures ? 1 : 0);
