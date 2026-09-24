/* Hearts (Claude): motion, sound and celebrations. All of it is optional polish.
   Motion is skipped when the phone asks for reduced motion. Sound plays only when turned on in Settings.
   Everything is drawn or synthesized here, so it works offline with no extra files. */
(function (root) {
  'use strict';

  const FX = {};
  let scale = 1;                       // automated tests shrink every duration
  FX.setSpeedScale = s => { scale = s; };
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  FX.reduced = reduced;
  const ms = n => Math.max(1, n * scale);
  const canAnimate = el => el && typeof el.animate === 'function' && !reduced();

  /* ---------------- Motion ---------------- */
  // el already sits in its final place; make it look like it traveled there from `from` (a DOMRect).
  FX.flyFrom = function (el, from, opts) {
    opts = opts || {};
    if (!from || !canAnimate(el)) return Promise.resolve();
    const to = el.getBoundingClientRect();
    if (!to.width) return Promise.resolve();
    const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
    const s = opts.scale != null ? opts.scale : Math.max(0.3, Math.min(1.4, from.width / to.width));
    return el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: opts.opacity != null ? opts.opacity : 1 },
      { transform: 'none', opacity: 1 }
    ], { duration: ms(opts.duration || 320), delay: ms(opts.delay || 0), easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' })
      .finished.catch(() => {});
  };

  // Send elements toward a target (a DOMRect), shrinking and fading. Resolves when all have arrived.
  FX.flyTo = function (els, to, opts) {
    opts = opts || {};
    if (!els.length || !to || !canAnimate(els[0])) return Promise.resolve();
    const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
    return Promise.all(els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return el.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translate(${tx - (r.left + r.width / 2)}px, ${ty - (r.top + r.height / 2)}px) scale(${opts.scale || 0.35})`, opacity: 0.1 }
      ], { duration: ms(opts.duration || 480), delay: ms((opts.stagger || 0) * i), easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' })
        .finished.catch(() => {});
    }));
  };

  /* ---------------- Sound ---------------- */
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

  function noise(at, dur, vol, fromHz, toHz) {
    const t0 = ctx.currentTime + at, len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf;
    f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(fromHz, t0);
    if (toHz) f.frequency.exponentialRampToValueAtTime(toHz, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  const SOUNDS = {
    select: () => tone(1320, 0, 0.06, 0.03),                                          // tiny tick: card chosen
    illegal: () => tone(196, 0, 0.14, 0.06, 'triangle'),                              // soft low note: not allowed
    play: () => { noise(0, 0.07, 0.12, 1500); tone(170, 0, 0.1, 0.05); },             // card lands on the felt
    collect: () => noise(0, 0.24, 0.06, 1800, 500),                                   // trick swept away
    points: () => { tone(392, 0, 0.18, 0.06, 'triangle'); tone(311, 0.15, 0.3, 0.06, 'triangle'); },   // you took points
    queen: () => { tone(147, 0, 0.55, 0.1, 'sine', 110); tone(220, 0, 0.3, 0.03, 'triangle'); },       // the queen falls
    hearts: () => { tone(1047, 0, 0.7, 0.05); tone(1568, 0.02, 0.5, 0.02); },         // soft bell: hearts broken
    end: () => [523, 659].forEach((f, i) => tone(f, i * 0.14, 0.32, 0.06, 'triangle')),
    clean: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.12, 0.4, 0.07, 'triangle')),
    big: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.55, 0.08, 'triangle')); tone(1047, 0.55, 1.0, 0.04); }
  };
  FX.sound = function (kind) {
    try { FX.unlock(); if (ctx && SOUNDS[kind]) SOUNDS[kind](); } catch (e) { /* no audio */ }
  };

  /* ---------------- Celebrations ---------------- */
  // kind: 'clean' (small) or 'moon' / 'win' (big). style: 'ribbon', 'cards' or 'lanterns'.
  // Resolves when it has finished, so the results can wait for it.
  const CHARS = ['龍', '福', '禄', '寿', '吉', '财', '旺', '春', '和'];   // same nine as agy-solitaire's lanterns
  let uid = 0;

  function heartCard() {
    // glyphs.js declares GLYPHS as a top-level const, which is global but not a property of window.
    const g = typeof GLYPHS !== 'undefined' ? GLYPHS.big_H : null;
    const heart = g ? `<svg x="9" y="16" width="34" height="34" viewBox="${g.box.join(' ')}"><path transform="translate(0,${g.h}) scale(0.1,-0.1)" d="${g.d}" fill="#c62f27"/></svg>` : '';
    return `<svg viewBox="0 0 52 72" width="52" height="72"><rect x="1" y="1" width="50" height="70" rx="6" fill="#fbfaf5" stroke="#fbbf24" stroke-width="2"/>${heart}</svg>`;
  }

  function lantern(ch) {
    const id = 'lg' + (uid++);
    return `<svg viewBox="0 0 60 88" width="60" height="88"><defs><radialGradient id="${id}" cx="50%" cy="45%" r="60%">` +
      `<stop offset="0" stop-color="#ffd27a"/><stop offset=".5" stop-color="#e0431f"/><stop offset="1" stop-color="#9b1b12"/></radialGradient></defs>` +
      `<rect x="24" y="0" width="12" height="8" rx="2" fill="#fbbf24"/><ellipse cx="30" cy="44" rx="27" ry="33" fill="url(#${id})"/>` +
      `<rect x="9" y="13" width="42" height="5" rx="2.5" fill="#fbbf24"/><rect x="9" y="70" width="42" height="5" rx="2.5" fill="#fbbf24"/>` +
      `<text x="30" y="53" text-anchor="middle" font-size="24" font-weight="700" fill="#fde68a" font-family="PingFang SC, Hiragino Sans, sans-serif">${ch}</text>` +
      `<line x1="30" y1="75" x2="30" y2="88" stroke="#fbbf24" stroke-width="2"/></svg>`;
  }

  function star() {
    return '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M10 0 L12.2 7.8 L20 10 L12.2 12.2 L10 20 L7.8 12.2 L0 10 L7.8 7.8 Z" fill="#fde68a"/></svg>';
  }

  FX.celebrate = function (opts) {
    const big = opts.kind !== 'clean';
    const total = ms(big ? (opts.style === 'lanterns' ? 4600 : 3800) : 2200);
    const layer = document.createElement('div');
    layer.className = 'celebrate';
    layer.setAttribute('aria-hidden', 'true');
    const ribbon = document.createElement('div');
    ribbon.className = 'ribbon' + (big ? ' big' : '');
    ribbon.textContent = opts.text.replace(/([!.]) (?=\S)/, '$1\n');   // two sentences, two lines
    layer.appendChild(ribbon);
    document.body.appendChild(layer);
    const anims = [];
    const W = root.innerWidth, Hh = root.innerHeight;

    if (reduced() || typeof ribbon.animate !== 'function') {
      // Still, readable acknowledgment with no movement.
      return new Promise(res => setTimeout(() => { layer.remove(); res(); }, total));
    }

    anims.push(ribbon.animate([
      { transform: 'translateY(-24px) scale(.92)', opacity: 0 },
      { transform: 'none', opacity: 1, offset: 0.12 },
      { transform: 'none', opacity: 1, offset: 0.86 },
      { transform: 'translateY(-10px)', opacity: 0 }
    ], { duration: total, easing: 'ease-out', fill: 'forwards' }));

    const add = (html, cls) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; layer.appendChild(d); return d; };
    const rnd = (a, b) => a + Math.random() * (b - a);

    if (opts.style === 'ribbon') {
      const n = big ? 14 : 8;
      const rb = ribbon.getBoundingClientRect();
      for (let i = 0; i < n; i++) {
        const s = add(star(), 'sparkle');
        const ang = (i / n) * Math.PI * 2, rx = rb.width / 2 + rnd(14, 40), ry = rb.height / 2 + rnd(16, 44);
        s.style.left = (rb.left + rb.width / 2 + Math.cos(ang) * rx - 10) + 'px';
        s.style.top = (rb.top + rb.height / 2 + Math.sin(ang) * ry - 10) + 'px';
        anims.push(s.animate([
          { transform: 'scale(0) rotate(0deg)', opacity: 0 },
          { transform: 'scale(1.25) rotate(45deg)', opacity: 1, offset: 0.35 },
          { transform: 'scale(.7) rotate(90deg)', opacity: 0.9, offset: 0.7 },
          { transform: 'scale(0) rotate(135deg)', opacity: 0 }
        ], { duration: ms(rnd(900, 1400)), delay: ms(rnd(0, total * 0.55)), iterations: big ? 2 : 1, fill: 'both' }));
      }
    } else {
      const n = opts.style === 'lanterns' ? (big ? 9 : 5) : (big ? 16 : 7);
      for (let i = 0; i < n; i++) {
        const lanterns = opts.style === 'lanterns';
        const el = add(lanterns ? lantern(CHARS[i % CHARS.length]) : heartCard(), lanterns ? 'floater lantern' : 'floater');
        const x = (W / (n + 1)) * (i + 1) - (lanterns ? 30 : 26) + rnd(-18, 18);
        el.style.left = x + 'px';
        el.style.top = Hh + 'px';
        const rise = Hh + 160, sway = rnd(-30, 30), turn = lanterns ? rnd(-6, 6) : rnd(-40, 40);
        const dur = ms(lanterns ? rnd(3600, 4400) : rnd(2400, 3200));
        anims.push(el.animate([
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 0 },
          { transform: `translate(${sway / 2}px, ${-rise * 0.2}px) rotate(${turn / 3}deg)`, opacity: 1, offset: 0.15 },
          { transform: `translate(${sway}px, ${-rise * 0.8}px) rotate(${turn}deg)`, opacity: 1, offset: 0.8 },
          { transform: `translate(${sway}px, ${-rise}px) rotate(${turn}deg)`, opacity: 0 }
        ], { duration: dur, delay: ms(rnd(0, lanterns ? 700 : 900)), easing: 'linear', fill: 'both' }));
      }
    }

    return new Promise(res => setTimeout(() => { anims.forEach(a => { try { a.cancel(); } catch (e) { /* done */ } }); layer.remove(); res(); }, total));
  };

  root.FX = FX;
})(window);
