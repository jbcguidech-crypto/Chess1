/* Service Worker minimal et SÛR pour "Do You Speak Chess?"
   But : rendre l'app installable (PWA) SANS le bug d'écran vide lié au cache obsolète.
   Stratégie : "réseau d'abord" — on sert toujours la dernière version en ligne quand le
   réseau est disponible, et on ne tombe sur le cache QUE si l'utilisateur est hors-ligne. */

const CACHE = 'dysc-v1';

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const fallback = await caches.match('./index.html') || await caches.match('./');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
