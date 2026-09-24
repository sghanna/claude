// Screen tests in WebKit (Safari's engine). Needs the game served, e.g.:
//   python3 -m http.server 8767 --bind 127.0.0.1   (from ~/claude-hearts)
//   node tests/ui.test.mjs [baseUrl] [games]
import { webkit, chromium } from '/opt/homebrew/lib/node_modules/playwright/index.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8767/';
const GAMES = +(process.argv[3] || 2);
let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.log('FAIL:', msg); } };
const phone = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

const browser = await webkit.launch();

async function newPage(w = 390, h = 844, query = '') {
  const ctx = await browser.newContext(phone(w, h));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(BASE + 'index.html?fast=1' + query);
  await page.waitForFunction(() => window.__hearts);
  return page;
}
const state = page => page.evaluate(() => window.__hearts.state());
const fits = page => page.evaluate(() => {
  const over = el => el.scrollWidth > el.clientWidth + 1;
  const box = el => el.getBoundingClientRect();
  const title = document.querySelector('.wordmark'), help = box(document.getElementById('help-button')), menu = box(document.getElementById('menu-button'));
  const titleOk = getComputedStyle(title).visibility === 'hidden' || (box(title).left >= help.right && box(title).right <= menu.left);
  const pillsOneLine = help.height < 50 && menu.height < 50;
  return titleOk && pillsOneLine && !over(document.getElementById('status')) && !over(document.getElementById('primary-action')) &&
    document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth;
});

// Play one full game through real taps. Returns counts.
async function playGame(page, label) {
  const seen = { hands: 0, tricks: 0, illegalTried: 0, layoutProblems: 0, statusEmpty: 0 };
  for (let step = 0; step < 4000; step++) {
    const s = await state(page);
    if (!(await page.evaluate(() => window.__hearts.rules.validate(window.__hearts.state())))) { ok(false, label + ': invalid state at step ' + step); break; }
    if (!(await fits(page))) seen.layoutProblems++;
    if (!(await page.locator('#status').textContent()).trim()) seen.statusEmpty++;
    if (s.phase === 'gameEnd') {
      // A celebration may play first; the results follow it.
      const shown = await page.locator('#end-dialog').waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
      ok(shown, label + ': game-over dialog shows');
      break;
    }
    if (s.phase === 'pass') {
      for (const c of s.hands[0].slice(0, 3)) await page.locator(`#hand [data-card="${c}"]`).tap();
      ok(await page.locator('#primary-action').isEnabled(), label + ': pass button enabled with 3 chosen');
      await page.locator('#primary-action').tap();
    } else if (s.phase === 'received') {
      const marked = await page.locator('#hand .card.received').count();
      if (marked !== 3) ok(false, label + ': received cards marked, got ' + marked);
      await page.locator('#primary-action').tap();
    } else if (s.phase === 'play' && s.turn === 0) {
      const legal = await page.evaluate(() => window.__hearts.rules.legalPlays(window.__hearts.state(), 0));
      const illegal = s.hands[0].find(c => !legal.includes(c));
      if (illegal && seen.illegalTried < 3) {   // tapping a card she can't play explains why and selects nothing
        await page.locator(`#hand [data-card="${illegal}"]`).tap({ force: true });
        const warn = await page.locator('#status.warn').count();
        const sel = (await state(page)).sel.length;
        if (!warn || sel) ok(false, label + ': illegal tap handled for ' + illegal);
        seen.illegalTried++;
      }
      const card = legal[legal.length - 1];
      await page.locator(`#hand [data-card="${card}"]`).tap();
      const btn = await page.locator('#primary-action').textContent();
      if (!btn.startsWith('Play the')) ok(false, label + ': play button names the card: ' + btn);
      await page.locator('#primary-action').tap();
    } else if (s.phase === 'handEnd') {
      seen.hands++;
      await page.locator('#end-dialog').waitFor({ state: 'visible' });
      await page.locator('#end-next').tap();
    } else {
      if (s.phase === 'trickEnd') seen.tricks++;
      await page.waitForTimeout(40);
    }
  }
  return seen;
}

