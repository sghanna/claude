/* Hearts rules and computer players. No DOM here, so tests can run it in Node.
   Seats: 0 = you (south), 1 = Michael (your left), 2 = Jerry (across), 3 = Barbara (your right).
   Play goes clockwise: 0 -> 1 -> 2 -> 3. Passing cycles left, right, across, then no pass. */
(function (root) {
  'use strict';

  const SUITS = ['C', 'D', 'S', 'H'];
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const PASS_CYCLE = ['left', 'right', 'across', 'hold'];
  const TARGET = 100;

  const suitOf = c => c.slice(-1);
  const rankOf = c => c.slice(0, -1);
  const rankValue = c => RANKS.indexOf(rankOf(c));
  const points = c => (suitOf(c) === 'H' ? 1 : c === 'QS' ? 13 : 0);
  const isCard = c => typeof c === 'string' && SUITS.includes(suitOf(c)) && RANKS.includes(rankOf(c));
  const fullDeck = () => SUITS.flatMap(s => RANKS.map(r => r + s));
  const sortHand = h => h.slice().sort((a, b) => SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)) || rankValue(a) - rankValue(b));
  const highest = cards => cards.reduce((a, b) => (rankValue(b) > rankValue(a) ? b : a));
  const lowest = cards => cards.reduce((a, b) => (rankValue(b) < rankValue(a) ? b : a));

  // Small seeded generator so a deal can be reproduced (tests, ?seed=).
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(cards, rng) {
    const a = cards.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function passTarget(seat, dir) {
    return dir === 'left' ? (seat + 1) % 4 : dir === 'right' ? (seat + 3) % 4 : dir === 'across' ? (seat + 2) % 4 : seat;
  }
  function passSource(seat, dir) {
    return dir === 'left' ? (seat + 3) % 4 : dir === 'right' ? (seat + 1) % 4 : dir === 'across' ? (seat + 2) % 4 : seat;
  }

  /* ---------------- Game state ---------------- */
  function newGame(rng) {
    const st = { v: 1, handNo: 0, scores: [0, 0, 0, 0], history: [], moon: null, target: TARGET };
    startHand(st, rng);
    return st;
  }

  function startHand(st, rng) {
    const deck = shuffle(fullDeck(), rng || Math.random);
    st.handNo += 1;
    st.passDir = PASS_CYCLE[(st.handNo - 1) % 4];
    st.hands = [0, 1, 2, 3].map(i => sortHand(deck.slice(i * 13, i * 13 + 13)));
    st.sel = [];
    st.received = [];
    st.trick = [];
    st.played = [];
    st.trickNo = 0;
    st.heartsBroken = false;
    st.handPts = [0, 0, 0, 0];
    st.lastTrick = null;
    st.trickWinner = null;
    if (st.passDir === 'hold') beginPlay(st);
    else st.phase = 'pass';
  }

  // passes[seat] = the 3 cards that seat gives away. All passes happen at once.
  function applyPasses(st, passes) {
    if (st.phase !== 'pass') throw Error('Not passing now');
    passes.forEach((cards, seat) => {
      if (!cards || cards.length !== 3 || new Set(cards).size !== 3 || !cards.every(c => st.hands[seat].includes(c))) {
        throw Error('Seat ' + seat + ' must pass 3 of its own cards');
      }
    });
    const incoming = [[], [], [], []];
    passes.forEach((cards, seat) => { incoming[passTarget(seat, st.passDir)] = cards.slice(); });
    st.hands = st.hands.map((hand, seat) => sortHand(hand.filter(c => !passes[seat].includes(c)).concat(incoming[seat])));
    st.received = incoming[0];
    st.sel = [];
    st.phase = 'received';
  }

  function beginPlay(st) {
    const leader = st.hands.findIndex(h => h.includes('2C'));
    st.leader = leader;
    st.turn = leader;
    st.sel = [];
    st.phase = 'play';
  }

  function legalPlays(st, seat) {
    const hand = st.hands[seat];
    const first = st.trickNo === 0;
    if (!st.trick.length) {
      if (first) return hand.includes('2C') ? ['2C'] : hand.slice();
      if (!st.heartsBroken) {
        const nonHearts = hand.filter(c => suitOf(c) !== 'H');
        if (nonHearts.length) return nonHearts;
      }
      return hand.slice();
    }
    const led = suitOf(st.trick[0].card);
    const follow = hand.filter(c => suitOf(c) === led);
    if (follow.length) return follow;
    if (first) {
      const safe = hand.filter(c => !points(c));
      if (safe.length) return safe;
    }
    return hand.slice();
  }

  // Why a card is not allowed, for a friendly message. Returns null if it is allowed.
  function illegalReason(st, seat, card) {
    if (legalPlays(st, seat).includes(card)) return null;
    if (!st.trick.length) return st.trickNo === 0 ? 'mustLead2C' : 'noHeartsLead';
    const led = suitOf(st.trick[0].card);
    if (st.hands[seat].some(c => suitOf(c) === led)) return 'mustFollow';
    return 'noPointsFirst';
  }

  function winningPlay(trick) {
    const led = suitOf(trick[0].card);
    return trick.filter(p => suitOf(p.card) === led).reduce((a, b) => (rankValue(b.card) > rankValue(a.card) ? b : a));
  }

  function playCard(st, seat, card) {
    if (st.phase !== 'play' || st.turn !== seat) throw Error('Not seat ' + seat + "'s turn");
    if (!legalPlays(st, seat).includes(card)) throw Error(card + ' is not a legal play');
    st.hands[seat] = st.hands[seat].filter(c => c !== card);
    st.trick.push({ seat, card });
    if (suitOf(card) === 'H') st.heartsBroken = true;
    st.sel = [];
    if (st.trick.length === 4) {
      st.trickWinner = winningPlay(st.trick).seat;
      st.phase = 'trickEnd';
    } else {
      st.turn = (seat + 1) % 4;
    }
  }

  function collectTrick(st) {
    if (st.phase !== 'trickEnd') throw Error('No finished trick');
    const w = st.trickWinner;
    st.handPts[w] += st.trick.reduce((n, p) => n + points(p.card), 0);
    st.played.push(...st.trick.map(p => p.card));
    st.lastTrick = { plays: st.trick.map(p => ({ ...p })), winner: w };
    st.trick = [];
    st.trickWinner = null;
    st.trickNo += 1;
    if (st.trickNo === 13) return scoreHand(st);
    st.leader = w;
    st.turn = w;
    st.phase = 'play';
  }

  function scoreHand(st) {
    const shooter = st.handPts.indexOf(26);
    const added = shooter >= 0 ? st.handPts.map((p, i) => (i === shooter ? 0 : 26)) : st.handPts.slice();
    st.history.push(added);
    st.scores = st.scores.map((s, i) => s + added[i]);
    st.moon = shooter >= 0 ? shooter : null;
    st.phase = st.scores.some(s => s >= st.target) ? 'gameEnd' : 'handEnd';
  }

  function nextHand(st, rng) {
    if (st.phase !== 'handEnd') throw Error('Hand is not over');
    st.moon = null;
    startHand(st, rng);
  }

  // Lowest score wins; a tie for lowest is a shared win.
  function winners(st) {
    const low = Math.min(...st.scores);
    return [0, 1, 2, 3].filter(i => st.scores[i] === low);
  }

  /* ---------------- Computer players (use only their own hand and cards already played) ---------------- */
  function aiPass(hand) {
    const count = s => hand.filter(c => suitOf(c) === s).length;
    const spades = count('S');
    const keepsQueen = hand.includes('QS') && spades >= 5;
    const danger = c => {
      const s = suitOf(c), r = rankValue(c);
      if (c === 'QS') return keepsQueen ? -1 : 100;   // 5+ spades protect the queen: keep it
      if (s === 'S' && r > rankValue('QS')) return spades >= 5 ? r : 80 + r;   // A and K of spades catch the queen
      if (s === 'H') return 30 + r * 2;
      return r * 2 + (s !== 'S' && count(s) <= 3 ? (4 - count(s)) * 6 : 0);   // short suits: try to empty them
    };
    return hand.slice().sort((a, b) => danger(b) - danger(a)).slice(0, 3);
  }

  function aiPlay(st, seat) {
    const hand = st.hands[seat];
    const legal = legalPlays(st, seat);
    if (legal.length === 1) return legal[0];
    const seen = new Set(st.played.concat(st.trick.map(p => p.card)));
    const queenOut = !seen.has('QS') && !hand.includes('QS');   // someone else still holds the queen
    const suitLen = s => hand.filter(c => suitOf(c) === s).length;
    const notQueen = cards => { const rest = cards.filter(c => c !== 'QS'); return rest.length ? rest : cards; };

    if (!st.trick.length) {
      // Lead a low spade to flush out the queen when someone else holds it.
      if (queenOut) {
        const low = legal.filter(c => suitOf(c) === 'S' && rankValue(c) < rankValue('QS'));
        if (low.length) return lowest(low);
      }
      const risk = c => rankValue(c) + (suitOf(c) === 'H' ? 8 : 0) +
        (suitOf(c) === 'S' && rankValue(c) >= rankValue('QS') && !seen.has('QS') ? 30 : 0) - (suitLen(suitOf(c)) <= 2 ? 2 : 0);
      return legal.reduce((a, b) => (risk(b) < risk(a) ? b : a));
    }

    const led = suitOf(st.trick[0].card);
    const follow = legal.filter(c => suitOf(c) === led);
    if (follow.length) {
      const top = winningPlay(st.trick).card;
      const trickPts = st.trick.reduce((n, p) => n + points(p.card), 0);
      const last = st.trick.length === 3;
      if (led === 'S' && follow.includes('QS') && rankValue(top) > rankValue('QS')) return 'QS';   // dump it on the king or ace
      if (last && trickPts === 0) return highest(notQueen(follow));   // safe to win: shed a high card
      const under = follow.filter(c => rankValue(c) < rankValue(top));
      if (under.length) return highest(notQueen(under));   // duck as high as possible
      return last ? highest(notQueen(follow)) : lowest(notQueen(follow));
    }

    // Can't follow: get rid of trouble.
    if (legal.includes('QS')) return 'QS';
    if (queenOut) {
      for (const c of ['AS', 'KS']) if (legal.includes(c)) return c;
    }
    const hearts = legal.filter(c => suitOf(c) === 'H');
    if (hearts.length) return highest(hearts);
    return legal.reduce((a, b) => (rankValue(b) - rankValue(a) || suitLen(suitOf(a)) - suitLen(suitOf(b))) > 0 ? b : a);
  }

  /* ---------------- Saved-game check ---------------- */
  function validate(st) {
    try {
      if (!st || st.v !== 1 || !Array.isArray(st.hands) || st.hands.length !== 4) return false;
      if (!['pass', 'received', 'play', 'trickEnd', 'handEnd', 'gameEnd'].includes(st.phase)) return false;
      if (!PASS_CYCLE.includes(st.passDir) || !(st.handNo >= 1)) return false;
      const all = st.hands.flat().concat(st.trick.map(p => p.card), st.played);
      if (all.length !== 52 || new Set(all).size !== 52 || !all.every(isCard)) return false;
      if (![st.scores, st.handPts].every(a => Array.isArray(a) && a.length === 4 && a.every(n => Number.isInteger(n) && n >= 0))) return false;
      if (st.trickNo < 0 || st.trickNo > 13 || st.played.length !== st.trickNo * 4) return false;
      if (!Array.isArray(st.history) || !st.history.every(h => Array.isArray(h) && h.length === 4)) return false;
      if (st.phase === 'play' || st.phase === 'trickEnd') {
        const inTrick = new Set(st.trick.map(p => p.seat));
        if (!st.hands.every((h, i) => h.length === 13 - st.trickNo - (inTrick.has(i) ? 1 : 0))) return false;
        if (st.phase === 'play' && !(st.turn >= 0 && st.turn <= 3)) return false;
      }
      if (!Array.isArray(st.sel) || !st.sel.every(c => st.hands[0].includes(c))) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  const api = {
    SUITS, RANKS, PASS_CYCLE, TARGET, suitOf, rankOf, rankValue, points, fullDeck, sortHand, makeRng, shuffle,
    passTarget, passSource, newGame, startHand, applyPasses, beginPlay, legalPlays, illegalReason, winningPlay,
    playCard, collectTrick, nextHand, winners, aiPass, aiPlay, validate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Hearts = api;
})(typeof window !== 'undefined' ? window : this);
