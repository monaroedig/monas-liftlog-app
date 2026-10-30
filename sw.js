// Lift Log service worker. Bump VERSION on every release so phones pick up the update.
const VERSION = 'liftlog-1.0.6';
const FONTS = 'liftlog-fonts';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (err) { return Response.error(); }
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Network first so a newly published version shows up right away; saved copy when offline.
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await Promise.race([
          fetch(req.url, {cache: 'no-store', credentials: 'same-origin'}),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await cache.match('./index.html')) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req)));
});