// 1. Full games through the screen
for (let g = 0; g < GAMES; g++) {
  const page = await newPage(390, 844, '&seed=' + (500 + g));
  const t0 = Date.now();
  const seen = await playGame(page, 'game ' + g);
  const s = await state(page);
  ok(s.phase === 'gameEnd' && s.scores.some(x => x >= 100), `game ${g} reached the end (${s.handNo} hands)`);
  ok(seen.layoutProblems === 0, `game ${g}: no text overflow or scrolling at any step (${seen.layoutProblems} problems)`);
  ok(seen.statusEmpty === 0, `game ${g}: status line never empty`);
  ok(page.errors.length === 0, `game ${g}: no page errors ${page.errors.join(' | ')}`);
  console.log(`game ${g}: ${s.handNo} hands, final ${s.scores.join('/')}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.close();
}

// 2. Save and restore mid-hand, and a damaged save
{
  const page = await newPage(390, 844, '&seed=77');
  const s0 = await state(page);
  for (const c of s0.hands[0].slice(0, 3)) await page.locator(`#hand [data-card="${c}"]`).tap();
  await page.locator('#primary-action').tap();
  await page.locator('#primary-action').tap();   // continue into play
  await page.waitForTimeout(400);
  const before = await state(page);
  await page.goto(BASE + 'index.html?fast=1');   // no seed: loads the saved game
  await page.waitForFunction(() => window.__hearts);
  const after = await state(page);
  ok(JSON.stringify(after.hands) === JSON.stringify(before.hands) || after.trickNo >= before.trickNo, 'reload restores the game in progress');
  ok(after.handNo === before.handNo && after.passDir === before.passDir, 'reload keeps the hand number and pass direction');
  // Damage the save from another page on the same site (the game re-saves when it closes).
  await page.goto(BASE + 'manifest.json');
  await page.evaluate(() => localStorage.setItem('claude-hearts-game-v1', '{"v":1,"broken":true}'));
  await page.goto(BASE + 'index.html?fast=1');
  await page.waitForFunction(() => window.__hearts);
  ok(await page.locator('#last-dialog').isVisible(), 'damaged save: explains and starts a new game');
  ok((await state(page)).phase === 'pass', 'damaged save: new game is playable');
  await page.close();
}

// 3. Menus, guarded new game, last trick, scores, settings, languages
{
  const page = await newPage(390, 844, '&seed=5');
  await page.locator('#menu-button').tap();
  ok(await page.locator('#menu-dialog').isVisible(), 'menu opens');
  await page.locator('#menu-last').tap();
  ok((await page.locator('#last-body').textContent()).includes('No tricks'), 'last trick: none yet');
  await page.locator('#last-dialog [data-close]').tap();
  await page.locator('#menu-button').tap();
  await page.locator('#new-game').tap();
  ok(await page.locator('#new-dialog').isVisible(), 'new game asks first');
  await page.locator('#new-dialog [data-close]').tap();
  ok(await page.locator('#new-dialog').isHidden(), 'keep playing closes the question');
  await page.locator('#menu-button').tap();
  await page.locator('#menu-settings').tap();
  for (const [lang, word] of [['es', 'Ayuda'], ['vi', 'Trợ giúp'], ['en', 'Help']]) {
    await page.locator(`[data-set="lang"][data-val="${lang}"]`).tap();
    ok((await page.locator('#help-button').textContent()).includes(word), `language ${lang} applies`);
    ok(await fits(page), `language ${lang}: text fits`);
  }
  await page.locator('[data-set="speed"][data-val="normal"]').tap();
  ok((await page.evaluate(() => window.__hearts.settings().speed)) === 'normal', 'speed setting saved');
  await page.locator('#settings-dialog [data-close]').tap();
  // Play into the first trick, then check last trick and scores
  const s = await state(page);
  for (const c of s.hands[0].slice(0, 3)) await page.locator(`#hand [data-card="${c}"]`).tap();
  await page.locator('#primary-action').tap();
  await page.locator('#primary-action').tap();
  await page.waitForFunction(() => { const s = window.__hearts.state(); return s.trickNo >= 1 || (s.phase === 'play' && s.turn === 0); });
  let cur = await state(page);
  if (cur.phase === 'play' && cur.turn === 0) {
    const legal = await page.evaluate(() => window.__hearts.rules.legalPlays(window.__hearts.state(), 0));
    await page.locator(`#hand [data-card="${legal[0]}"]`).tap();
    await page.locator('#primary-action').tap();
  }
  await page.waitForFunction(() => window.__hearts.state().trickNo >= 1);
  await page.locator('#menu-button').tap();
  await page.locator('#menu-last').tap();
  ok(await page.locator('#last-body .card').count() === 4, 'last trick shows 4 cards');
  await page.locator('#last-dialog [data-close]').tap();
  await page.locator('#menu-button').tap();
  await page.locator('#menu-scores').tap();
  ok(await page.locator('#scores-body tbody tr').count() === 4, 'scores list all 4 players');
  await page.locator('#scores-dialog [data-close]').tap();
  ok(page.errors.length === 0, 'menus: no page errors ' + page.errors.join(' | '));
  await page.close();
}

// 4. Every language through a full game at the smallest size
for (const lang of ['es', 'vi']) {
  const page = await newPage(375, 667, `&seed=9&lang=${lang}`);
  const origOk = ok;
  let playLabel = 0;
  // playGame checks the English "Play the" label; for other languages check fit instead.
  const seen = await (async () => {
    const res = { layoutProblems: 0 };
    for (let step = 0; step < 4000; step++) {
      const s = await state(page);
      if (!(await fits(page))) res.layoutProblems++;
      if (s.phase === 'gameEnd' || s.handNo > 2) break;
      if (s.phase === 'pass') { for (const c of s.hands[0].slice(0, 3)) await page.locator(`#hand [data-card="${c}"]`).tap(); await page.locator('#primary-action').tap(); }
      else if (s.phase === 'received') await page.locator('#primary-action').tap();
      else if (s.phase === 'play' && s.turn === 0) {
        const legal = await page.evaluate(() => window.__hearts.rules.legalPlays(window.__hearts.state(), 0));
        await page.locator(`#hand [data-card="${legal[0]}"]`).tap(); playLabel++;
        if (!(await fits(page))) res.layoutProblems++;
        await page.locator('#primary-action').tap();
      } else if (s.phase === 'handEnd') { await page.locator('#end-dialog').waitFor({ state: 'visible' }); await page.locator('#end-next').tap(); }
      else await page.waitForTimeout(40);
    }
    return res;
  })();
  origOk(seen.layoutProblems === 0, `${lang} at 375x667: two hands with no text overflow (${seen.layoutProblems} problems, ${playLabel} plays)`);
  origOk(page.errors.length === 0, `${lang}: no page errors`);
  await page.close();
}

// 5. Phone sizes: no scrolling, 13 cards on screen, tap targets
for (const [w, h] of [[390, 844], [390, 763], [390, 740], [375, 667]]) {
  const page = await newPage(w, h, '&seed=11');
  const m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#hand .card')].map(e => e.getBoundingClientRect());
    const buttons = [...document.querySelectorAll('button')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect());
    return {
      cards: cards.length, inView: cards.every(r => r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth),
      minCard: Math.min(...cards.map(r => Math.min(r.width, r.height))), minButton: Math.min(...buttons.map(r => Math.min(r.width, r.height))),
      scroll: document.documentElement.scrollHeight > innerHeight
    };
  });
  ok(m.cards === 13 && m.inView && !m.scroll, `${w}x${h}: 13 cards on screen, no scrolling`);
  ok(m.minCard >= 44 && m.minButton >= 44, `${w}x${h}: targets at least 44 px (cards ${Math.round(m.minCard)}, buttons ${Math.round(m.minButton)})`);
  await page.screenshot({ path: new URL(`../tests/shots/pass-${w}x${h}.png`, import.meta.url).pathname });
  await page.close();
}

