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
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});