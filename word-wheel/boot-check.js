/* Word Wheel: boot-check. Loaded first in index.html, before levels.js, i18n.js, fx.js and app.js.
   It has to keep working when everything after it fails, so it is deliberately old code: var, function,
   no arrows, no template strings, no destructuring, no classes, no optional chaining, no let/const.

   Shows a plain "couldn't start" screen (markup: #boot-fail in index.html) when the game truly failed:
   a script error (including a script that fails to load or fails to parse) before app.js sets
   window.__wordwheelReady, or __wordwheelReady never becoming true within 2 seconds of the window's
   "load" event (timed from load, not from page start, so a slow network is never mistaken for a failure).
   Never shows once the game is ready; hides itself again if the game becomes ready after it already
   showed (a slow script that eventually finished).
*/
(function () {
  'use strict';

  var shown = false;
  var goodNow = false;      // true once the game has been seen ready; from then on we never show again
  var firstError = null;
  var pollCount = 0;

  function trim(s, n) {
    if (!s) return '';
    s = String(s);
    if (s.length > n) return s.slice(0, n) + '...';
    return s;
  }

  // "iPad" on an iPad; iPadOS 13+ Safari reports "Macintosh", so treat a touch Macintosh as an iPad too.
  function deviceWord(ua) {
    if (ua.indexOf('iPad') !== -1) return 'iPad';
    if (ua.indexOf('Macintosh') !== -1 && navigator.maxTouchPoints > 1) return 'iPad';
    if (ua.indexOf('iPhone') !== -1) return 'iPhone';
    return 'device';
  }

  // "iPadOS 15.8" / "iOS 18.1" from the UA's own OS version; iPad Safari in desktop mode carries no OS
  // version, so fall back to "Safari 15.8" read from Version/x.y.
  function osFromUA(ua) {
    var m = ua.match(/CPU (?:iPhone )?OS (\d+_\d+(?:_\d+)?)/);
    if (m) {
      var v = m[1].replace(/_/g, '.');
      var isIPad = ua.indexOf('iPad') !== -1 || (ua.indexOf('Macintosh') !== -1 && navigator.maxTouchPoints > 1);
      return (isIPad ? 'iPadOS ' : 'iOS ') + v;
    }
    var v2 = ua.match(/Version\/(\d+(?:\.\d+)?)/);
    if (v2) return 'Safari ' + v2[1];
    return '';
  }

  function showScreen() {
    if (goodNow) return; // the game is fine; never show once it is
    shown = true;
    var el = document.getElementById('boot-fail');
    if (!el) return; // markup missing; nothing we can show
    var ua = navigator.userAgent || '';
    var msgEl = document.getElementById('boot-fail-msg');
    var errEl = document.getElementById('boot-fail-error');
    var osEl = document.getElementById('boot-fail-os');
    if (msgEl) {
      msgEl.textContent = "Word Wheel couldn't start on this " + deviceWord(ua) + ". Please send Shawn a screenshot of this screen.";
    }
    if (errEl) errEl.textContent = firstError ? trim(firstError, 300) : '';
    if (osEl) {
      var os = osFromUA(ua);
      osEl.textContent = os;
    }
    el.style.display = 'flex';
  }

  function hideScreen() {
    goodNow = true;
    if (shown) {
      var el = document.getElementById('boot-fail');
      if (el) el.style.display = 'none';
    }
  }

  // Capture phase: catches both real script errors and a script/asset that fails to load (the latter
  // never bubbles, so it can only be seen by listening on the way down).
  window.addEventListener('error', function (e) {
    if (window.__wordwheelReady) { goodNow = true; return; }
    // Of the files that fail to load, only the game's scripts and its stylesheet count (never an icon).
    var t = e && e.target;
    if (t && t !== window && t.tagName && t.tagName !== 'SCRIPT' && !(t.tagName === 'LINK' && t.rel === 'stylesheet')) return;
    if (!firstError) {
      if (e && e.target && e.target !== window && e.target.tagName) {
        var src = e.target.src || e.target.href || '';
        var name = src ? src.substring(src.lastIndexOf('/') + 1) : e.target.tagName.toLowerCase();
        firstError = 'Failed to load ' + name;
      } else if (e && e.message) {
        firstError = e.message;
      } else if (e && e.error && e.error.message) {
        firstError = e.error.message;
      } else {
        firstError = 'Script error.';
      }
    }
    showScreen();
  }, true);

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (window.__wordwheelReady) { goodNow = true; return; }
      showScreen();
    }, 2000);
  });

  // If the game becomes ready after the screen showed, hide it again. Gives up polling after a minute.
  var poll = setInterval(function () {
    pollCount++;
    if (window.__wordwheelReady) {
      hideScreen();
      clearInterval(poll);
    } else if (pollCount > 300) {
      clearInterval(poll);
    }
  }, 200);
}());
