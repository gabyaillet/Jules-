/* Mélèze — service worker minimal : l'app fonctionne hors-ligne en altitude.
   Stratégie : cache d'abord pour la coquille (fichiers statiques versionnés).
   Pensez à incrémenter VERSION à chaque déploiement. */
const VERSION = 'meleze-v1';
const SHELL = [
  './', './index.html', './dist/styles.css', './icon.svg', './manifest.webmanifest',
  './js/data.js', './js/store.js', './js/ui.js', './js/app.js',
  './js/views/home.js', './js/views/catalogue.js', './js/views/wallet.js', './js/views/pro.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