// 6. Offline: after one visit, the game loads with the network off.
// Uses Chromium: Playwright's WebKit build errors on any offline reload, even with the service worker in control.
{
  const chrome = await chromium.launch();
  const ctx = await chrome.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + 'index.html');
  const ready = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'no service worker support';
    const reg = await navigator.serviceWorker.ready;
    return reg.active ? 'active' : 'not active';
  }).catch(e => 'error: ' + e.message);
  if (ready === 'active') {
    await page.reload();
    await ctx.setOffline(true);
    let offlineOk = false;
    try { await page.reload(); offlineOk = await page.locator('#hand .card').count() === 13; } catch (e) { offlineOk = false; }
    ok(offlineOk, 'plays offline after first visit');
    // Another game on the same site wipes our copy (agy-solitaire's cleanup does this): one online visit refills it.
    await ctx.setOffline(false);
    await page.evaluate(async () => { await caches.open('solitaire-v99'); await caches.delete('claude-hearts-v1'); });
    await page.reload(); await page.waitForTimeout(1500);
    const kept = await page.evaluate(async () => (await caches.keys()).includes('solitaire-v99'));
    await ctx.setOffline(true);
    let healed = false;
    try { await page.reload(); healed = await page.locator('#hand .card').count() === 13; } catch (e) { healed = false; }
    ok(healed && kept, 'after another app wipes the offline copy, one online visit restores it (and other games\' copies are left alone)');
  } else {
    ok(false, 'offline: service worker not active (' + ready + ')');
  }
  await chrome.close();
}

