/* Service Worker — Do You Speak Chess? (PWA hors-ligne)
   Stratégie :
   - PAGE HTML (navigation)  → "réseau d'abord" : on récupère toujours la dernière
     version en ligne, et on retombe sur le cache uniquement hors-ligne.
     → Plus de page périmée après une mise à jour.
   - AUTRES RESSOURCES (polices, pièces, échiquiers, Stockfish, manifest)
     → "cache d'abord" : réponse instantanée, rafraîchies en arrière-plan.
   À chaque nouvelle version, augmenter le numéro de CACHE ci-dessous : les anciens
   caches sont alors supprimés automatiquement. */

const CACHE = 'dysc-v3';

// Ressources de base pré-mises en cache à l'installation
const CORE = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // active la nouvelle version sans attendre
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()) // prend le contrôle des onglets ouverts immédiatement
  );
});

// Permet à la page de forcer l'activation de la nouvelle version
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

  // ── AUTRES RESSOURCES : cache d'abord, réseau en repli + rafraîchissement ──
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
