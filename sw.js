// swimrun — service worker
const CACHE = 'swimrun-v6';
const SHELL = [
  './','./index.html','./swim.html','./run.html','./position.html','./endurance.html',
  './manifest.webmanifest','./favicon.svg','./icon-192.png','./icon-512.png','./apple-touch-icon.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))) // un fichier manquant ne casse plus l'install
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached)
    )
  );
});
