/* Word Wheel (Claude): motion, haptic buzz and sounds. All of it is optional polish.
   Motion is skipped (or shown as a still version) when the phone asks for reduced motion.
   Sound plays only when turned on in Settings. Everything is drawn or synthesized here, so it works offline.
   Adapted from Claude Hearts' fx.js (buzz, sound engine and the marimba "not allowed" sound). */
(function (root) {
  'use strict';

  const FX = {};
  let scale = 1;                       // automated tests (?fast=1) shrink every duration
  FX.setSpeedScale = s => { scale = s; };
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  FX.reduced = reduced;
  const ms = n => Math.max(1, n * scale);
  FX.ms = ms;
  const canAnimate = el => el && typeof el.animate === 'function' && !reduced();
  const done = a => (a && a.finished ? a.finished.catch(() => {}) : Promise.resolve());
  const later = n => new Promise(res => setTimeout(res, ms(n)));

  /* ---------------- Motion ---------------- */
  // The word strip shakes "no".
  FX.shake = function (el) {
    if (!canAnimate(el)) return Promise.resolve();
    return done(el.animate([0, -10, 10, -8, 8, -4, 0].map(x => ({ transform: `translateX(${x}px)` })), { duration: ms(460), easing: 'ease-in-out' }));
  };

  // Squares that just filled in pop once.
  FX.pop = function (els) {
    return Promise.all(els.map((el, i) => canAnimate(el)
      ? done(el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.45 }, { transform: 'scale(1)' }],
        { duration: ms(280), delay: ms(i * 35), easing: 'ease-out' }))
      : Promise.resolve()));
  };

  // A word she already found: its squares flash gold twice. Reduce Motion: a still gold ring for a moment.
  FX.flash = function (els, color) {
    if (!els.length) return Promise.resolve();
    if (!canAnimate(els[0])) {
      els.forEach(el => el.classList.add('mark'));
      return later(900).then(() => els.forEach(el => el.classList.remove('mark')));
    }
    return Promise.all(els.map(el => {
      const bg = getComputedStyle(el).backgroundColor;
      return done(el.animate([
        { backgroundColor: bg, transform: 'scale(1)' },
        { backgroundColor: color, transform: 'scale(1.08)', offset: 0.5 },
        { backgroundColor: bg, transform: 'scale(1)' }
      ], { duration: ms(380), iterations: 2, easing: 'ease-in-out' }));
    }));
  };

  // A letter moved on the wheel (Shuffle): it slides from where it was.
  FX.slideFrom = function (el, dx, dy) {
    if (!canAnimate(el) || (!dx && !dy)) return Promise.resolve();
    return done(el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
      { duration: ms(360), easing: 'cubic-bezier(.3,.7,.3,1)' }));
  };

  // Letters fly from the word strip into their grid squares. items: [{ from: DOMRect, to: Element, ch: 'A' }].
  // Each target square stays hidden (class .landing, removed by the caller) until the letters have arrived.
  FX.flyLetters = function (items, opts) {
    opts = opts || {};
    items = items.filter(it => it.from && it.to && it.from.width);
    if (!items.length || !canAnimate(items[0].to)) return Promise.resolve();
    return Promise.all(items.map((it, i) => {
      const b = it.to.getBoundingClientRect();
      const size = Math.max(it.from.height, 24);
      const f = document.createElement('div');
      f.className = 'flyer';
      f.setAttribute('aria-hidden', 'true');
      f.textContent = it.ch;
      f.style.width = size + 'px';
      f.style.height = size + 'px';
      f.style.left = (it.from.left + it.from.width / 2 - size / 2) + 'px';
      f.style.top = (it.from.top + it.from.height / 2 - size / 2) + 'px';
      f.style.fontSize = Math.round(size * 0.7) + 'px';
      document.body.appendChild(f);
      const dx = (b.left + b.width / 2) - (it.from.left + it.from.width / 2);
      const dy = (b.top + b.height / 2) - (it.from.top + it.from.height / 2);
      const s = b.width / size;
      const a = f.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }],
        { duration: ms(opts.duration || 350), delay: ms((opts.stagger || 40) * i), easing: 'cubic-bezier(.45,0,.25,1)', fill: 'both' });
      return done(a).then(() => f.remove());
    }));
  };

  // Level finished: the grid squares glow gold in a calm wave (items: [{ el, step }], step = distance from the corner).
  // Reduce Motion: every square glows at once and stays still. Resolves when it has finished (about 1.5 s).
  FX.wave = function (items, color) {
    if (!items.length) return Promise.resolve();
    if (!canAnimate(items[0].el)) {
      items.forEach(it => it.el.classList.add('glow'));
      return later(1300).then(() => items.forEach(it => it.el.classList.remove('glow')));
    }
    const maxStep = Math.max(1, ...items.map(it => it.step));
    const stepMs = Math.min(90, 560 / maxStep);
    return Promise.all(items.map(it => {
      const bg = getComputedStyle(it.el).backgroundColor;
      return done(it.el.animate([
        { backgroundColor: bg, boxShadow: '0 0 0 0 rgba(252, 211, 77, 0)', transform: 'scale(1)' },
        { backgroundColor: color, boxShadow: '0 0 16px 5px rgba(252, 211, 77, 0.85)', transform: 'scale(1.07)', offset: 0.45 },
        { backgroundColor: bg, boxShadow: '0 0 0 0 rgba(252, 211, 77, 0)', transform: 'scale(1)' }
      ], { duration: ms(900), delay: ms(it.step * stepMs), easing: 'ease-in-out' }));
    })).then(() => later(150));
  };

  /* ---------------- Buzz (from Claude Hearts) ---------------- */
  // A short buzz she can feel with the phone on silent. iPhones (iOS 18 and later) give a small haptic tick when a
  // switch-style checkbox is flipped, so flip a hidden one; Android phones have navigator.vibrate.
  // Only works on a real phone and has to start from a touch; everywhere else it quietly does nothing.
  function tick() {
    const label = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.setAttribute('aria-hidden', 'true');
    label.style.display = 'none';
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  }
  FX.buzz = function (times) {
    times = times || 1;
    try {
      if (navigator.vibrate) { navigator.vibrate(times > 1 ? [45, 80, 45] : 30); return; }
      if (!root.matchMedia || !root.matchMedia('(pointer: coarse)').matches) return;
      tick();
      for (let i = 1; i < times; i++) setTimeout(() => { try { tick(); } catch (e) { /* no buzz */ } }, i * 140);
    } catch (e) { /* no buzz */ }
  };

  /* ---------------- Sound (engine from Claude Hearts) ---------------- */
  let ctx = null;
  FX.unlock = function () {
    try {
      if (!ctx) { const A = root.AudioContext || root.webkitAudioContext; if (!A) return; ctx = new A(); }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* no audio */ }
  };

  function tone(freq, at, dur, vol, type, glideTo) {
    const t0 = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  const SOUNDS = {
    // A soft tick for each letter added; it rises a whole step per letter (k = letters in the word so far).
    tick: k => { const f = 523 * Math.pow(2, (Math.min(k, 8) - 1) * 2 / 12); tone(f, 0, 0.08, 0.045); tone(f * 2, 0, 0.04, 0.012); },
    untick: () => tone(392, 0, 0.07, 0.035),                                                         // a letter taken away
    chime: () => [659, 880, 1319].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.06, 'triangle')),      // grid word found
    sparkle: () => [1319, 1760, 2093, 2637].forEach((f, i) => tone(f, i * 0.06, 0.28, 0.035)),      // bonus word
    reveal: () => { tone(880, 0, 0.2, 0.045, 'triangle'); tone(1175, 0.08, 0.25, 0.035, 'triangle'); },   // a hint letter appears
    // Hearts' "not allowed" sound, Shawn's pick: two wooden notes going down.
    nope: () => [523, 392].forEach((f, i) => { tone(f, i * 0.17, 0.4, 0.07); tone(f * 3.9, i * 0.17, 0.07, 0.02); }),
    fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.55, 0.08, 'triangle')); tone(1047, 0.55, 1.0, 0.04); },
    shuffle: () => [784, 659, 740].forEach((f, i) => tone(f, i * 0.05, 0.09, 0.025))
  };
  FX.sound = function (kind, arg) {
    try { FX.unlock(); if (ctx && SOUNDS[kind]) SOUNDS[kind](arg); } catch (e) { /* no audio */ }
  };

  root.FX = FX;
})(window);
