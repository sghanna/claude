// Rules tests: specific rule checks, then many simulated games with every seat played by the computer.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const H = require('../rules.js');
let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.log('FAIL:', msg); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function stateWith(hands, extra = {}) {
  const st = H.newGame(H.makeRng(1));
  st.hands = hands.map(h => H.sortHand(h));
  st.played = []; st.trick = []; st.trickNo = 0; st.heartsBroken = false; st.handPts = [0, 0, 0, 0];
  Object.assign(st, { phase: 'play' }, extra);
  return st;
}
// Fill hands out to 52 cards so validate() passes when needed (not required for legality checks).

// 1. Pass directions and conservation
ok(H.passTarget(0, 'left') === 1 && H.passTarget(0, 'right') === 3 && H.passTarget(0, 'across') === 2, 'pass targets from you');
ok(H.passSource(0, 'left') === 3 && H.passSource(0, 'right') === 1 && H.passSource(0, 'across') === 2, 'pass sources to you');
{
  const st = H.newGame(H.makeRng(7));
  ok(st.phase === 'pass' && st.passDir === 'left', 'hand 1 passes left');
  const passes = st.hands.map(h => h.slice(0, 3));
  H.applyPasses(st, passes);
  ok(eq(st.received, passes[3]), 'you receive from Barbara when passing left');
  ok(passes[0].every(c => st.hands[1].includes(c)), 'your cards go to Michael');
  ok(st.hands.every(h => h.length === 13) && new Set(st.hands.flat()).size === 52, 'passing keeps 52 unique cards');
  let threw = false; try { H.applyPasses(st, passes); } catch { threw = true; }
  ok(threw, 'cannot pass twice');
}
{
  const st = H.newGame(H.makeRng(3));
  const dirs = [];
  for (let i = 0; i < 8; i++) { dirs.push(st.passDir); st.phase = 'handEnd'; H.nextHand(st, H.makeRng(i)); }
  ok(eq(dirs, ['left', 'right', 'across', 'hold', 'left', 'right', 'across', 'hold']), 'pass cycle: ' + dirs.join(','));
}
{
  const st = H.newGame(H.makeRng(3));
  for (let i = 0; i < 3; i++) { st.phase = 'handEnd'; H.nextHand(st, H.makeRng(i)); }
  ok(st.passDir === 'hold' && st.phase === 'play' && st.hands[st.turn].includes('2C'), 'hold hand skips passing and 2C holder leads');
}

// 2. First trick
{
  const st = stateWith([['2C', '3C', 'AH', 'QS'], ['4C', 'KH'], ['5D'], ['6S']], { turn: 0 });
  ok(eq(H.legalPlays(st, 0), ['2C']), 'first lead must be the 2 of clubs');
  ok(H.illegalReason(st, 0, '3C') === 'mustLead2C', 'reason for wrong first lead');
  H.playCard(st, 0, '2C');
  ok(eq(H.legalPlays(st, 1), ['4C']), 'must follow clubs on trick 1');
  st.turn = 2;
  ok(eq(H.legalPlays(st, 2), ['5D']), 'void on trick 1: non-point card allowed');
}
{
  const st = stateWith([['2C'], ['AH', 'QS', '3D'], [], []], { turn: 1, trick: [{ seat: 0, card: '2C' }] });
  ok(eq(H.legalPlays(st, 1), ['3D']), 'void on trick 1: no hearts or queen of spades if avoidable');
  ok(H.illegalReason(st, 1, 'QS') === 'noPointsFirst', 'reason for points on trick 1');
  const st2 = stateWith([['2C'], ['AH', 'QS', 'KH'], [], []], { turn: 1, trick: [{ seat: 0, card: '2C' }] });
  ok(H.legalPlays(st2, 1).length === 3, 'void on trick 1 with only points: anything allowed');
}

// 3. Leading hearts
{
  const st = stateWith([['3H', '5D'], [], [], []], { turn: 0, trickNo: 2 });
  ok(eq(H.legalPlays(st, 0), ['5D']), 'cannot lead hearts before they are broken');
  ok(H.illegalReason(st, 0, '3H') === 'noHeartsLead', 'reason for leading hearts early');
  st.heartsBroken = true;
  ok(H.legalPlays(st, 0).length === 2, 'can lead hearts once broken');
  const st2 = stateWith([['3H', '9H'], [], [], []], { turn: 0, trickNo: 2 });
  ok(H.legalPlays(st2, 0).length === 2, 'can lead hearts if you hold only hearts');
  const st3 = stateWith([['2C', '5D'], ['QS', '3S'], ['4D'], ['6D']], { turn: 1, trickNo: 2, trick: [{ seat: 0, card: '5D' }] });
  H.playCard(st3, 1, 'QS');
  ok(st3.heartsBroken === false, 'queen of spades does not break hearts');
}