// 7. A full game with motion and sound on: nothing stalls, stats are recorded once, celebrations clean up.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await ctx.addInitScript(() => { if (!localStorage.getItem('claude-hearts-settings-v1')) localStorage.setItem('claude-hearts-settings-v1', JSON.stringify({ lang: 'en', speed: 'slow', sound: true })); });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + 'index.html?fast=1&seed=701');
  await page.waitForFunction(() => window.__hearts);
  const t0 = Date.now();
  for (let i = 0; i < 6000 && Date.now() - t0 < 240000; i++) {
    const s = await state(page);
    if (s.phase === 'gameEnd' && await page.locator('#end-dialog').isVisible()) break;
    if (s.phase === 'pass') {
      for (const c of s.hands[0].slice(0, 3)) await page.locator(`#hand [data-card="${c}"]`).tap();
      await page.locator('#primary-action').tap();
      await page.waitForFunction(() => window.__hearts.state().phase !== 'pass');
    } else if (s.phase === 'received') { await page.locator('#primary-action').tap(); await page.waitForFunction(() => window.__hearts.state().phase !== 'received'); }
    else if (s.phase === 'play' && s.turn === 0) {
      const legal = await page.evaluate(() => window.__hearts.rules.legalPlays(window.__hearts.state(), 0));
      await page.locator(`#hand [data-card="${legal[legal.length - 1]}"]`).tap();
      await page.locator('#primary-action').tap();
      await page.waitForFunction(() => { const x = window.__hearts.state(); return !(x.phase === 'play' && x.turn === 0); });
    } else if (s.phase === 'handEnd' && await page.locator('#end-dialog').isVisible()) await page.locator('#end-next').tap();
    else await page.waitForTimeout(15);
  }
  const s = await state(page), stats = await page.evaluate(() => window.__hearts.stats());
  ok(s.phase === 'gameEnd', `motion and sound on: full game finished (${s.handNo} hands)`);
  ok(stats.games === 1, 'motion and sound on: stats recorded exactly once');
  ok(await page.locator('.celebrate').count() === 0 && errs.length === 0, 'motion and sound on: celebrations cleaned up, no page errors ' + errs.join(' | '));
  await ctx.close();
}

// 8. Options pages: demos render and never touch the real saved game.
{
  const page = await newPage(390, 844, '&seed=5');
  const before = await page.evaluate(() => localStorage.getItem('claude-hearts-game-v1'));
  for (const q of ['demo=follow&playable=soft', 'demo=follow&playable=deepred', 'demo=follow&playable=ring', 'demo=mixup&playable=grey', 'demo=mixup&playable=ghost&logo=1&badge=bigger',
    'demo=received&arrive=glide', 'demo=win&celebrate=lanterns', 'demo=clean&celebrate=cards', 'demo=moon&celebrate=moonhearts', 'demo=moon']) {
    await page.goto(BASE + 'index.html?' + q);
    await page.waitForFunction(() => window.__hearts);
  }
  await page.waitForSelector('#end-dialog:not([hidden])', { timeout: 15000 });
  const after = await page.evaluate(() => localStorage.getItem('claude-hearts-game-v1'));
  ok(after === before, 'demo pages never overwrite the saved game');
  ok(page.errors.length === 0, 'demo pages: no page errors ' + page.errors.join(' | '));
  await page.close();
}

