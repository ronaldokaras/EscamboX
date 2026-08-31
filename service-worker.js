'use strict';

// Cache – suba a versão (v2, v3…) sempre que mudar HTML/CSS/JS estáticos
const CACHE_NAME = 'escambox-v2';

// Recursos essenciais (app shell)
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

/**
 * Instalação: pré-cache do app shell
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) =>
                Promise.allSettled(urlsToCache.map((url) => cache.add(url)))
            )
            .then(() => self.skipWaiting())
    );
});

/**
 * Ativação: remove caches antigos
 */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

/**
 * Fetch: navegação network-first; estáticos stale-while-revalidate
 * Não cacheia Unsplash, Nominatim, Leaflet CDN etc.
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Só trata same-origin (app local)
    if (url.origin !== self.location.origin) {
        return;
    }

    // Navegação → rede primeiro, fallback index
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
                    }
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // CSS/JS/manifest → cache + revalidação em segundo plano
    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || network;
        })
    );
});