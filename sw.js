// Service Worker básico
const CACHE_NAME = 'escambox-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './js/utils.js',
  './js/data.js',
  './js/auth.js',
  './js/items.js',
  './js/trades.js',
  './js/profile.js',
  './js/admin.js',
  './js/chat.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