// 9. After her playtest: long holds and slides still count as taps, nothing selects, new motion and top-bar options.
{
  const page = await newPage(390, 844, '&seed=5');
  const sel = () => page.evaluate(() => window.__hearts.state().sel.slice());
  const noSelect = await page.evaluate(() => ['#status', '.dialog p', '.plate .name', '#rules'].every(q => {
    const el = document.querySelector(q);
    return el && getComputedStyle(el).webkitUserSelect === 'none';
  }) && !document.dispatchEvent(new Event('selectstart', { cancelable: true })));
  ok(noSelect, 'no text can be selected, dialogs included');
  // A long hold that Safari does not turn into a click: our own pointerup handler taps the card once.
  const card = (await state(page)).hands[0][4];
  await page.evaluate(async code => {
    const el = document.querySelector(`#hand [data-card="${code}"]`), r = el.getBoundingClientRect();
    const at = { clientX: r.left + 20, clientY: r.top + 30, pointerId: 7, bubbles: true, pointerType: 'touch' };
    el.dispatchEvent(new PointerEvent('pointerdown', at));
    await new Promise(res => setTimeout(res, 700));
    el.dispatchEvent(new PointerEvent('pointerup', at));
  }, card);
  ok((await sel()).join() === card, 'a long hold with no click from Safari still selects the card');
  await page.close();
}
{
  // Real mouse presses (WebKit sends its own click too): each counts exactly once.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + 'index.html?fast=1&seed=5');
  await page.waitForFunction(() => window.__hearts);
  const hand = (await state(page)).hands[0];
  const center = async q => { const b = await page.locator(q).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  let [x, y] = await center(`#hand [data-card="${hand[0]}"]`);
  await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
  ok((await state(page)).sel.join() === hand[0], 'long press on a card counts once (not twice)');
  for (const c of hand.slice(1, 3)) await page.locator(`#hand [data-card="${c}"]`).click();
  ok((await state(page)).sel.length === 3, 'a quick tap right after a long press is not lost');
  // Slide far away from the Play button: not a tap.
  [x, y] = await center('#primary-action');
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 160, { steps: 6 }); await page.mouse.up();
  ok((await state(page)).phase === 'pass', 'a long slide away from the button is not a tap');
  // Slide up a little off the Play button before lifting: still a tap, once.
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 6, y - 36, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(300);
  const s = await state(page);
  ok(s.phase === 'received' && s.sel.length === 0, 'tap on Play that slides up a little still counts, once (phase ' + s.phase + ')');
  ok(errs.length === 0, 'mouse presses: no page errors ' + errs.join(' | '));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  // Passed cards glide into her hand; their places stay empty until they land.
  await page.goto(BASE + 'index.html?demo=received&arrive=glide');
  await page.waitForFunction(() => window.__hearts);
  await page.locator('#primary-action').tap();
  await page.waitForTimeout(150);
  const hiddenDuring = await page.evaluate(() => [...document.querySelectorAll('#hand .card')].filter(e => getComputedStyle(e).visibility === 'hidden').length);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ phase: window.__hearts.state().phase, hidden: [...document.querySelectorAll('#hand .card')].filter(e => getComputedStyle(e).visibility === 'hidden').length, n: document.querySelectorAll('#hand .card').length }));
  ok(hiddenDuring === 3 && after.phase === 'play' && after.hidden === 0 && after.n === 13, `passed cards fly into her hand (${hiddenDuring} waiting, then ${JSON.stringify(after)})`);
  // A tap on a card she can't play: the card shakes, or the playable cards hop, and the reason shows.
  for (const nope of ['shake', 'hop']) {
    await page.goto(BASE + `index.html?demo=mixup&playable=grey&nope=${nope}`);
    await page.waitForFunction(() => window.__hearts);
    ok(await page.locator('#hand .card.unplayable.grey').count() === 6, `${nope}: the 6 cards she can't play are greyed`);
    await page.locator('#hand [data-card="8D"]').tap({ force: true });
    const moving = await page.evaluate(() => document.getAnimations().length);
    ok(moving > 0 && await page.locator('#status.warn').count() === 1, `${nope}: tap on the 8 of diamonds moves something (${moving}) and explains`);
  }
  // Top bar: logo, bigger badges above the names, in all three languages.
  for (const lang of ['en', 'es', 'vi']) {
    for (const badge of ['big', 'bigger']) {
      await page.goto(BASE + `index.html?demo=mixup&logo=1&pillborder=0&badge=${badge}&lang=${lang}`);
      await page.waitForFunction(() => window.__hearts);
      await page.waitForTimeout(700);   // let the badges' arrival bump finish
      const m = await page.evaluate(() => {
        const logo = document.querySelector('.wordmark .logo').getBoundingClientRect();
        const help = document.getElementById('help-button').getBoundingClientRect(), menu = document.getElementById('menu-button').getBoundingClientRect();
        const clear = [...document.querySelectorAll('.plate')].every(p => {
          const b = p.querySelector('.badge'); if (!b) return true;
          const name = p.querySelector('.name'), range = document.createRange(); range.selectNodeContents(name);
          return b.getBoundingClientRect().bottom <= range.getBoundingClientRect().top + 3;   // the line box starts ~3 px above the letters
        });
        return { logo: logo.width > 30 && logo.left >= help.right && logo.right <= menu.left, clear, badges: document.querySelectorAll('.badge').length };
      });
      ok(m.logo && m.clear && m.badges === 3 && await fits(page), `top bar ${lang}/${badge}: logo between the buttons, badges above the names, everything fits ${JSON.stringify(m)}`);
    }
  }
  ok(errs.length === 0, 'new options: no page errors ' + errs.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(`${checks} checks, ${failures} failed.`);
process.exit(failures ? 1 : 0);
