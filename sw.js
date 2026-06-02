/* Service Worker — Do You Speak Chess? (PWA hors-ligne)
   Stratégie :
   - PAGE HTML (navigation)  → "réseau d'abord" : on récupère toujours la dernière
     version en ligne, et on retombe sur le cache uniquement hors-ligne.
   - AUTRES RESSOURCES (polices, pièces, échiquiers, Stockfish, manifest, CDN)
     → "cache d'abord" : réponse instantanée, et mise en cache au passage —
       y compris les réponses CDN cross-origin (type "opaque") pour garantir
       le jeu hors-ligne (moteur Stockfish, images de pièces, échiquiers).
   À chaque nouvelle version, augmenter le numéro de CACHE ci-dessous. */

const CACHE = 'dysc-v4';

const CORE = ['./', './index.html', './manifest.json'];

// Ressources externes utiles à précharger (best-effort)
const PRECACHE_OPTIONAL = [
  'https://cdn.jsdelivr.net/npm/stockfish@18.0.7/bin/stockfish-18-lite-single.js',
  'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE).catch(() => {});
    await Promise.all(PRECACHE_OPTIONAL.map(async (url) => {
      try {
        const res = await fetch(url, { mode: 'no-cors' });
        if (res) await c.put(url, res);
      } catch (e) { /* ignoré : sera mis en cache à l'usage */ }
    }));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

function isHtmlRequest(req) {
  return req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // ── PAGE HTML : réseau d'abord ──
  if (isHtmlRequest(req)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req)
            .then((c) => c || caches.match('./index.html'))
            .then((c) => c || caches.match('./'))
        )
    );
    return;
  }

  // ── AUTRES RESSOURCES : cache d'abord, réseau en repli + mise en cache ──
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Met en cache basic / cors / opaque (CDN cross-origin) → vital hors-ligne
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || Response.error());
    })
  );
});
