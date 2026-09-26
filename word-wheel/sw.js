/* Offline support: keep a copy of every file so Word Wheel works in airplane mode (copied from Claude Hearts).
   Change VERSION whenever any file changes, or installed phones keep the old copy.
   Every game on sghanna.github.io shares one cache store, so this only ever deletes its own old copies,
   and it refills its copy on the next online visit if another app's cleanup wiped it. */
const PREFIX = 'claude-word-wheel-';
const VERSION = PREFIX + 'v4';
const FILES = ['./', 'index.html', 'style.css', 'levels.js', 'i18n.js', 'fx.js', 'app.js', 'boot-check.js', 'manifest.json',
  'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function refill() {
  const cache = await caches.open(VERSION);
  for (const f of FILES) {
    if (!(await cache.match(f))) { try { await cache.add(f); } catch (e) { return; } }
  }
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok) {
        cache.put(e.request, res.clone());
        if (e.request.mode === 'navigate') e.waitUntil(refill());   // copy was missing: rebuild it
      }
      return res;
    } catch (err) {
      const page = e.request.mode === 'navigate' ? await cache.match('index.html') : null;
      if (page) return page;
      throw err;
    }
  })());
});
