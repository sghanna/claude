/* Hearts (Claude): screen, taps, saving and pacing. Rules and computer players are in rules.js. */
(function () {
  'use strict';

  const H = window.Hearts, T = window.I18N;
  const YOU = 0;
  const COLS = [1, 2, 3, 0];                 // name plates left to right: Michael, Jerry, Barbara, You
  const SUIT_ORDER = ['C', 'D', 'S', 'H'];   // hand rows, alternating black / red
  // Deeper red than Solitaire's #c62f27, picked by Shawn after a WCAG check (Sept 24, 2026): 7.2:1 on the card, 5.4:1 dimmed.
  const INK = { red: '#a81f1a', black: '#1b0a0a' };
  const SAVE_KEY = 'claude-hearts-game-v1', SET_KEY = 'claude-hearts-settings-v1', STATS_KEY = 'claude-hearts-stats-v1';
  const SPEEDS = { slow: { ai: 1300, pause: 3800 }, normal: { ai: 800, pause: 2400 } };

  const params = new URLSearchParams(location.search);
  const FAST = params.get('fast') === '1';   // automated tests only
  const SEED = params.get('seed');
  // Options pages only: ?demo= shows a staged moment and never saves; ?celebrate= and ?playable= pick a style.
  const DEMO = params.get('demo');
  // Celebration for each moment (Shawn's picks, Sept 24, 2026). ?celebrate= overrides all three on the options pages.
  const STYLE_FOR = { win: 'lanterns', clean: 'cards', moon: 'moonhearts' };
  const CELEBRATE = ['ribbon', 'cards', 'lanterns', 'moon', 'moonhearts'].includes(params.get('celebrate')) ? params.get('celebrate') : null;
  const styleFor = kind => CELEBRATE || STYLE_FOR[kind];
  // How playable cards are shown; Shawn picked 'both' (outline plus a light dim) on Sept 24, 2026.
  // WCAG-minded alternatives for the options page: 'soft' (lighter dim), 'deepred' (deeper red ink), 'ring' (no dim).
  const PLAYABLE = ['outline', 'dim', 'both', 'soft', 'deepred', 'ring', 'grey', 'ghost'].includes(params.get('playable')) ? params.get('playable') : 'both';
  if (params.get('red') === 'classic') INK.red = '#c62f27';   // options pages: show the earlier choices as they were
  // Shawn's picks after Mom's playtest (Sept 24, 2026) are the defaults; the options pages pass the other choices.
  // A tap on a card she can't play: it shakes "no", then the cards she can play hop ('both'). Also 'together', 'twice', 'shake', 'hop', 'none'.
  const NOPE = ['shake', 'hop', 'none', 'together', 'twice'].includes(params.get('nope')) ? params.get('nope') : 'both';
  const ARRIVE = ['glide', 'onebyone', 'none'].includes(params.get('arrive')) ? params.get('arrive') : 'glide';   // passed cards go into her hand
  const NOPE_SOUNDS = ['illegal', 'nope', 'nopeNuh', 'nopeMarimba', 'nopeKnock', 'nopeSlide', 'nopeBuzz'];
  const NOPE_SOUND = NOPE_SOUNDS.includes(params.get('nopesound')) ? params.get('nopesound') : 'nope';
  // Top bar: logo on, no gold border on Help and Menu, biggest points badge. ?logo=0, ?pillborder=1, ?badge=now|big show the others.
  const look = document.documentElement.classList;
  if (params.get('logo') === '0') look.add('no-logo');
  if (params.get('pillborder') === '1') look.add('pill-border');
  if (['now', 'big'].includes(params.get('badge'))) look.add('badge-' + params.get('badge'));
  if (FAST) FX.setSpeedScale(0.04);

  const $ = id => document.getElementById(id);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { if (DEMO) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: play without saving */ } }
  };

  let settings = Object.assign({ lang: null, speed: 'slow', sound: false }, store.get(SET_KEY) || {});
  if (params.get('lang')) settings.lang = params.get('lang');
  T.set(settings.lang || T.detect());

  const rng = SEED ? H.makeRng(+SEED) : Math.random;
  let st = null, message = null, timers = [];
  let dims = { cw: 68, ch: 96, tw: 72, th: 100, lineW: 370, cardGap: 5, strip: 50 };
  // Screen-only state that is never saved: a short announcement, the plate that just took a trick, etc.
  const ui = { banner: null, bannerTimer: null, took: null, prevPts: [0, 0, 0, 0], newBest: false, busy: false };
  let stats = Object.assign({ games: 0, wins: 0, best: null, clean: 0, moons: 0 }, store.get(STATS_KEY) || {});
  const sound = kind => { if (settings.sound) FX.sound(kind); };

  /* ---------------- Saving ---------------- */
  function load() {
    const saved = SEED ? null : store.get(SAVE_KEY);
    if (saved && H.validate(saved)) { st = saved; return false; }
    st = H.newGame(rng);
    return !!saved;   // true if a saved game existed but could not be used
  }
  const save = () => store.set(SAVE_KEY, st);

  /* ---------------- Pacing ---------------- */
  const speed = () => (FAST ? { ai: 25, pause: 60 } : SPEEDS[settings.speed] || SPEEDS.slow);
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function schedule() {
    clearTimers();
    if (document.hidden) return;
    if (st.phase === 'play' && st.turn !== YOU) later(aiStep, speed().ai);
    else if (st.phase === 'trickEnd') later(collect, speed().pause);
  }

  function commit() { save(); render(); schedule(); }

  const plateEl = seat => $('seats').children[COLS.indexOf(seat)];
  const stageCardEl = seat => { const cell = $('stage').children[COLS.indexOf(seat)]; return cell && cell.querySelector('.card'); };

  // A card was just played: sound, and a short announcement for the big moments.
  function afterPlay(card, heartsWereBroken) {
    sound('play');
    // Plain timeouts: the game's own timers are reset on every move.
    if (card === 'QS') { announce(T.t('queenPlayed')); setTimeout(() => sound('queen'), 120); }
    else if (H.suitOf(card) === 'H' && !heartsWereBroken) { announce(T.t('heartsBroken')); setTimeout(() => sound('hearts'), 120); }
  }

  function announce(html) {
    clearTimeout(ui.bannerTimer);
    ui.banner = html;
    ui.bannerTimer = setTimeout(() => { ui.banner = null; renderStatus(); }, FAST ? 80 : 2600);
  }

  function aiStep() {
    if (st.phase !== 'play' || st.turn === YOU) return;
    const seat = st.turn, card = H.aiPlay(st, seat), broken = st.heartsBroken;
    H.playCard(st, seat, card);
    afterPlay(card, broken);
    commit();
    FX.flyFrom(stageCardEl(seat), plateEl(seat).getBoundingClientRect(), { scale: 0.45, opacity: 0.2 });
  }

  // The finished trick gathers into the winner's name, which glows; then play goes on.
  async function collect() {
    if (st.phase !== 'trickEnd' || ui.busy) return;
    ui.busy = true;
    clearTimers();
    const w = st.trickWinner;
    const pts = st.trick.reduce((n, p) => n + H.points(p.card), 0);
    sound(w === YOU && pts ? 'points' : 'collect');
    await FX.flyTo([...$('stage').querySelectorAll('.cell .card')], plateEl(w).getBoundingClientRect(), { stagger: 40 });
    H.collectTrick(st);
    message = null;
    ui.took = w;
    setTimeout(() => { ui.took = null; renderSeats(); }, FAST ? 40 : 1000);
    save();
    render();
    ui.busy = false;
    if (st.phase === 'handEnd' || st.phase === 'gameEnd') return endOfHand();
    schedule();
  }

  // Small wins get a small acknowledgment; the results wait until it has finished.
  async function endOfHand() {
    ui.newBest = recordHand();
    const last = st.history[st.history.length - 1];
    const kind = st.phase === 'gameEnd' && H.winners(st).includes(YOU) ? 'win'
      : st.moon === YOU ? 'moon' : st.moon === null && last[YOU] === 0 ? 'clean' : null;
    if (kind) {
      sound(kind === 'clean' ? 'clean' : 'big');
      await FX.celebrate({ kind, style: styleFor(kind), text: T.t(kind === 'clean' ? 'celClean' : kind === 'moon' ? 'celMoon' : 'celWin') });
    } else sound('end');
    showEnd();
  }

  // Remember her results on this phone. Runs once, when a hand has just been scored.
  function recordHand() {
    if (DEMO) return false;
    const last = st.history[st.history.length - 1];
    if (st.moon === YOU) stats.moons += 1;
    else if (st.moon === null && last[YOU] === 0) stats.clean += 1;
    let newBest = false;
    if (st.phase === 'gameEnd') {
      stats.games += 1;
      if (H.winners(st).includes(YOU)) stats.wins += 1;
      if (stats.best === null || st.scores[YOU] < stats.best) { newBest = stats.best !== null; stats.best = st.scores[YOU]; }
    }
    store.set(STATS_KEY, stats);
    return newBest;
  }

  function startNewGame() {
    clearTimers();
    message = null;
    ui.newBest = false;
    st = H.newGame(rng);
    commit();
  }

  /* ---------------- Player actions ---------------- */
  // Not allowed: a buzz she can feel even on silent, the not-allowed sound if Sound is on.
  function refuse() { FX.buzz(2); sound(NOPE_SOUND); }

  function tapCard(code) {
    if (ui.busy) return;
    message = null;
    let why = null;
    if (st.phase === 'pass') {
      const i = st.sel.indexOf(code);
      if (i >= 0) st.sel.splice(i, 1);
      else if (st.sel.length < 3) st.sel.push(code);
      else message = { key: 'limit' };
      if (message) refuse(); else sound('select');
      save();
    } else if (st.phase === 'received') {
      message = { key: 'pressContinue' };
    } else if (st.phase === 'play' && st.turn === YOU) {
      why = H.illegalReason(st, YOU, code);
      if (why) { st.sel = []; message = { key: why }; refuse(); }
      else { st.sel = st.sel[0] === code ? [] : [code]; sound('select'); }
      save();
    } else if (st.phase === 'play') {
      message = { key: 'waitFor', vars: { name: T.name(st.turn) } };
    }
    render();
    if (why) pointToPlayable(code);
  }

  // After a tap on a card she can't play: that card shakes "no", then the cards she can play hop up to show where to look.
  function pointToPlayable(code) {
    const tapped = $('hand').querySelector(`[data-card="${code}"]`);
    const playable = H.legalPlays(st, YOU).map(c => $('hand').querySelector(`[data-card="${c}"]`)).filter(Boolean);
    const shake = ['shake', 'both', 'together', 'twice'].includes(NOPE), hop = NOPE !== 'shake' && NOPE !== 'none';
    const hopAfter = NOPE === 'together' || NOPE === 'hop' ? 0 : 440;   // in turn: the hop starts as the shake ends
    if (shake) FX.shake(tapped);
    if (hop) FX.hop(playable, { delay: hopAfter, times: NOPE === 'twice' ? 2 : 1 });
  }

  async function primaryAction() {
    if (ui.busy) return;
    message = null;
    switch (st.phase) {
      case 'pass': {
        if (st.sel.length !== 3) return;
        // The 3 chosen cards travel to the player they're passed to; the 3 new ones arrive from the giver.
        ui.busy = true;
        sound('collect');
        await FX.flyTo([...$('stage').querySelectorAll('.card.preview')], plateEl(H.passTarget(YOU, st.passDir)).getBoundingClientRect(), { stagger: 70, scale: 0.4 });
        H.applyPasses(st, [st.sel.slice(), H.aiPass(st.hands[1]), H.aiPass(st.hands[2]), H.aiPass(st.hands[3])]);
        ui.busy = false;
        commit();
        const from = plateEl(H.passSource(YOU, st.passDir)).getBoundingClientRect();
        $('stage').querySelectorAll('.card.received').forEach((el, i) => FX.flyFrom(el, from, { scale: 0.4, opacity: 0.2, duration: 380, delay: i * 80 }));
        return;
      }
      case 'received': {
        // The 3 new cards travel from the table down into their places in her hand.
        if (ARRIVE !== 'none') {
          ui.busy = true;
          const pairs = [...$('stage').querySelectorAll('.card.received')].map(el => [el, $('hand').querySelector(`[data-card="${el.dataset.card}"]`)]);
          await FX.flyInto(pairs, ARRIVE === 'onebyone' ? { duration: 800, stagger: 900 } : { duration: 600, stagger: 140 });
          ui.busy = false;
        }
        H.beginPlay(st);
        return commit();
      }
      case 'play': {
        if (st.turn !== YOU || st.sel.length !== 1) return;
        const card = st.sel[0], broken = st.heartsBroken;
        const handCard = $('hand').querySelector(`[data-card="${card}"]`);
        const from = handCard && handCard.getBoundingClientRect();
        H.playCard(st, YOU, card);
        afterPlay(card, broken);
        commit();
        FX.flyFrom(stageCardEl(YOU), from);   // from her hand to her place on the table
        return;
      }
      case 'trickEnd':
        return collect();   // don't wait for the pause
      default:
        return showEnd();
    }
  }

  /* ---------------- Card faces (traced glyphs from agy-solitaire) ---------------- */
  const RANK_TOP = 15, RANK_WIN = 171, CAP = 156, TAIL = 170, TEN_W = 160.03, BIG_H = 212, BIG_W = 209;
  const r2 = n => Math.round(n * 100) / 100;

  function glyph(key, x, y, scale, color, win) {
    const g = GLYPHS[key];
    const [vx, vy, vw, vh] = win || g.box;
    return `<svg x="${r2(x)}" y="${r2(y)}" width="${r2(vw * scale)}" height="${r2(vh * scale)}" viewBox="${vx} ${vy} ${vw} ${vh}" overflow="visible">` +
      `<path transform="translate(0,${g.h}) scale(0.1,-0.1)" d="${g.d}" fill="${color}"/></svg>`;
  }

  // One big rank (same scale for every rank, 10 included) over one suit. No corner suit: no card is ever covered
  // except in a 6-7 card row, and hand cards are sized so rank and suit stay inside the strip that row leaves showing.
  function faceSVG(code, w, h, inHand) {
    const rank = H.rankOf(code), suit = H.suitOf(code);
    const color = suit === 'H' || suit === 'D' ? INK.red : INK.black;
    const pad = Math.max(3, Math.round(w * 0.07));
    const gap = Math.max(2, h * 0.03);
    const innerW = w - 2 * pad, innerH = h - 2 * pad;
    const vis = dims.strip - 2;   // visible strip in a 7-card row, less the next card's outline
    let s = Math.min(innerW / TEN_W, 0.55 * (innerH - gap) / CAP);
    let rx = pad;
    if (inHand) { rx = Math.min(pad, 4); s = Math.min(s, (vis - rx) / TEN_W); }
    const rb = GLYPHS[rank].box;
    let out = glyph(rank, rx, pad, s, color, [rb[0], RANK_TOP, rb[2], RANK_WIN]);
    const top = pad + TAIL * s + gap, bottom = h - pad;   // suit starts below the Q's tail on every card
    const big = GLYPHS['big_' + suit].box;
    const bs = Math.min((bottom - top) / BIG_H, innerW * 0.8 / BIG_W);
    let bx = (w - big[2] * bs) / 2;
    if (inHand) bx = Math.min(bx, vis - 2 - big[2] * bs);
    out += glyph('big_' + suit, bx, top + (bottom - top - big[3] * bs) / 2, bs, color);
    return `<svg class="face" width="${r2(w)}" height="${r2(h)}" viewBox="0 0 ${r2(w)} ${r2(h)}" aria-hidden="true" focusable="false">${out}</svg>`;
  }

  function suitIcon(suit, color) {
    const g = GLYPHS['small_' + suit];
    return `<svg viewBox="${g.box.join(' ')}" aria-hidden="true" focusable="false" style="aspect-ratio:${g.box[2]}/${g.box[3]}"><path transform="translate(0,${g.h}) scale(0.1,-0.1)" d="${g.d}" fill="${color}"/></svg>`;
  }

  const CHECK = '<span class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 7" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  const ARROW_UP = '<svg viewBox="0 0 30 30" aria-hidden="true" focusable="false"><path d="M15 27V5M5.5 14L15 4.5 24.5 14" stroke="#fbbf24" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------------- Layout ---------------- */
  function handLines(hand) {
    const lines = [];
    for (const suit of SUIT_ORDER) {
      const cards = hand.filter(c => H.suitOf(c) === suit).sort((a, b) => H.rankValue(a) - H.rankValue(b));
      if (!cards.length) lines.push({ suit, cards, void: true });
      else if (cards.length > 7) {   // 8+ of a suit (about 1 hand in 200): two rows
        const half = Math.ceil(cards.length / 2);
        lines.push({ suit, cards: cards.slice(0, half) }, { suit, cards: cards.slice(half) });
      } else lines.push({ suit, cards });
    }
    return lines;
  }

  function measure(lineCount) {
    const app = $('app');
    const cs = getComputedStyle(app);
    const innerW = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const budgetTotal = $('stage').offsetHeight + $('hand').offsetHeight;   // the two flexible regions
    const tagH = 30, gap = lineCount > 4 ? 5 : 6, cardGap = 5;
    const lineW = innerW;
    const cw = Math.min(72, (lineW - 4 * cardGap) / 5);
    const strip = (lineW - cw) / 6;   // how much of each card shows in a 7-card row
    const colW = (innerW - 18) / 4;
    const twMax = Math.min(colW - 4, 84);
    const budget = budgetTotal - tagH - (lineCount - 1) * gap - 6;
    const ch = Math.floor(Math.min(cw * 1.45, budget / (lineCount + 1)));
    let th = Math.min(twMax * 1.42, budget - lineCount * ch);
    const tw = Math.min(twMax, th / 1.4);
    th = Math.floor(Math.min(th, tw * 1.42));
    dims = { cw: Math.floor(cw * 10) / 10, ch, tw: Math.floor(tw * 10) / 10, th, lineW, cardGap, gap, tagH, strip };
    const sty = app.style;
    sty.setProperty('--cw', dims.cw + 'px'); sty.setProperty('--ch', ch + 'px');
    sty.setProperty('--tw', dims.tw + 'px'); sty.setProperty('--th', th + 'px');
    sty.setProperty('--tag-h', tagH + 'px'); sty.setProperty('--line-gap', gap + 'px');
  }

  // Shrink a one-line label a little if a longer language needs it.
  function fitText(el, max, min) {
    let size = max;
    el.style.fontSize = size + 'px';
    while (el.scrollWidth > el.clientWidth + 1 && size > min) { size -= 1; el.style.fontSize = size + 'px'; }
  }

  /* ---------------- Rendering ---------------- */
  // The title shrinks to fit between Help and Menu (longer words in Spanish and Vietnamese); hidden if it can't.
  // With the icon showing, the words go first and the icon stays.
  function fitTitle() {
    const bar = document.querySelector('.topbar'), title = document.querySelector('.wordmark'), words = title.querySelector('span');
    const half = bar.clientWidth / 2;   // the title is centered, so it must fit beside the wider button
    const room = 2 * Math.min(half - $('help-button').offsetWidth, half - $('menu-button').offsetWidth) - 24;
    title.style.visibility = '';
    words.style.display = '';
    let size = 27;
    title.style.fontSize = size + 'px';
    while (title.scrollWidth > room && size > 16) { size -= 1; title.style.fontSize = size + 'px'; }
    if (title.scrollWidth <= room) return;
    if (!look.contains('no-logo')) words.style.display = 'none';
    else title.style.visibility = 'hidden';
  }

  function render() {
    fitTitle();
    const lines = handLines(st.hands[YOU]);
    measure(lines.length);
    renderSeats();
    renderStage();
    renderStatus();
    renderHand(lines);
    renderAction();
  }

  function renderSeats() {
    const showHandPts = st.phase === 'play' || st.phase === 'trickEnd';
    $('seats').innerHTML = COLS.map(seat => {
      const turn = st.phase === 'play' && st.turn === seat;
      const hp = st.handPts[seat];
      const bump = hp > ui.prevPts[seat];
      const pts = st.scores[seat] === 1 ? T.t('pt1') : T.t('pts', { n: st.scores[seat] });
      return `<div class="plate${turn ? ' turn' : ''}${seat === YOU ? ' you' : ''}${ui.took === seat ? ' took' : ''}" role="group" aria-label="${T.name(seat)}, ${pts}${showHandPts && hp ? ', +' + hp : ''}">` +
        `<span class="name">${T.name(seat)}</span><span class="pts">${pts}</span>` +
        (showHandPts && hp ? `<span class="badge${bump ? ' bump' : ''}" aria-hidden="true">+${hp}</span>` : '') + '</div>';
    }).join('');
    ui.prevPts = st.handPts.slice();
    $('seats').querySelectorAll('.name, .pts').forEach(el => fitText(el, 18, 13));
  }

  function cardBox(code, cls, remove) {
    if (remove) return `<button type="button" class="card ${cls}" data-remove="${code}" aria-label="${cap(T.card(code))}">${faceSVG(code, dims.tw, dims.th)}</button>`;
    return `<div class="card ${cls}" role="img" data-card="${code}" aria-label="${cap(T.card(code))}">${faceSVG(code, dims.tw, dims.th)}</div>`;
  }

  function renderStage() {
    const cells = ['', '', '', ''], tags = ['', '', '', ''];
    let hint = '';
    if (st.phase === 'pass') {
      const target = H.passTarget(YOU, st.passDir);
      let k = 0;
      COLS.forEach((seat, i) => {
        if (seat === target) {
          cells[i] = `<div class="direction">${ARROW_UP}<span>${T.t('passTo')}</span><strong>${T.name(target)}</strong></div>`;
        } else {
          const code = st.sel[k];
          cells[i] = code ? cardBox(code, 'preview', true) : `<div class="slot num" aria-hidden="true">${k + 1}</div>`;
          k += 1;
        }
      });
      if (st.sel.length) hint = `<div class="tagcell hint">${T.t('takeBack')}</div>`;
    } else if (st.phase === 'received') {
      const giver = H.passSource(YOU, st.passDir);
      let k = 0;
      COLS.forEach((seat, i) => {
        if (seat === giver) cells[i] = `<div class="direction"><span>${T.t('from')}</span><strong>${T.name(giver)}</strong></div>`;
        else { cells[i] = cardBox(st.received[k], 'received'); tags[i] = `<span class="tag gold">${T.t('tagNew')}</span>`; k += 1; }
      });
    } else {
      const ended = st.phase === 'handEnd' || st.phase === 'gameEnd';
      const plays = ended ? (st.lastTrick ? st.lastTrick.plays : []) : st.trick;
      const done = ended || st.phase === 'trickEnd';
      const winner = !plays.length ? null : ended ? st.lastTrick.winner : done ? st.trickWinner : H.winningPlay(plays).seat;
      const leader = plays.length ? plays[0].seat : null;
      COLS.forEach((seat, i) => {
        const played = plays.find(p => p.seat === seat);
        if (played) {
          cells[i] = cardBox(played.card, done && seat === winner ? 'winner' : '');
          if (done && seat === winner) tags[i] = `<span class="tag gold">${T.t('tagTakes')}</span>`;
          else if (seat === winner && plays.length > 1) tags[i] = `<span class="tag gold">${T.t('tagWinning')}</span>`;
          else if (seat === leader) tags[i] = `<span class="tag outline">${T.t('tagLed')}</span>`;
        } else if (seat === YOU && st.phase === 'play' && st.turn === YOU && st.sel.length) {
          cells[i] = cardBox(st.sel[0], 'preview');
          tags[i] = `<span class="tag pink">${T.t('tagChosen')}</span>`;
        } else if (seat === YOU && st.phase === 'play' && st.turn === YOU) {
          cells[i] = `<div class="slot yours">${T.t('yourCard')}</div>`;
        } else {
          cells[i] = '<div class="slot" aria-hidden="true"></div>';
        }
      });
    }
    const top = cells.map(c => `<div class="cell">${c}</div>`).join('');
    const bottom = hint || tags.map(t => `<div class="tagcell">${t}</div>`).join('');
    $('stage').innerHTML = top + bottom;
    $('stage').querySelectorAll('.tag').forEach(el => fitText(el, 16, 12));
  }

  function statusHTML() {
    if (message) return T.t(message.key, messageVars(message));
    if (ui.banner) return `<span class="announce">${ui.banner}</span>`;
    switch (st.phase) {
      case 'pass': {
        const name = T.name(H.passTarget(YOU, st.passDir)), left = 3 - st.sel.length;
        return left === 3 ? T.t('choose3', { name }) : left > 0 ? T.t('chooseMore', { n: left, name }) : T.t('readyPass', { name });
      }
      case 'received':
        return T.t('passedYou', { name: T.name(H.passSource(YOU, st.passDir)) });
      case 'play': {
        if (st.turn !== YOU) return T.t('playing', { name: T.name(st.turn) });
        const hand = st.hands[YOU];
        if (!st.trick.length) {
          if (st.trickNo === 0) return T.t('lead2C');
          return !st.heartsBroken && hand.some(c => H.suitOf(c) === 'H') && hand.some(c => H.suitOf(c) !== 'H') ? T.t('leadNoHearts') : T.t('leadAny');
        }
        const led = H.suitOf(st.trick[0].card);
        if (hand.some(c => H.suitOf(c) === led)) return T.t('follow', { suit1: T.suit1(led), suits: T.suits(led) });
        return st.trickNo === 0 ? T.t('voidFirst') : T.t('voidAny', { suits: T.suits(led) });
      }
      case 'trickEnd': {
        const pts = st.trick.reduce((n, p) => n + H.points(p.card), 0);
        const ptsText = pts === 0 ? T.t('noPoints') : pts === 1 ? T.t('onePoint') : T.t('nPoints', { n: pts });
        const queen = st.trick.some(p => p.card === 'QS');
        if (st.trickWinner === YOU) return T.t(queen ? 'youTakeQueen' : 'youTake', { pts: ptsText });
        return T.t(queen ? 'takesQueen' : 'takesTrick', { name: T.name(st.trickWinner), pts: ptsText });
      }
      case 'handEnd':
        return T.t('handEnd', { n: st.handNo });
      default:
        return T.t('gameOver');
    }
  }

  function messageVars(m) {
    if (m.key === 'mustFollow') return { suits: T.suits(H.suitOf(st.trick[0].card)) };
    return m.vars || {};
  }

  function renderStatus() {
    const el = $('status');
    el.classList.toggle('warn', !!message);
    el.innerHTML = statusHTML();
    fitText(el, 20, 15);
  }

  function renderHand(lines) {
    const inPlay = st.phase === 'play' && st.turn === YOU;
    const legal = inPlay ? new Set(H.legalPlays(st, YOU)) : null;
    const restricted = legal && st.hands[YOU].some(c => !legal.has(c));
    const choosing = st.phase === 'pass' || inPlay;
    const outline = PLAYABLE !== 'dim' && PLAYABLE !== 'ring';
    const dim = PLAYABLE !== 'outline' && PLAYABLE !== 'ring';
    const dimClass = { dim: 'unplayable', soft: 'unplayable softer', grey: 'unplayable grey', ghost: 'unplayable ghost' }[PLAYABLE] || 'unplayable soft';
    $('hand').innerHTML = lines.map(line => {
      if (line.void) {
        return `<div class="line void" role="group">${suitIcon(line.suit, 'rgba(255,255,255,0.88)')}${T.t('none', { suits: T.suits(line.suit) })}</div>`;
      }
      const n = line.cards.length;
      const step = n <= 5 ? dims.cw + dims.cardGap : (dims.lineW - dims.cw) / (n - 1);
      const whole = outline && restricted && st.hands[YOU].filter(c => H.suitOf(c) === line.suit).every(c => legal.has(c));
      const cards = line.cards.map((code, i) => {
        const sel = st.sel.includes(code);
        const cls = ['card'];
        if (sel) cls.push('selected');
        if (st.phase === 'received' && st.received.includes(code)) cls.push('received');
        if ((PLAYABLE === 'ring' || (outline && !whole)) && restricted && legal.has(code) && !sel) cls.push('legal-one');
        if (dim && restricted && !legal.has(code)) cls.push(dimClass);
        const pressed = choosing ? ` aria-pressed="${sel}"` : '';
        const blocked = restricted && !legal.has(code) ? ' aria-disabled="true"' : '';
        return `<button type="button" class="${cls.join(' ')}" data-card="${code}" style="left:${r2(i * step)}px;z-index:${i + 1}"` +
          ` aria-label="${cap(T.card(code))}"${pressed}${blocked}>${faceSVG(code, dims.cw, dims.ch, true)}${sel ? CHECK : ''}</button>`;
      }).join('');
      return `<div class="line${whole ? ' legal' : ''}" role="group" aria-label="${cap(T.suits(line.suit))}: ${n}">${cards}</div>`;
    }).join('');
  }

  function renderAction() {
    const b = $('primary-action');
    let label = '', enabled = true;
    switch (st.phase) {
      case 'pass':
        enabled = st.sel.length === 3;
        label = enabled ? T.t('btnPass', { name: T.name(H.passTarget(YOU, st.passDir)) })
          : T.t('btnPassCount', { dir: T.dir(st.passDir), n: st.sel.length });
        break;
      case 'received': label = T.t('btnContinue'); break;
      case 'play':
        if (st.turn === YOU) {
          enabled = st.sel.length === 1;
          label = enabled ? T.t('btnPlay', { card: T.card(st.sel[0], true) }) : T.t('btnChoose');
        } else { enabled = false; label = T.t('btnWait', { name: T.name(st.turn) }); }
        break;
      case 'trickEnd': label = T.t('btnNextTrick'); break;
      default: label = T.t('btnResults');
    }
    b.textContent = label;
    b.disabled = !enabled;
    fitText(b, 21, 16);
  }

  /* ---------------- Dialogs ---------------- */
  let returnFocus = null;
  function openDialog(id) {
    document.querySelectorAll('.overlay').forEach(o => { o.hidden = true; });
    if (!returnFocus) returnFocus = document.activeElement;
    const o = $(id);
    o.hidden = false;
    const first = o.querySelector('button');
    if (first) first.focus();
  }
  function closeDialogs(force) {
    if (!force && !$('end-dialog').hidden) return;   // end-of-hand results close only with their button
    document.querySelectorAll('.overlay').forEach(o => { o.hidden = true; });
    if (returnFocus && returnFocus.focus) returnFocus.focus();
    returnFocus = null;
  }

  function scoreTable(rows, withHand) {
    const best = Math.min(...st.scores);
    return '<table class="scores"><thead><tr><th></th>' + (withHand ? `<th>${withHand}</th>` : '') + `<th>${T.t('total')}</th></tr></thead><tbody>` +
      rows.map(seat => {
        const last = st.history.length ? st.history[st.history.length - 1][seat] : 0;
        return `<tr${st.scores[seat] === best ? ' class="best"' : ''}><td>${T.name(seat)}</td>` +
          (withHand ? `<td>+${last}</td>` : '') + `<td class="total">${st.scores[seat]}</td></tr>`;
      }).join('') + '</tbody></table>';
  }

  function showEnd() {
    const over = st.phase === 'gameEnd';
    let title = T.t('handEnd', { n: st.handNo });
    if (over) {
      const w = H.winners(st);
      title = w.length > 1 ? T.t('winTie', { names: T.list(w.map(T.name)) }) : w[0] === YOU ? T.t('winYou') : T.t('winOther', { name: T.name(w[0]) });
    }
    let body = '';
    if (st.moon !== null) body += `<p class="moon">${st.moon === YOU ? T.t('moonYou') : T.t('moonOther', { name: T.name(st.moon) })}</p>`;
    body += scoreTable([0, 1, 2, 3], T.t('thisHand'));
    if (!over) {
      const nextDir = H.PASS_CYCLE[st.handNo % 4];
      body += `<p class="note">${nextDir === 'hold' ? T.t('nextHold') : T.t('nextPass', { dir: T.dir(nextDir) })}</p>`;
    } else {
      if (ui.newBest) body += `<p class="moon">${T.t('statNewBest')}</p>`;
      if (stats.games) {
        body += `<p class="note">${T.t('statGames', { w: stats.wins, n: stats.games })}</p>`;
        if (stats.best !== null) body += `<p class="note">${T.t('statBest', { n: stats.best })}</p>`;
      }
      body += `<p class="note">${T.t('scoreNote')}</p>`;
    }
    $('end-title').textContent = title;
    $('end-body').innerHTML = body;
    $('end-next').textContent = over ? T.t('btnPlayAgain') : T.t('btnNextHand');
    openDialog('end-dialog');
  }

  function showScores() {
    $('scores-body').innerHTML = `<p class="note">${T.t('handNo', { n: st.handNo })}</p>` +
      scoreTable([0, 1, 2, 3], st.history.length ? T.t('lastHand') : '') + `<p class="note">${T.t('scoreNote')}</p>`;
    openDialog('scores-dialog');
  }

  function showLastTrick() {
    const lt = st.lastTrick;
    $('last-title').textContent = T.t('mLast');
    if (!lt) { $('last-body').innerHTML = `<p>${T.t('lastNone')}</p>`; return openDialog('last-dialog'); }
    const w = Math.min(70, Math.floor((Math.min(350, innerWidth - 40) - 40 - 18) / 4)), h = Math.round(w * 1.4);
    $('last-body').innerHTML = '<div class="mini-trick">' + COLS.map(seat => {
      const p = lt.plays.find(x => x.seat === seat);
      return `<div><div class="who">${T.name(seat)}</div><div class="card${seat === lt.winner ? ' winner' : ''}" role="img" aria-label="${cap(T.card(p.card))}" style="width:${w}px;height:${h}px">${faceSVG(p.card, w, h)}</div></div>`;
    }).join('') + `</div><p class="note">${T.t('tookIt', { name: T.name(lt.winner) })}</p>`;
    openDialog('last-dialog');
  }

  function showSettings() {
    const group = (title, key, opts) => `<div class="setting"><h3>${title}</h3><div class="seg">` +
      opts.map(([val, label]) => `<button type="button" data-set="${key}" data-val="${val}" aria-pressed="${String(settings[key]) === String(val)}">${label}</button>`).join('') + '</div></div>';
    $('settings-body').innerHTML =
      group(T.t('speed'), 'speed', [['slow', T.t('slow')], ['normal', T.t('normal')]]) +
      group(T.t('sound'), 'sound', [['false', T.t('off')], ['true', T.t('on')]]) +
      group(T.t('language'), 'lang', T.LANGS.map(l => [l, T.langName(l)]));
    // Language is stored explicitly only once chosen; show the current one as pressed.
    $('settings-body').querySelectorAll('[data-set="lang"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.val === T.lang)));
    openDialog('settings-dialog');
  }

  function applyLanguage() {
    document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = T.t(el.dataset.t); });
    $('rules').innerHTML = T.t('rules').map(r => `<li>${r}</li>`).join('');
    document.title = T.t('title');
  }

  /* ---------------- Wiring ---------------- */
  document.addEventListener('pointerdown', () => { if (settings.sound) FX.unlock(); }, true);   // phones only allow sound after a tap

  // Mom holds her finger on the glass longer than most people, and her finger sometimes slides a little before
  // it lifts. Nothing here is meant to be selected or copied, and a press that starts on a button counts as a tap
  // if it lifts on that button or close to it (SLIDE px), however long it was held. Safari drops the click after a
  // long hold or a slide, so send one ourselves then, and ignore Safari's own click if it comes as well.
  const SLIDE = 44;
  document.addEventListener('selectstart', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());
  let press = null, sent = null;
  document.addEventListener('pointerdown', e => {
    sent = null;   // a new press: Safari's click for the last one, if it was coming, has already come
    const b = e.target.closest && e.target.closest('button');
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
    // The screen was redrawn by our click, so Safari's late click may land on the new copy of the same card.
    if (performance.now() < sent) { e.stopPropagation(); e.preventDefault(); }
    sent = null;
  }, true);
  $('hand').addEventListener('click', e => { const c = e.target.closest('button.card'); if (c) tapCard(c.dataset.card); });
  $('stage').addEventListener('click', e => { const c = e.target.closest('button[data-remove]'); if (c && st.phase === 'pass') tapCard(c.dataset.remove); });
  $('primary-action').addEventListener('click', primaryAction);
  $('help-button').addEventListener('click', () => openDialog('help-dialog'));
  $('menu-button').addEventListener('click', () => openDialog('menu-dialog'));
  $('menu-help').addEventListener('click', () => openDialog('help-dialog'));
  $('menu-last').addEventListener('click', showLastTrick);
  $('menu-scores').addEventListener('click', showScores);
  $('menu-settings').addEventListener('click', showSettings);
  $('new-game').addEventListener('click', () => openDialog('new-dialog'));
  $('confirm-new').addEventListener('click', () => { closeDialogs(true); startNewGame(); });
  $('end-next').addEventListener('click', () => {
    closeDialogs(true);
    if (st.phase === 'gameEnd') return startNewGame();
    if (st.phase === 'handEnd') { H.nextHand(st, rng); commit(); }
  });
  $('settings-body').addEventListener('click', e => {
    const b = e.target.closest('button[data-set]');
    if (!b) return;
    const key = b.dataset.set, val = b.dataset.val;
    settings[key] = key === 'sound' ? val === 'true' : val;
    store.set(SET_KEY, settings);
    if (key === 'lang') { T.set(val); applyLanguage(); render(); }
    if (key === 'sound' && settings.sound) sound('clean');   // a sample, so she hears what "on" means
    if (key === 'speed') schedule();
    showSettings();
  });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialogs()));
  document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) closeDialogs(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDialogs(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimers(); save(); } else schedule(); });
  window.addEventListener('pagehide', save);
  let resizeTimer = null;
  // A redraw would cut short cards in flight (Safari's toolbar can resize the page mid-tap), so it waits for them.
  const redraw = () => { if (ui.busy) resizeTimer = setTimeout(redraw, 150); else render(); };
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(redraw, 80); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* still playable online */ });
  }

  /* ---------------- Demo moments for the options pages (never saved) ---------------- */
  function runDemo(kind) {
    const r = H.makeRng(12);
    st = H.newGame(r);
    if (kind === 'received') {   // the 3 passed cards are on the table, waiting for Continue
      H.applyPasses(st, [0, 1, 2, 3].map(i => H.aiPass(st.hands[i])));
      return render();
    }
    if (kind === 'mixup') {   // Mom's moment: hearts were led, she has hearts and diamonds (red and red)
      const mine = ['9C', '4D', '8D', 'QD', 'KD', 'JS', '5H', '9H'];
      const rest = H.fullDeck().filter(c => !mine.includes(c) && c !== '7H' && c !== 'KH');
      Object.assign(st, {
        hands: [mine, rest.slice(0, 8), rest.slice(8, 15), rest.slice(15, 22)], phase: 'play', trickNo: 5, heartsBroken: true,
        leader: 2, turn: YOU, sel: [], received: [], trick: [{ seat: 2, card: '7H' }, { seat: 3, card: 'KH' }],
        handPts: [2, 3, 13, 0], scores: [18, 30, 25, 12]
      });
      return render();
    }
    H.applyPasses(st, [0, 1, 2, 3].map(i => H.aiPass(st.hands[i])));
    H.beginPlay(st);
    const step = () => { if (st.phase === 'play') H.playCard(st, st.turn, H.aiPlay(st, st.turn)); else H.collectTrick(st); };
    if (kind === 'follow') {   // stop at her turn when she must follow suit
      for (let i = 0; i < 400 && st.phase !== 'handEnd'; i++) {
        if (st.phase === 'play' && st.turn === YOU && st.trickNo > 0 && st.trick.length && H.legalPlays(st, YOU).length < st.hands[YOU].length) break;
        step();
      }
      return render();
    }
    while (st.phase !== 'handEnd' && st.phase !== 'gameEnd') step();
    const results = { clean: [[0, 13, 9, 4]], moon: [[0, 26, 26, 26]], win: [[36, 80, 67, 81], [2, 24, 0, 0]] }[kind] || [[0, 13, 9, 4]];
    st.history = results;
    st.scores = results.reduce((a, h) => a.map((v, i) => v + h[i]), [0, 0, 0, 0]);
    st.moon = kind === 'moon' ? YOU : null;
    st.phase = kind === 'win' ? 'gameEnd' : 'handEnd';
    stats = { games: 6, wins: 3, best: 38, clean: 4, moons: 1 };
    render();
    ui.newBest = kind === 'win';
    setTimeout(async () => {
      const k = kind === 'moon' ? 'moon' : kind === 'win' ? 'win' : 'clean';
      sound(k === 'clean' ? 'clean' : 'big');
      await FX.celebrate({ kind: k, style: styleFor(k), text: T.t(k === 'clean' ? 'celClean' : k === 'moon' ? 'celMoon' : 'celWin') });
      showEnd();
    }, 400);
  }

  // For automated tests only.
  window.__hearts = { state: () => st, settings: () => settings, stats: () => stats, announce: h => { announce(h); renderStatus(); }, commit, rules: H, load: s => { st = s; commit(); }, hold: clearTimers, resume: schedule, tap: tapCard };

  /* ---------------- Start ---------------- */
  applyLanguage();
  if (DEMO) { runDemo(DEMO); return; }
  const couldNotRestore = load();
  commit();
  if (couldNotRestore) { $('last-body').innerHTML = `<p>${T.t('restoreFail')}</p>`; $('last-title').textContent = T.t('title'); openDialog('last-dialog'); }
  else if (st.phase === 'handEnd' || st.phase === 'gameEnd') showEnd();
})();
