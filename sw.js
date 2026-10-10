/* Mélèze — service worker minimal : l'app fonctionne hors-ligne en altitude.
   Stratégie : cache d'abord pour la coquille (fichiers statiques versionnés).
   Pensez à incrémenter VERSION à chaque déploiement. */
const VERSION = 'meleze-v2';
const SHELL = [
  './', './index.html', './dist/styles.css', './icon.svg', './manifest.webmanifest',
  './fonts/instrument-serif-latin-400-normal.woff2', './fonts/instrument-serif-latin-400-italic.woff2',
  './fonts/inter-latin-wght-normal.woff2',
  './js/data.js', './js/photos.js', './js/store.js', './js/ui.js', './js/app.js',
  './js/views/home.js', './js/views/catalogue.js', './js/views/wallet.js', './js/views/pro.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Photos : mises en cache au fil de la navigation pour ne pas les retélécharger
  if (url.hostname === 'images.unsplash.com') {
    e.respondWith(caches.open(VERSION + '-photos').then((c) => c.match(e.request).then((hit) => hit ||
      fetch(e.request).then((res) => { c.put(e.request, res.clone()); return res; }))));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
