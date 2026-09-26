/* Word Wheel (Claude): screen, wheel input, hints, saving and pacing. Levels come from levels.js (globalThis.LEVELS).

   Test hook, for automated tests only: window.__wordwheel
     state()         -> { levelIndex, found[], revealed[], bonusFound[], current, order, allLevels }
                        levelIndex is 0-based. found and bonusFound hold uppercase words. revealed holds "r,c" strings for
                        squares shown by Hint or Pick a square. current is the word in the strip, uppercase.
                        order[slot] = index into level().letters of the letter shown at that place on the wheel.
                        allLevels: true when Go to a level reaches every level (a save started on this device, see blankSave).
     level()         -> the current level object from levels.js
     letterCenter(i) -> { x, y }: client coordinates of the center of letter i, where i indexes level().letters.
                        Shuffle moves the letters around; letter i is always the element .wheel-letter[data-i="i"].
     cellRect(r, c)  -> DOMRect-like box { x, y, left, top, right, bottom, width, height } of grid square (r, c), or null
     rules           -> pure helpers: MIN_LEN, canSpell(letters, word), wordCells(wordEntry), classify(word), hintCell()
     saveKey         -> the localStorage key in use ('claude-word-wheel-save', or 'claude-word-wheel-test' for tests)
     sizes()         -> the measured layout: { cell, letter, letterFont, gridFont, stripFont }
     sizesFor(n)     -> { cell, letter }: the sizes level n (1-based) would get on this screen
     ipad()          -> { option, u, twoCol }: the ?ipad= option in effect ('today', 'fill' or 'split'), the scale u in
                        effect now (1 on a phone, with 'today', and whenever nothing grows) and whether two columns show now
   window.__wordwheelReady is set to true once the first level is drawn (boot-check.js reads it).
   URL options:
     ?fast=1   no motion delays (tests)
     ?level=N  tests only: play level N in the separate test save. Opening the same N again resumes it.
     ?fresh=1  tests only: clear the test save when the page is opened (a reload keeps it)
     ?lang=en|es|vi, ?look=felt|light|scenery (the look is not saved)
     ?ipad=today|fill|split  how a screen wider than a phone (an iPad) is used; not saved (see iPadMode):
               today = the phone-width column; fill = everything grows together to use the height;
               split = fill when upright, and two columns when sideways (the grid left; the rest right)
*/
(function () {
  'use strict';

  const T = window.I18N;
  const LEVELS = Array.isArray(window.LEVELS) ? window.LEVELS : [];
  const MIN_LEN = 3;
  const DEFAULT_LOOK = 'felt';   // Shawn picks the look; ship his pick by changing this one constant
  const DEFAULT_IPAD = 'today';  // Shawn picks the iPad layout; ship his pick by changing this one constant
  const LOOKS = ['felt', 'light', 'scenery'];
  const IPADS = ['today', 'fill', 'split'];
  const REAL_KEY = 'claude-word-wheel-save', TEST_KEY = 'claude-word-wheel-test', SET_KEY = 'claude-word-wheel-settings';
  const MSG_MS = 2600;           // how long a short message stays in the status line

  const params = new URLSearchParams(location.search);
  const FAST = params.get('fast') === '1';
  const LOOK = LOOKS.includes(params.get('look')) ? params.get('look') : DEFAULT_LOOK;
  const IPAD = IPADS.includes(params.get('ipad')) ? params.get('ipad') : DEFAULT_IPAD;
  document.documentElement.setAttribute('data-look', LOOK);
  const levelParam = params.has('level') ? parseInt(params.get('level'), 10) : null;
  const FRESH = params.get('fresh') === '1';
  if (FAST) FX.setSpeedScale(0.04);

  const $ = id => document.getElementById(id);
  const store = {
    raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: play without saving */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to clear */ } }
  };

  // Test options use their own save, so tests never touch hers. A browser tab that has used them remembers it
  // (sessionStorage), and a plain address in that tab opens her save if there is one, else the test save.
  // Her Home Screen app never has test options, so it always uses her save.
  let testTab = levelParam !== null || FRESH;
  try {
    if (testTab) sessionStorage.setItem('claude-word-wheel-testing', '1');
    else testTab = sessionStorage.getItem('claude-word-wheel-testing') === '1' && store.raw(REAL_KEY) === null;
  } catch (e) { /* no session storage: plain addresses use her save */ }
  const SAVE_KEY = testTab ? TEST_KEY : REAL_KEY;

  const savedSettings = store.get(SET_KEY);
  const settings = Object.assign({ lang: null, sound: false }, savedSettings && typeof savedSettings === 'object' ? savedSettings : {});
  settings.sound = settings.sound === true;
  T.set(params.get('lang') || settings.lang || T.detect());
  const sound = (kind, arg) => { if (settings.sound) FX.sound(kind, arg); };

  /* ---------------- Game state ---------------- */
  let S = null;                 // the saved game (see blankSave)
  let L = null;                 // the current level from levels.js
  let cellLetter = new Map();   // "r,c" -> letter
  let wordCells = [];           // per grid word: its squares, in reading order
  let bonusSet = new Set();
  let shown = new Set();        // squares showing a letter (found words plus revealed squares)
  let cellEls = new Map(), letterEls = [];
  let dims = null;              // measured layout (see layout)
  let inner = { w: 0, h: 0 };   // the app's content box, measured by layout
  let g = null;                 // the wheel gesture in progress
  // Screen-only state, never saved.
  const ui = { pick: false, msg: null, msgTimer: null, locked: false, completing: false, flights: new Set(), landing: new Set(), shakeWord: null };

  const keyOf = (r, c) => r + ',' + c;
  const uniq = a => [...new Set(a)];
  const identity = n => Array.from({ length: n }, (_, i) => i);
  const currentWord = () => S.current.map(i => L.letters[i]).join('');

  function cellsOfWord(w) {
    const out = [];
    for (let k = 0; k < w.w.length; k++) out.push(keyOf(w.r + (w.d === 'd' ? k : 0), w.c + (w.d === 'a' ? k : 0)));
    return out;
  }

  function prepareLevel() {
    L = LEVELS[S.level - 1];
    cellLetter = new Map();
    wordCells = L.words.map(w => {
      const cells = cellsOfWord(w);
      cells.forEach((k, i) => cellLetter.set(k, w.w[i]));
      return cells;
    });
    bonusSet = new Set((L.bonus || []).map(b => String(b).toUpperCase()));
  }

  // The squares' bounding box (normally 0,0 to rows x cols), so the grid is laid out from the squares actually used.
  function boxOf(lv) {
    let r0 = Infinity, c0 = Infinity, r1 = 0, c1 = 0;
    lv.words.forEach(w => cellsOfWord(w).forEach(k => {
      const [r, c] = k.split(',').map(Number);
      r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r); c1 = Math.max(c1, c);
    }));
    return { r0, c0, rows: r1 - r0 + 1, cols: c1 - c0 + 1 };
  }

  function computeShown() {
    shown = new Set(S.revealed.filter(k => cellLetter.has(k)));
    L.words.forEach((w, i) => { if (S.found.includes(w.w)) wordCells[i].forEach(k => shown.add(k)); });
  }

  // A word whose squares all show counts as found (by hints, or by crossing words). Returns the word indexes added.
  function autoFound() {
    const added = [];
    L.words.forEach((w, i) => {
      if (!S.found.includes(w.w) && wordCells[i].every(k => shown.has(k))) { S.found.push(w.w); added.push(i); }
    });
    if (added.length) computeShown();
    return added;
  }

  const isComplete = () => L.words.every(w => S.found.includes(w.w));

  function classify(word) {
    if (word.length < MIN_LEN) return 'short';
    if (L.words.some(w => w.w === word)) return S.found.includes(word) ? 'found' : 'grid';
    if (bonusSet.has(word)) return S.bonus.includes(word) ? 'bonusFound' : 'bonus';
    return 'none';
  }

  // Hint: the next hidden letter of the unfound word closest to done (fewest hidden letters; ties: shortest, then first).
  function hintCell() {
    let best = null;
    L.words.forEach((w, i) => {
      if (S.found.includes(w.w)) return;
      const hidden = wordCells[i].filter(k => !shown.has(k));
      if (!hidden.length) return;
      if (!best || hidden.length < best.hidden || (hidden.length === best.hidden && w.w.length < best.len)) {
        best = { hidden: hidden.length, len: w.w.length, cell: hidden[0] };
      }
    });
    return best ? best.cell : null;
  }

  const RULES = {
    MIN_LEN,
    canSpell(letters, word) {
      const pool = String(letters).toUpperCase().split('');
      for (const ch of String(word).toUpperCase()) { const i = pool.indexOf(ch); if (i < 0) return false; pool.splice(i, 1); }
      return true;
    },
    wordCells: w => cellsOfWord(w),
    classify: word => classify(String(word).toUpperCase()),
    hintCell: () => hintCell()
  };

  /* ---------------- Saving ---------------- */
  const newStats = () => ({ levelsDone: 0, bonusTotal: 0, hintsUsed: 0 });
  // allLevels: true only on a save this device started from nothing (a new device, such as her iPad), and then Go to
  // a level reaches every level. A save without it (her phone's) reaches only the levels played (maxLevel).
  function blankSave(level, prev) {
    const save = {
      v: 1, level, found: [], revealed: [], bonus: [], order: identity(LEVELS[level - 1].letters.length), current: [],
      maxLevel: Math.max(level, (prev && prev.maxLevel) || 1), stats: (prev && prev.stats) || newStats()
    };
    if (prev && prev.allLevels === true) save.allLevels = true;
    return save;
  }
  let lastSaved = null;
  function saveGame() { if (S) { lastSaved = JSON.stringify(S); store.set(SAVE_KEY, S); } }
  // Closing the app saves only if something changed since the last save (it saves after every action anyway).
  function saveIfChanged() { if (S && JSON.stringify(S) !== lastSaved) saveGame(); }

  const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  const strArr = a => Array.isArray(a) && a.every(x => typeof x === 'string');
  const count = x => (Number.isInteger(x) && x >= 0 ? x : 0);

  // Returns { save, problem }: problem is null (fine or no save), 'part' (the level is kept, its progress starts
  // again) or 'all' (unreadable: start from level 1).
  function readSave() {
    const raw = store.raw(SAVE_KEY);
    if (raw === null) return { save: null, problem: null };
    let s;
    try { s = JSON.parse(raw); } catch (e) { return { save: null, problem: 'all' }; }
    const N = LEVELS.length;
    if (!s || typeof s !== 'object' || Array.isArray(s) || s.v !== 1 || !isInt(s.level, 1, N)) return { save: null, problem: 'all' };
    const st = s.stats && typeof s.stats === 'object' ? s.stats : {};
    const stats = { levelsDone: count(st.levelsDone), bonusTotal: count(st.bonusTotal), hintsUsed: count(st.hintsUsed) };
    const maxLevel = isInt(s.maxLevel, 1, N) ? Math.max(s.maxLevel, s.level) : s.level;
    const shapeOk = strArr(s.found) && strArr(s.revealed) && strArr(s.bonus) && Array.isArray(s.order) &&
      isInt(s.maxLevel, 1, N) && s.stats && typeof s.stats === 'object';
    if (!shapeOk) return { save: blankSave(s.level, { maxLevel, stats, allLevels: s.allLevels }), problem: 'part' };
    // If levels.js has changed since the save, keep only what still fits this level.
    const lv = LEVELS[s.level - 1], n = lv.letters.length;
    const words = new Set(lv.words.map(w => w.w)), cells = new Set(lv.words.flatMap(cellsOfWord));
    const bonus = new Set((lv.bonus || []).map(x => String(x).toUpperCase()));
    const order = s.order.length === n && identity(n).every(i => s.order.includes(i)) ? s.order.slice() : identity(n);
    const current = Array.isArray(s.current) ? s.current.filter((x, i, a) => isInt(x, 0, n - 1) && a.indexOf(x) === i) : [];
    const save = {
      v: 1, level: s.level, found: uniq(s.found.filter(w => words.has(w))), revealed: uniq(s.revealed.filter(k => cells.has(k))),
      bonus: uniq(s.bonus.filter(w => bonus.has(w))), order, current, maxLevel, stats
    };
    if (s.allLevels === true) save.allLevels = true;
    return { save, problem: null };
  }

  function load() {
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    const reloaded = nav ? nav.type === 'reload' : !!(performance.navigation && performance.navigation.type === 1);
    if (FRESH && !reloaded) store.del(SAVE_KEY);
    let { save, problem } = readSave();
    const fromNothing = !save;   // no readable save on this device (a first open, or problem 'all')
    if (levelParam !== null) {
      const n = Math.min(Math.max(levelParam || 1, 1), LEVELS.length);
      if (!save || save.level !== n) save = blankSave(n, save);
    }
    S = save || blankSave(1);
    if (fromNothing) S.allLevels = true;
    return problem;
  }

  /* ---------------- Layout: measured from the real viewport ---------------- */
  // Row heights, top to bottom. The compact set is used when the roomy one can't keep the minimum sizes
  // (big grids on small phones).
  // pad: margin around the squares (the scenery look paints a panel there); sp: least space between wheel letters;
  // margin: space above and below the wheel letters; ring: how far the disc reaches past the letters.
  const PRESETS = [
    { top: 46, gapTop: 8, status: 30, strip: 56, gapStrip: 8, tools: 50, gapTools: 10, gapWheel: 2, pad: 4, sp: 6, spRatio: 0.09, margin: 3, ring: 10 },
    { top: 44, gapTop: 2, status: 24, strip: 46, gapStrip: 3, tools: 44, gapTools: 3, gapWheel: 0, pad: 2, sp: 4, spRatio: 0, margin: 1, ring: 10 }
  ];
  const CAP = 66;                  // biggest grid square
  const gapFor = sq => (sq >= 52 ? 4 : sq >= 42 ? 3 : 2);
  // Every fixed size plan() uses. A screen bigger than a phone (an iPad, see iPadMode) multiplies them all by one
  // number, u; the phone's kit (u = 1) is the numbers above, untouched. dCap: the biggest wheel letters for 3, 4, and
  // 5 or more letters. sq1, d1, sq2, d0: plan()'s steps. letterFont, stripFont, line: the floors and cap in dims.
  const PHONE_KIT = { u: 1, presets: PRESETS, cap: CAP, gapFor, dCap: [92, 88, 84], sq1: 46, d1: 72, sq2: 52, d0: 64, letterFont: 40, stripFont: 40, line: 10 };
  // uCap: the wheel letters' own scale, when it isn't u (two columns, see iPadMode).
  function kitFor(u, uCap) {
    if (u === 1 && !uCap) return PHONE_KIT;
    const k = n => Math.round(n * u);
    const presets = PRESETS.map(P => {
      const out = {};
      Object.keys(P).forEach(key => { out[key] = key === 'spRatio' ? P[key] : k(P[key]); });
      return out;
    });
    return {
      u, presets, cap: k(CAP), gapFor: sq => (sq >= k(52) ? k(4) : sq >= k(42) ? k(3) : k(2)),
      dCap: PHONE_KIT.dCap.map(n => Math.round(n * (uCap || u))), sq1: k(46), d1: k(72), sq2: k(52), d0: k(64),
      letterFont: k(40), stripFont: k(40), line: k(10)
    };
  }

  // Letters sit on a ring. Six letters sit two on top, two at the sides and two below: same spacing, less height.
  function wheelGeom(n, d, P) {
    const sp = Math.max(P.sp, Math.round(d * P.spRatio));
    const R = Math.max(d / (2 * Math.sin(Math.PI / Math.max(n, 2))) + sp, 0.95 * d);
    const start = n === 6 ? -60 : -90;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = ((start + (i * 360) / n) * Math.PI) / 180;
      pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    const ys = pts.map(p => p.y), xs = pts.map(p => p.x);
    return {
      R, pts, h: Math.max(...ys) - Math.min(...ys) + d, w: Math.max(...xs) - Math.min(...xs) + d,
      mid: (Math.max(...ys) + Math.min(...ys)) / 2, disc: R + d / 2 + P.ring
    };
  }

  // Share the height between the grid and the wheel: grid squares up to 46 px first, then wheel letters up to 72,
  // squares up to 52, letters up to their cap, and finally squares up to CAP (each times u: K is the kit, see kitFor).
  // least (bigger screens only, see fillPlan): if the squares or the letters come out smaller than least's, they get
  // least's size and the other one gets what is left.
  function plan(P, innerW, innerH, lv, K, least) {
    const box = boxOf(lv), n = lv.letters.length, rows = box.rows, cols = box.cols, gapOf = K.gapFor;
    const room = innerH - (P.top + P.gapTop + P.status + P.strip + P.gapStrip + P.tools + P.gapTools + P.gapWheel) - 2 * P.pad;
    const gridH = sq => rows * (sq + gapOf(sq)) - gapOf(sq);
    const gridW = sq => cols * (sq + gapOf(sq)) - gapOf(sq);
    let sqMax = K.cap;
    while (sqMax > 16 && gridW(sqMax) > innerW - 2 * P.pad) sqMax--;
    let dMax = n <= 3 ? K.dCap[0] : n === 4 ? K.dCap[1] : K.dCap[2];
    while (dMax > 40 && wheelGeom(n, dMax, P).w > innerW - 4) dMax--;
    // wheelMin: just the letters. wheelFull: the whole disc behind them as well.
    const wheelMin = d => Math.ceil(wheelGeom(n, d, P).h) + 2 * P.margin;
    const wheelFull = d => Math.max(wheelMin(d), Math.ceil(2 * wheelGeom(n, d, P).disc) + 2 * P.margin);
    const sqFor = (d, wh) => { let s = sqMax; while (s > 16 && gridH(s) + wh(d) > room) s--; return s; };
    const dFor = (sq, wh) => { let d = dMax; while (d > 40 && gridH(sq) + wh(d) > room) d--; return d; };
    let d = Math.min(K.d0, dMax);
    let sq = sqFor(d, wheelMin);
    if (sq >= K.sq1) {
      d = Math.max(d, Math.min(K.d1, dFor(K.sq1, wheelMin)));
      sq = Math.min(K.sq2, sqFor(d, wheelMin));
      // Letters grow past this only while the whole disc still fits behind them.
      const dDisc = dFor(sq, wheelFull);
      if (dDisc >= d) { d = dDisc; sq = sqFor(d, wheelFull); } else sq = sqFor(d, wheelMin);
    }
    if (least && sq < least.sq) { sq = Math.min(least.sq, sqMax); d = dFor(sq, wheelFull); if (d < least.d) d = dFor(sq, wheelMin); }
    else if (least && d < least.d) { d = Math.min(least.d, dMax); sq = sqFor(d, wheelFull); if (sq < least.sq) sq = sqFor(d, wheelMin); }
    return { P, n, rows, cols, r0: box.r0, c0: box.c0, sq, d, room, gap: gapOf(sq), gridH: gridH(sq), gridW: gridW(sq), wheelMin: wheelMin(d) };
  }

  function bestPlan(innerW, innerH, lv, K) {
    let p = plan(K.presets[0], innerW, innerH, lv, K);
    const score = q => Math.min(q.sq / K.sq1, q.d / K.d0);   // 1 or more: both comfortably above the minimums
    if (score(p) < 1) { const q = plan(K.presets[1], innerW, innerH, lv, K); if (score(q) > score(p)) p = q; }
    return p;
  }

  // One column (a phone, or fill): the phone's plan, with every size times u. On a bigger screen, a level where that
  // gives smaller squares or letters than today's phone-width column would there keeps today's sizes instead: with
  // the roomy rows if they fit, else with the compact ones (as on a small phone).
  function fillPlan(lv) {
    const K = ipadNow.kit, p = bestPlan(inner.w, inner.h, lv, K);
    if (K === PHONE_KIT) return p;
    const least = bestPlan(ipadNow.todayW, inner.h, lv, PHONE_KIT);
    const meets = q => q.sq >= least.sq && q.d >= least.d;
    if (meets(p)) return p;
    for (const [i, l] of [[0, least], [1, null], [1, least]]) {
      const q = plan(K.presets[i], inner.w, inner.h, lv, K, l);
      if (meets(q)) return q;
    }
    return p;
  }

  // Two columns (split, sideways): the grid gets the whole left column below the top bar, and the wheel gets what the
  // status line, word strip and buttons leave of the right one. Its letters grow past d1 only while the whole disc fits.
  function planTwoCol(lv) {
    const K = ipadNow.kit, P = K.presets[0], colW = ipadNow.colW, box = boxOf(lv), n = lv.letters.length, gapOf = K.gapFor;
    const colH = inner.h - P.top - P.gapTop;
    const gridH = sq => box.rows * (sq + gapOf(sq)) - gapOf(sq);
    const gridW = sq => box.cols * (sq + gapOf(sq)) - gapOf(sq);
    let sq = K.cap;
    while (sq > 16 && (gridW(sq) > colW - 2 * P.pad || gridH(sq) > colH - 2 * P.pad)) sq--;
    const room = colH - (P.status + P.strip + P.gapStrip + P.tools + P.gapTools + P.gapWheel);
    let dMax = n <= 3 ? K.dCap[0] : n === 4 ? K.dCap[1] : K.dCap[2];
    while (dMax > 40 && wheelGeom(n, dMax, P).w > colW - 4) dMax--;
    const wheelMin = d => Math.ceil(wheelGeom(n, d, P).h) + 2 * P.margin;
    const wheelFull = d => Math.max(wheelMin(d), Math.ceil(2 * wheelGeom(n, d, P).disc) + 2 * P.margin);
    const dFit = wh => { let d = dMax; while (d > 40 && wh(d) > room) d--; return d; };
    const d = Math.max(Math.min(K.d1, dFit(wheelMin)), dFit(wheelFull));
    return {
      P, n, rows: box.rows, cols: box.cols, r0: box.r0, c0: box.c0, sq, d, room, gap: gapOf(sq), gridH: gridH(sq), gridW: gridW(sq),
      wheelMin: wheelMin(d), colH
    };
  }

  const planFor = lv => (ipadNow.twoCol ? planTwoCol(lv) : fillPlan(lv));

  // ?ipad= (see the header): how a screen wider than a phone is used. On a phone (430 points wide or less), and with
  // 'today', nothing changes: u = 1 and today's phone-width column.
  // fill: one column, and everything grows by u until the game is her iPhone 16e's (763 px tall inside the safe areas)
  // times u, or today's column (414 px wide inside its margins) times u, whichever comes first; u is 1 to 1.6.
  // split: fill when upright. Sideways (at least 900 wide and 1.2 times as wide as tall), two columns (splitScale).
  let ipadNow = { u: 1, twoCol: false, kit: PHONE_KIT, todayW: 0, colW: 0 };
  function iPadMode(W, H, app) {
    let u = 1, twoCol = false, width = 430, uCap = 0, side = 16;
    if (IPAD !== 'today' && W > 430) {
      const cs = getComputedStyle(app);
      const usableH = H - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      side = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const fillU = (colMax, h) => Math.floor(Math.min(1.6, Math.max(1, Math.min((colMax - side) / 414, h / 763))) * 100) / 100;
      twoCol = IPAD === 'split' && W >= 900 && W / H >= 1.2;
      if (twoCol) {
        width = Math.min(W - 32, 1000);
        uCap = fillU(Math.max(430, H - 16), W - (H - usableH));   // fill's u if this screen were turned upright
        u = splitScale(width - side, usableH, uCap);
      } else {
        const colMax = Math.max(430, W - 16);
        u = fillU(colMax, usableH);
        width = Math.min(colMax, Math.round(430 * u));
      }
    }
    // Nothing is set when nothing grows (a phone, 'today', or fill on a sideways iPad): today's column exactly.
    const root = document.documentElement.style;
    if (u === 1 && !twoCol) { root.removeProperty('--u'); app.style.removeProperty('max-width'); }
    else { root.setProperty('--u', String(u)); app.style.maxWidth = width + 'px'; }
    app.classList.toggle('two-col', twoCol);
    ipadNow = { u, twoCol, kit: kitFor(u, twoCol ? Math.max(u, uCap) : 0), todayW: 430 - side, colW: 0 };
  }

  // Two columns: the largest u from 1 to 1.5 where the right column is her iPhone's width (374 px inside its margins)
  // times u or wider, so every label fits as it does there, and holds the status line, word strip, buttons and a wheel
  // with every level's letters at their cap (scaled by uCap: never smaller than upright) and the whole disc showing.
  function splitScale(innerW, innerH, uCap) {
    const counts = uniq(LEVELS.map(lv => lv.letters.length));
    for (let c = 150; c > 100; c--) {
      const u = c / 100, K = kitFor(u, Math.max(u, uCap)), P = K.presets[0], colW = (innerW - 24 * u) / 2;
      const room = innerH - (P.top + P.gapTop + P.status + P.strip + P.gapStrip + P.tools + P.gapTools + P.gapWheel);
      const fits = n => {
        const g = wheelGeom(n, n <= 3 ? K.dCap[0] : n === 4 ? K.dCap[1] : K.dCap[2], P);
        return g.w <= colW - 4 && Math.ceil(2 * g.disc) + 2 * P.margin <= room;
      };
      if (colW >= 374 * u && counts.every(fits)) return u;
    }
    return 1;
  }

  // Text sizes grow with u too (u = 1 on a phone: the same numbers).
  const byU = n => Math.round(n * ipadNow.u);

  function layout() {
    const vv = window.visualViewport;
    const W = vv ? vv.width : window.innerWidth, H = Math.floor(vv ? vv.height : window.innerHeight);
    const root = document.documentElement.style;
    // The phone reports its safe areas; when it doesn't (a browser tab, or tests), assume a notched phone if the
    // screen is tall, and a phone with a Home button otherwise.
    const tall = H / W > 2.05;
    root.setProperty('--safe-top-min', (tall ? 47 : 20) + 'px');
    root.setProperty('--safe-bottom-min', (tall ? 34 : 6) + 'px');
    root.setProperty('--modal-max', (H - 32) + 'px');
    const app = $('app');
    iPadMode(W, H, app);
    app.style.height = H + 'px';
    const cs = getComputedStyle(app);
    const innerW = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const innerH = H - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    inner = { w: innerW, h: innerH };
    if (ipadNow.twoCol) ipadNow.colW = (innerW - 24 * ipadNow.u) / 2;   // the grid's gap is calc(24px * var(--u))

    const K = ipadNow.kit, twoCol = ipadNow.twoCol;
    const p = planFor(L);
    const P = p.P;
    const geo = wheelGeom(p.n, p.d, P);
    // One column: the wheel gets its letters' height and what the grid leaves, up to its disc; the grid, the rest.
    // Two columns: the grid gets the left column, and the wheel the rest of the right one.
    let wheelH, gridAreaH;
    if (twoCol) { wheelH = Math.floor(p.room); gridAreaH = Math.floor(p.colH); }
    else {
      const extra = Math.max(0, p.room - p.gridH - p.wheelMin);
      wheelH = Math.floor(Math.min(p.wheelMin + extra, Math.max(p.wheelMin, Math.ceil(2 * geo.disc) + 4)));
      gridAreaH = Math.floor(p.room + 2 * P.pad - wheelH);
    }

    const topbar = document.querySelector('.topbar');
    topbar.style.height = P.top + 'px';
    topbar.style.marginBottom = P.gapTop + 'px';
    document.querySelectorAll('.pill').forEach(el => { el.style.height = P.top + 'px'; });
    $('grid-area').style.height = gridAreaH + 'px';
    $('status-row').style.height = P.status + 'px';
    $('status').style.lineHeight = (P.status - 2) + 'px';
    $('strip-row').style.height = P.strip + 'px';
    $('strip-row').style.marginBottom = P.gapStrip + 'px';
    $('tools-row').style.height = P.tools + 'px';
    $('tools-row').style.marginBottom = P.gapTools + 'px';
    const wheel = $('wheel');
    wheel.style.height = wheelH + 'px';
    wheel.style.marginBottom = P.gapWheel + 'px';

    const discFits = wheelH >= 2 * geo.disc;
    const cx = (twoCol ? ipadNow.colW : innerW) / 2, cy = discFits ? wheelH / 2 : wheelH / 2 - geo.mid;
    dims = {
      sq: p.sq, gap: p.gap, pad: P.pad, rows: p.rows, cols: p.cols, r0: p.r0, c0: p.c0, d: p.d, cx, cy, wheelH,
      pos: geo.pts.map(pt => ({ x: cx + pt.x, y: cy + pt.y })),
      disc: discFits ? geo.disc - 2 : Math.max(0, Math.min(geo.disc, cy - 2, wheelH - cy - 2)),
      letterFont: Math.max(K.letterFont, Math.round(p.d * 0.6)),
      gridFont: Math.round(p.sq * 0.86),   // ink (cap height) about 60% of the square, per the spec
      stripFont: Math.min(K.stripFont, Math.round(P.strip * 0.7)),
      line: Math.max(K.line, Math.round(p.d * 0.17))
    };
    buildGrid();
    buildWheel();
  }

  function buildGrid() {
    const grid = $('grid');
    grid.innerHTML = '';
    cellEls = new Map();
    const pitch = dims.sq + dims.gap;
    grid.style.width = (dims.cols * pitch - dims.gap + 2 * dims.pad) + 'px';
    grid.style.height = (dims.rows * pitch - dims.gap + 2 * dims.pad) + 'px';
    const keys = [...cellLetter.keys()].sort((a, b) => { const [ar, ac] = a.split(',').map(Number), [br, bc] = b.split(',').map(Number); return ar - br || ac - bc; });
    for (const k of keys) {
      const [r, c] = k.split(',').map(Number);
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.r = r;
      el.dataset.c = c;
      el.setAttribute('role', 'img');
      Object.assign(el.style, {
        left: (dims.pad + (c - dims.c0) * pitch) + 'px', top: (dims.pad + (r - dims.r0) * pitch) + 'px',
        width: dims.sq + 'px', height: dims.sq + 'px', fontSize: dims.gridFont + 'px'
      });
      grid.appendChild(el);
      cellEls.set(k, el);
    }
  }

  function buildWheel() {
    const wheel = $('wheel');
    wheel.querySelectorAll('.wheel-letter').forEach(el => el.remove());
    letterEls = L.letters.split('').map((ch, i) => {
      const el = document.createElement('div');
      el.className = 'wheel-letter';
      el.dataset.i = i;
      el.textContent = ch;
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, { width: dims.d + 'px', height: dims.d + 'px', fontSize: dims.letterFont + 'px' });
      wheel.appendChild(el);
      return el;
    });
    const disc = $('wheel-disc');
    disc.setAttribute('cx', dims.cx);
    disc.setAttribute('cy', dims.cy);
    disc.setAttribute('r', dims.disc);
    $('path-core').setAttribute('stroke-width', dims.line);
    $('path-edge').setAttribute('stroke-width', dims.line + 6);
    positionLetters();
  }

  function positionLetters() {
    S.order.forEach((li, slot) => {
      const p = dims.pos[slot], el = letterEls[li];
      el.style.left = (p.x - dims.d / 2) + 'px';
      el.style.top = (p.y - dims.d / 2) + 'px';
    });
  }

  /* ---------------- Painting ---------------- */
  function paintAll() { paintTitle(); paintGrid(); paintWheel(); paintStrip(); paintStatus(); paintTools(); }

  function paintTitle() {
    const title = $('level-title');
    title.textContent = T.t('level', { n: S.level });
    // It sits centered between Menu and Help, and shrinks a little if a longer language needs it.
    let size = byU(23);
    title.style.fontSize = size + 'px';
    while (title.scrollWidth > title.clientWidth + 1 && size > byU(18)) { size -= 1; title.style.fontSize = size + 'px'; }
  }

  function paintGrid() {
    for (const [k, el] of cellEls) {
      const on = shown.has(k) && !ui.landing.has(k);
      el.classList.toggle('shown', on);
      const ch = on ? cellLetter.get(k) : '';
      if (el.textContent !== ch) el.textContent = ch;
      el.setAttribute('aria-label', T.t('square', { r: +el.dataset.r + 1, c: +el.dataset.c + 1, v: on ? ch : T.t('blank') }));
    }
    $('grid').classList.toggle('picking', ui.pick);
  }

  function paintWheel(finger) {
    letterEls.forEach((el, i) => el.classList.toggle('on', S.current.includes(i)));
    const pts = S.current.map(i => dims.pos[S.order.indexOf(i)]);
    if (finger && pts.length) pts.push(finger);
    const str = pts.length > 1 ? pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') : '';
    $('path-edge').setAttribute('points', str);
    $('path-core').setAttribute('points', str);
  }

  function paintStrip() {
    const word = ui.shakeWord || currentWord();
    const el = $('strip');
    el.innerHTML = word.split('').map(ch => `<span class="sl">${ch}</span>`).join('');
    el.setAttribute('aria-label', T.t('stripLabel') + ': ' + word);
    let size = dims.stripFont;
    el.style.fontSize = size + 'px';
    const room = el.clientWidth - byU(14);
    const width = () => [...el.children].reduce((w, s) => w + s.offsetWidth + 2, 0);
    while (word && width() > room && size > byU(22)) { size -= 1; el.style.fontSize = size + 'px'; }
  }

  function paintStatus() {
    const el = $('status');
    let html;
    if (ui.msg) html = T.t(ui.msg.key, ui.msg.vars);
    else if (ui.pick) html = T.t('tapBlank');
    else {
      const left = L.words.length - S.found.length;
      html = left <= 0 ? T.t('allFound') : left === 1 ? T.t('left1') : T.t('left', { n: left });
    }
    el.innerHTML = html;
    const badge = $('bonus-badge');
    badge.hidden = !S.bonus.length;
    badge.textContent = T.t('bonus', { n: S.bonus.length });
    const fit = () => {
      let size = byU(20);
      el.style.fontSize = size + 'px';
      while (el.scrollWidth > el.clientWidth + 1 && size > byU(18)) { size -= 1; el.style.fontSize = size + 'px'; }
    };
    fit();
    // A long message on a narrow phone borrows the badge's room until it clears.
    if (el.scrollWidth > el.clientWidth + 1 && !badge.hidden) { badge.hidden = true; fit(); }
  }

  function paintTools() {
    $('pick').setAttribute('aria-pressed', String(ui.pick));
  }

  // Tool labels shrink a little (never below 18 px, times u) if a longer language needs it.
  function fitTools() {
    document.querySelectorAll('.tool').forEach(b => {
      let size = byU(19);
      b.style.fontSize = size + 'px';
      while (b.scrollWidth > b.clientWidth + 1 && size > byU(18)) { size -= 1; b.style.fontSize = size + 'px'; }
    });
  }

  function say(key, vars) {
    clearTimeout(ui.msgTimer);
    ui.msg = { key, vars };
    ui.msgTimer = setTimeout(() => { ui.msg = null; paintStatus(); }, MSG_MS);
    paintStatus();
  }
  function quiet() { clearTimeout(ui.msgTimer); ui.msg = null; }

  function track(promise) {
    ui.flights.add(promise);
    promise.finally(() => ui.flights.delete(promise));
    return promise;
  }

  /* ---------------- Player actions ---------------- */
  function addLetter(i) {
    ui.shakeWord = null;
    S.current.push(i);
    sound('tick', S.current.length);
    saveGame();
    paintStrip();
  }

  function removeLast() {
    if (!S.current.length) return;
    S.current.pop();
    sound('untick');
    saveGame();
    paintStrip();
  }

  function submit(fromEnter) {
    if (ui.locked) return;
    const word = currentWord();
    if (!word) return;
    if (word.length < MIN_LEN) { if (fromEnter) say('need3'); return; }
    const kind = classify(word);
    const fromRects = [...$('strip').children].map(el => el.getBoundingClientRect());
    S.current = [];
    if (kind === 'grid') {
      const wi = L.words.findIndex(w => w.w === word);
      const before = new Set(shown);
      S.found.push(word);
      computeShown();
      const extra = autoFound();
      const complete = isComplete();
      if (complete) ui.locked = true;
      saveGame();
      sound('chime');
      quiet();
      const cells = wordCells[wi];
      cells.filter(k => !before.has(k)).forEach(k => ui.landing.add(k));
      paintAll();
      const flight = FX.flyLetters(cells.map((k, j) => ({ from: fromRects[j], to: cellEls.get(k), ch: word[j] })), { duration: 350 })
        .then(() => {
          cells.forEach(k => ui.landing.delete(k));
          paintGrid();
          return FX.pop(uniq([...cells, ...extra.flatMap(i => wordCells[i])]).map(k => cellEls.get(k)).filter(Boolean));
        });
      track(flight);
      if (complete) levelComplete();
      return;
    }
    saveGame();
    paintWheel();
    if (kind === 'found') {
      const wi = L.words.findIndex(w => w.w === word);
      track(FX.flash(wordCells[wi].map(k => cellEls.get(k)), cssVar('--flash', '#fcd34d')));
      say('already', { word });
      paintStrip();
    } else if (kind === 'bonus') {
      S.bonus.push(word);
      S.stats.bonusTotal += 1;
      saveGame();
      sound('sparkle');
      say('niceFind', { word });
      paintStrip();
      FX.pop([$('bonus-badge')]);
    } else if (kind === 'bonusFound') {
      say('already', { word });
      paintStrip();
    } else {
      // Not a word in this puzzle: the strip shakes "no", two buzzes, and the marimba if sound is on.
      ui.shakeWord = word;
      paintStrip();
      FX.buzz(2);
      sound('nope');
      say('notHere', { word });
      const hold = new Promise(res => setTimeout(res, FX.reduced() ? FX.ms(700) : 0));
      Promise.all([FX.shake($('strip')), hold]).then(() => {
        if (ui.shakeWord === word) { ui.shakeWord = null; paintStrip(); }
      });
    }
  }

  function revealCell(k) {
    if (shown.has(k) || !cellLetter.has(k)) return;
    S.revealed.push(k);
    S.stats.hintsUsed += 1;
    computeShown();
    const added = autoFound();
    const complete = isComplete();
    if (complete) ui.locked = true;
    saveGame();
    if (added.length) quiet();
    paintAll();
    sound(added.length ? 'chime' : 'reveal');
    track(FX.pop(uniq([k, ...added.flatMap(i => wordCells[i])]).map(x => cellEls.get(x)).filter(Boolean)));
    if (complete) levelComplete();
  }

  function hint() {
    if (ui.locked) return;
    const k = hintCell();
    if (k) revealCell(k);
  }

  function togglePick() {
    if (ui.locked) return;
    ui.pick = !ui.pick;
    quiet();
    paintGrid();
    paintStatus();
    paintTools();
  }

  function pickCell(el) {
    if (!ui.pick || ui.locked) return;
    const k = keyOf(el.dataset.r, el.dataset.c);
    if (shown.has(k)) { say('showing'); return; }
    ui.pick = false;
    paintTools();
    revealCell(k);
  }

  function shuffle() {
    if (ui.locked || g) return;
    const n = S.order.length;
    if (n < 2) return;
    const old = letterEls.map(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));
    let o;
    do {
      o = S.order.slice();
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    } while (o.every((x, i) => x === S.order[i]));
    S.order = o;
    saveGame();
    positionLetters();
    paintWheel();
    sound('shuffle');
    letterEls.forEach((el, i) => FX.slideFrom(el, old[i].x - parseFloat(el.style.left), old[i].y - parseFloat(el.style.top)));
  }

  async function levelComplete() {
    if (ui.completing) return;
    ui.completing = true;
    ui.locked = true;
    ui.pick = false;
    S.current = [];
    S.stats.levelsDone += 1;
    saveGame();
    paintAll();
    await Promise.all([...ui.flights]);
    sound('fanfare');
    const items = [...cellEls.entries()].map(([k, el]) => { const [r, c] = k.split(',').map(Number); return { el, step: r + c }; });
    await FX.wave(items, cssVar('--glow', '#fcd34d'));
    showResults();
  }

  function startLevel(n) {
    S = blankSave(n, S);
    g = null;
    Object.assign(ui, { pick: false, locked: false, completing: false, shakeWord: null });
    ui.landing.clear();
    quiet();
    prepareLevel();
    computeShown();
    saveGame();
    layout();
    paintAll();
  }

  function nextLevel() {
    closeDialogs(true);
    startLevel(S.level >= LEVELS.length ? 1 : S.level + 1);
  }

  const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  /* ---------------- The wheel: swipe or tap ---------------- */
  // Swipe: entering another letter adds it; entering the previous letter again takes the last one away; lifting
  // submits when the finger went from one letter to another and the word has 3+ letters (a shorter swipe just leaves
  // its letters in the strip). Tap: a press that never enters a second letter, however long it is held and however far
  // it drifts, adds that letter; pressing the last letter again takes it away; a used letter that isn't the last does
  // nothing but a soft buzz. After the first press, letters are picked up only inside an inner circle (70% of the
  // drawn one), so a drifting finger doesn't grab a neighbor. Mouse, pen and touch are handled the same way.
  const wheel = $('wheel');
  let lastWheelDown = -1e9;
  const localPoint = e => { const r = wheel.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function letterNear(p, radius) {
    let best = null, bestD = Infinity;
    S.order.forEach((li, slot) => {
      const q = dims.pos[slot], dd = Math.hypot(p.x - q.x, p.y - q.y);
      if (dd <= radius && dd < bestD) { best = li; bestD = dd; }
    });
    return best;
  }
  const innerRadius = () => (dims.d / 2) * 0.7;

  function begin(hit, pressed) {
    g.first = hit;
    g.inside = hit;
    const cur = S.current;
    if (!cur.includes(hit)) addLetter(hit);
    else if (cur[cur.length - 1] === hit) g.removeOnTap = pressed;
    else { g.dead = true; if (pressed) FX.buzz(1); }
  }

  function enterLetter(hit) {
    if (g.first === null) { begin(hit, false); return; }
    if (g.dead) return;
    const cur = S.current;
    if (!g.crossed && hit === g.first) return;   // drifted out and back into the first letter: still a tap
    if (cur.length >= 2 && hit === cur[cur.length - 2]) { removeLast(); g.crossed = true; }
    else if (!cur.includes(hit)) { addLetter(hit); g.crossed = true; }
  }

  wheel.addEventListener('pointerdown', e => {
    if (g || ui.locked || !dims) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    lastWheelDown = performance.now();
    e.preventDefault();
    try { wheel.setPointerCapture(e.pointerId); } catch (err) { /* window listeners still see the gesture */ }
    const p = localPoint(e);
    g = { id: e.pointerId, first: null, inside: null, crossed: false, removeOnTap: false, dead: false, last: p };
    const hit = letterNear(p, dims.d / 2);   // the first press counts anywhere on the drawn circle
    if (hit !== null) begin(hit, true);
    paintWheel();
  });

  window.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    const p = localPoint(e);
    // Walk the finger's path in small steps so a quick slide can't jump over a letter.
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - g.last.x, p.y - g.last.y) / 6));
    for (let s = 1; s <= steps; s++) {
      const q = { x: g.last.x + ((p.x - g.last.x) * s) / steps, y: g.last.y + ((p.y - g.last.y) * s) / steps };
      const hit = letterNear(q, innerRadius());
      if (hit !== g.inside) { if (hit !== null) enterLetter(hit); g.inside = hit; }
    }
    g.last = p;
    paintWheel(g.first !== null && !g.dead ? p : null);
  });

  function endGesture(e, cancelled) {
    if (!g || e.pointerId !== g.id) return;
    const gg = g;
    g = null;
    try { wheel.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    if (!cancelled && !gg.dead) {
      if (gg.crossed) { if (S.current.length >= MIN_LEN) { submit(false); paintWheel(); return; } }
      else if (gg.removeOnTap) removeLast();
    }
    saveGame();
    paintWheel();
    paintStrip();
  }
  window.addEventListener('pointerup', e => endGesture(e, false));
  window.addEventListener('pointercancel', e => endGesture(e, true));

  // A click with no press before it (a screen reader, or a script) counts as a tap on that letter.
  wheel.addEventListener('click', e => {
    if (performance.now() - lastWheelDown < 1500 || ui.locked) return;
    const el = e.target.closest && e.target.closest('.wheel-letter');
    if (!el) return;
    const i = +el.dataset.i, cur = S.current;
    if (!cur.includes(i)) addLetter(i);
    else if (cur[cur.length - 1] === i) removeLast();
    else FX.buzz(1);
    paintWheel();
  });

  /* ---------------- Dialogs ---------------- */
  let returnFocus = null;
  function openDialog(id) {
    document.querySelectorAll('.overlay').forEach(o => { o.hidden = true; });
    if (!returnFocus) returnFocus = document.activeElement;
    const o = $(id);
    o.hidden = false;
    const body = o.querySelector('.dlg-body');
    if (body) body.scrollTop = 0;
    // Focus goes to the dialog box itself (for VoiceOver), so no button shows a focus ring it wasn't given.
    const box = o.querySelector('.dialog');
    box.setAttribute('tabindex', '-1');
    box.focus({ preventScroll: true });
  }
  function closeDialogs(force) {
    if (!force && !$('results-dialog').hidden) return;   // the results close only with Next level
    document.querySelectorAll('.overlay').forEach(o => { o.hidden = true; });
    if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  function showResults() {
    const last = S.level >= LEVELS.length;
    $('results-title').textContent = T.t('levelDone', { n: S.level });
    let body = `<p class="big">${T.t('wordsFound', { n: S.found.length })}</p>`;
    body += `<p class="found-list">${S.found.join(', ')}</p>`;
    body += `<p>${T.t('bonusFound', { n: S.bonus.length })}</p>`;
    if (S.bonus.length) body += `<p class="found-list">${S.bonus.join(', ')}</p>`;
    body += `<p class="note">${T.t('levelsDone', { n: S.stats.levelsDone })}</p>`;
    if (last) body += `<p class="note">${T.t('lastLevel', { n: LEVELS.length })}</p>`;
    $('results-body').innerHTML = body;
    openDialog('results-dialog');
  }

  function showNotice(text) {
    $('notice-body').textContent = text;
    openDialog('notice-dialog');
  }

  function showSettings() {
    const group = (title, key, opts, current) => `<div class="setting"><h3>${title}</h3><div class="seg">` +
      opts.map(([val, label]) => `<button type="button" data-set="${key}" data-val="${val}" aria-pressed="${String(current) === String(val)}">${label}</button>`).join('') +
      '</div></div>';
    $('settings-body').innerHTML =
      group(T.t('sound'), 'sound', [['false', T.t('off')], ['true', T.t('on')]], settings.sound) +
      group(T.t('language'), 'lang', T.LANGS.map(l => [l, T.langName(l)]), T.lang);
    openDialog('settings-dialog');
  }

  let gotoVal = 1;
  const gotoMax = () => (S.allLevels === true ? LEVELS.length : S.maxLevel);   // see blankSave
  function paintGoto() {
    $('goto-value').textContent = gotoVal;
    $('goto-body').textContent = S.allLevels === true ? T.t('gotoBodyAll', { n: LEVELS.length }) : T.t('gotoBody', { n: S.maxLevel });
  }
  function showGoto() { gotoVal = S.level; paintGoto(); openDialog('goto-dialog'); }
  const stepGoto = by => { gotoVal = Math.min(gotoMax(), Math.max(1, gotoVal + by)); paintGoto(); };

  function applyLanguage() {
    document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = T.t(el.dataset.t); });
    $('rules').innerHTML = T.t('rules').map(r => `<li>${r}</li>`).join('');
    document.title = T.t('title');
    $('wheel').setAttribute('aria-label', T.t('wheelLabel'));
    $('grid').setAttribute('aria-label', T.t('gridLabel'));
  }

  /* ---------------- Wiring ---------------- */
  document.addEventListener('pointerdown', () => { if (settings.sound) FX.unlock(); }, true);   // phones only allow sound after a touch

  // From Claude Hearts. Mom holds her finger on the glass longer than most people, and her finger sometimes slides a
  // little before it lifts. Nothing here is meant to be selected or copied, and a press that starts on a button counts
  // as a tap if it lifts on it or close to it (SLIDE px), however long it was held. Safari drops the click after a long
  // hold or a slide, so send one ourselves then, and ignore Safari's own click if it comes as well.
  // Presses on the wheel and on the grid (Pick a square) have their own handlers.
  const SLIDE = 44;
  document.addEventListener('selectstart', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());
  let press = null, sent = null;
  document.addEventListener('pointerdown', e => {
    sent = null;   // a new press: Safari's click for the last one, if it was coming, has already come
    const t = e.target;
    if (!t.closest || t.closest('#wheel')) { press = null; return; }
    const b = t.closest('button');
    press = b ? { b, id: e.pointerId, at: performance.now(), x: e.clientX, y: e.clientY } : null;
  }, true);
  document.addEventListener('pointercancel', () => { press = null; }, true);
  document.addEventListener('pointerup', e => {
    const p = press;
    press = null;
    if (!p || e.pointerId !== p.id || p.b.disabled || !p.b.isConnected) return;
    const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8;
    if (!moved && performance.now() - p.at < 450) return;   // an ordinary tap clicks by itself
    const r = p.b.getBoundingClientRect();
    const near = e.clientX > r.left - SLIDE && e.clientX < r.right + SLIDE && e.clientY > r.top - SLIDE && e.clientY < r.bottom + SLIDE;
    if (!near) return;
    sent = performance.now() + 500;
    p.b.click();
  }, true);
  document.addEventListener('click', e => {
    if (!e.isTrusted || !sent) return;
    if (performance.now() < sent) { e.stopPropagation(); e.preventDefault(); }
    sent = null;
  }, true);

  $('back').addEventListener('click', () => { if (ui.locked || g) return; removeLast(); paintWheel(); });
  $('enter').addEventListener('click', () => { if (g) return; submit(true); paintWheel(); });
  $('shuffle').addEventListener('click', shuffle);
  $('hint').addEventListener('click', hint);
  $('pick').addEventListener('click', togglePick);
  // Pick a square: the press picks the nearest square within 44 x 44 px of its center (squares can be smaller than
  // that on small phones), and it counts however long it is held, as long as it lifts within SLIDE px.
  let gridPress = null;
  function cellNear(x, y) {
    const reach = Math.max(22, dims.sq / 2);
    let best = null, bestD = Infinity;
    for (const el of cellEls.values()) {
      const r = el.getBoundingClientRect(), dx = Math.abs(x - (r.left + r.width / 2)), dy = Math.abs(y - (r.top + r.height / 2));
      if (dx <= reach && dy <= reach && Math.hypot(dx, dy) < bestD) { best = el; bestD = Math.hypot(dx, dy); }
    }
    return best;
  }
  $('grid-area').addEventListener('pointerdown', e => {
    gridPress = ui.pick && !ui.locked ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
  });
  window.addEventListener('pointerup', e => {
    const p = gridPress;
    gridPress = null;
    if (!p || e.pointerId !== p.id || Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLIDE) return;
    const el = cellNear(p.x, p.y);
    if (el) pickCell(el);
  });
  window.addEventListener('pointercancel', () => { gridPress = null; });
  // A click with no press before it (a screen reader, or a script) on a square.
  $('grid').addEventListener('click', e => { const el = e.target.closest('.cell'); if (el) pickCell(el); });
  $('menu-button').addEventListener('click', () => openDialog('menu-dialog'));
  $('help-button').addEventListener('click', () => openDialog('help-dialog'));
  $('menu-help').addEventListener('click', () => openDialog('help-dialog'));
  $('menu-settings').addEventListener('click', showSettings);
  $('menu-goto').addEventListener('click', showGoto);
  $('menu-new').addEventListener('click', () => openDialog('new-dialog'));
  $('confirm-new').addEventListener('click', () => { closeDialogs(true); S.maxLevel = 1; startLevel(1); });
  $('next-level').addEventListener('click', nextLevel);
  $('goto-minus').addEventListener('click', () => stepGoto(-1));
  $('goto-plus').addEventListener('click', () => stepGoto(1));
  $('goto-minus10').addEventListener('click', () => stepGoto(-10));
  $('goto-plus10').addEventListener('click', () => stepGoto(10));
  $('goto-go').addEventListener('click', () => { closeDialogs(true); if (gotoVal !== S.level) startLevel(gotoVal); });
  $('settings-body').addEventListener('click', e => {
    const b = e.target.closest('button[data-set]');
    if (!b) return;
    if (b.dataset.set === 'sound') {
      settings.sound = b.dataset.val === 'true';
      if (settings.sound) FX.sound('chime');   // a sample, so she hears what "on" means
    } else {
      settings.lang = b.dataset.val;
      T.set(settings.lang);
      applyLanguage();
      fitTools();
      paintAll();
    }
    store.set(SET_KEY, settings);
    showSettings();
  });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialogs()));
  document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeDialogs(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDialogs(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveIfChanged(); });
  window.addEventListener('pagehide', saveIfChanged);

  // A redraw would cut short letters in flight or a swipe in progress, so it waits for them.
  let resizeTimer = null;
  const relayout = () => {
    if (ui.flights.size || g) { resizeTimer = setTimeout(relayout, 150); return; }
    layout();
    fitTools();
    paintAll();
  };
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(relayout, 80); };
  window.addEventListener('resize', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* still playable online */ });
  }

  // For automated tests only (documented at the top of this file).
  window.__wordwheel = {
    state: () => ({
      levelIndex: S.level - 1, found: S.found.slice(), revealed: S.revealed.slice(), bonusFound: S.bonus.slice(),
      current: currentWord(), order: S.order.slice(), allLevels: S.allLevels === true
    }),
    level: () => L,
    letterCenter(i) {
      const slot = S.order.indexOf(+i);
      if (slot < 0) return null;
      const r = wheel.getBoundingClientRect(), p = dims.pos[slot];
      return { x: r.left + p.x, y: r.top + p.y };
    },
    cellRect(r, c) {
      const el = cellEls.get(keyOf(r, c));
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
    },
    rules: RULES,
    saveKey: SAVE_KEY,
    sizes: () => ({ cell: dims.sq, letter: dims.d, letterFont: dims.letterFont, gridFont: dims.gridFont, stripFont: dims.stripFont }),
    // The grid square and wheel letter sizes level N (1-based) would get on this screen, without opening it.
    sizesFor: n => { const p = planFor(LEVELS[n - 1]); return { cell: p.sq, letter: p.d }; },
    ipad: () => ({ option: IPAD, u: ipadNow.u, twoCol: ipadNow.twoCol })
  };

  /* ---------------- Start ---------------- */
  applyLanguage();
  if (!LEVELS.length) { $('status').textContent = 'levels.js is missing'; return; }
  const problem = load();
  prepareLevel();
  computeShown();
  autoFound();
  layout();
  fitTools();
  paintAll();
  window.__wordwheelReady = true;   // the first level is drawn (boot-check.js checks for this)
  saveGame();
  if (problem) showNotice(problem === 'all' ? T.t('restoreFail') : T.t('restorePart', { n: S.level }));
  else if (isComplete()) { ui.locked = true; ui.completing = true; showResults(); }
})();
