/* Mélèze — service worker minimal : l'app fonctionne hors-ligne en altitude.
   Stratégie : réseau d'abord pour les fichiers du site (on voit toujours la
   dernière version quand il y a du réseau), cache en secours hors connexion.
   Les photos, elles, viennent du cache d'abord (elles ne changent pas).
   Le serveur (Supabase : base, connexion, vérification des photos) n'est
   JAMAIS intercepté ni mis en cache : seules les requêtes GET du site lui-même
   (et les photos Unsplash) passent par ici. La copie hors connexion des
   missions et des bons est gérée par js/store.js. */
const VERSION = 'meleze-v21';
const SHELL = [
  './', './index.html', './dist/styles.css', './icon.svg', './manifest.webmanifest',
  './fonts/bricolage-grotesque-latin-wght-normal.woff2', './fonts/source-sans-3-latin-wght-normal.woff2',
  './img/sentiers.webp', './img/covoiturage.webp', './img/marche.webp',
  './js/data.js', './js/photos.js', './js/config.js', './js/vendor/supabase.min.js', './js/api.js',
  './js/store.js', './js/ui.js', './js/camera.js', './js/app.js',
  './js/views/home.js', './js/views/catalogue.js', './js/views/wallet.js', './js/views/pro.js',
  './js/views/legal.js',
];
/** Chemins d'API (Supabase, ou un proxy sur le même domaine) : jamais en cache. */
const API_PATH = /\/(rest|auth|functions|storage|realtime)\/v1\//;

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
  // Envois (POST : inscription, vérification de photo…) : toujours au réseau, jamais en cache.
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Serveur de l'application (*.supabase.co ou proxy) : laissé au navigateur.
  if (/\.supabase\.(co|in)$/.test(url.hostname) || API_PATH.test(url.pathname)) return;
  // Photos : mises en cache au fil de la navigation pour ne pas les retélécharger
  if (url.hostname === 'images.unsplash.com') {
    e.respondWith(caches.open(VERSION + '-photos').then((c) => c.match(e.request).then((hit) => hit ||
      fetch(e.request).then((res) => { c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Vidéos : chargées par morceaux (requêtes Range, réponses 206) → laissées au navigateur,
  // jamais mises en cache (trop lourdes et non stockables par morceaux).
  if (e.request.headers.has('range') || e.request.destination === 'video' || /\.(webm|mp4)$/.test(url.pathname)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