// 4. Trick winner and follow suit
{
  const st = stateWith([['5D', 'KD'], ['AC', '9D'], ['AD', '2S'], ['3D', 'AH']], { turn: 0, trickNo: 3 });
  ok(H.illegalReason(Object.assign(stateWith([['5D'], ['AC', '9D'], [], []], { turn: 1, trickNo: 3, trick: [{ seat: 0, card: '5D' }] })), 1, 'AC') === 'mustFollow', 'must follow suit');
  H.playCard(st, 0, '5D'); H.playCard(st, 1, '9D'); H.playCard(st, 2, 'AD'); H.playCard(st, 3, '3D');
  ok(st.phase === 'trickEnd' && st.trickWinner === 2, 'highest card of the led suit wins');
}
{
  const st = stateWith([['5D'], ['AC'], ['2D'], ['AH']], { turn: 0, trickNo: 3, heartsBroken: true });
  // Seat 1 void in diamonds: off-suit ace does not win
  st.hands[1] = ['AC']; H.playCard(st, 0, '5D'); H.playCard(st, 1, 'AC'); H.playCard(st, 2, '2D'); H.playCard(st, 3, 'AH');
  ok(st.trickWinner === 0, 'off-suit cards never win');
}

// 5. Scoring, moon, game end, ties
{
  const st = H.newGame(H.makeRng(9));
  st.handPts = [26, 0, 0, 0]; st.trickNo = 12; st.phase = 'trickEnd'; st.trick = []; st.trickWinner = 0;
  st.played = st.hands.flat().slice(0, 48);
  // collectTrick adds the (empty) trick then scores the hand
  H.collectTrick(st);
  ok(eq(st.history.at(-1), [0, 26, 26, 26]) && st.moon === 0, 'shooting the moon gives everyone else 26');
}
{
  const st = H.newGame(H.makeRng(9));
  st.scores = [90, 40, 50, 60]; st.handPts = [13, 5, 4, 4]; st.trickNo = 12; st.phase = 'trickEnd'; st.trick = []; st.trickWinner = 0;
  H.collectTrick(st);
  ok(st.phase === 'gameEnd' && eq(H.winners(st), [1]), 'game ends at 100, low score wins');
  const st2 = H.newGame(H.makeRng(9));
  st2.scores = [95, 40, 40, 60]; st2.handPts = [10, 0, 0, 16]; st2.trickNo = 12; st2.phase = 'trickEnd'; st2.trick = []; st2.trickWinner = 0;
  H.collectTrick(st2);
  ok(st2.phase === 'gameEnd' && eq(H.winners(st2), [1, 2]), 'tie for lowest is a shared win');
}

// 6. Computer passing
{
  const p = H.aiPass(['QS', '3S', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', '2D', '3D', '4D']);
  ok(p.includes('QS'), 'computer passes an unprotected queen of spades');
  const keep = H.aiPass(['QS', '2S', '3S', '4S', '5S', 'AH', 'KH', '2C', '3C', '4C', '5C', '6C', '7C']);
  ok(!keep.includes('QS') && keep.includes('AH') && keep.includes('KH'), 'computer keeps a protected queen and passes high hearts');
}

// 7. Simulated games
const GAMES = +(process.argv[2] || 3000);
let hands = 0, moons = 0, holdHands = 0, maxHands = 0, errors = 0, tricksChecked = 0;
for (let g = 0; g < GAMES; g++) {
  const rng = H.makeRng(1000 + g);
  const st = H.newGame(rng);
  let steps = 0;
  try {
    while (st.phase !== 'gameEnd') {
      if (++steps > 20000) throw Error('no progress');
      if (!H.validate(st)) throw Error('invalid state in phase ' + st.phase);
      if (st.phase === 'pass') H.applyPasses(st, st.hands.map(h => H.aiPass(h)));
      else if (st.phase === 'received') H.beginPlay(st);
      else if (st.phase === 'play') {
        const seat = st.turn, legal = H.legalPlays(st, seat), card = H.aiPlay(st, seat);
        if (!legal.includes(card)) throw Error('AI chose illegal ' + card);
        if (st.trickNo === 0 && !st.trick.length && card !== '2C') throw Error('first lead not 2C');
        if (!st.trick.length && H.suitOf(card) === 'H' && !st.heartsBroken && st.hands[seat].some(c => H.suitOf(c) !== 'H')) throw Error('led hearts early');
        H.playCard(st, seat, card);
      } else if (st.phase === 'trickEnd') { tricksChecked++; H.collectTrick(st); }
      else if (st.phase === 'handEnd') {
        const last = st.history.at(-1), sum = last.reduce((a, b) => a + b, 0);
        if (!(sum === 26 || (st.moon !== null && sum === 78))) throw Error('hand points ' + sum);
        hands++; if (st.moon !== null) moons++;
        H.nextHand(st, rng);
        if (st.passDir === 'hold') holdHands++;
      }
    }
    hands++;
    const total = st.history.reduce((acc, h) => acc.map((v, i) => v + h[i]), [0, 0, 0, 0]);
    if (!eq(total, st.scores)) throw Error('scores do not match history');
    if (!st.scores.some(s => s >= 100)) throw Error('ended below 100');
    maxHands = Math.max(maxHands, st.handNo);
  } catch (e) { errors++; if (errors < 5) console.log('game', g, 'error:', e.message); }
}
ok(errors === 0, `simulated ${GAMES} games without errors (${errors} errors)`);
console.log(`${checks} checks, ${failures} failed. Simulated ${GAMES} games: ${hands} hands, ${tricksChecked} tricks, ${holdHands} no-pass hands, ${moons} moon shots, longest game ${maxHands} hands.`);
process.exit(failures ? 1 : 0);
