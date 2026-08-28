'use strict';

// Nome do cache (altere a versão quando houver mudanças nos arquivos estáticos)
const CACHE_NAME = 'escambox-v1';

// Recursos essenciais para funcionamento offline
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
 * Instala o service worker e pré-carrega recursos essenciais.
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // Usa allSettled para que uma falha em um recurso não impeça a instalação
                return Promise.allSettled(
                    urlsToCache.map(url => cache.add(url))
                );
            })
            .then(() => self.skipWaiting())
    );
});

/**
 * Ativa o service worker e remove caches antigos.
 */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

/**
 * Intercepta requisições e aplica estratégias de cache.
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Ignora requisições que não sejam GET
    if (request.method !== 'GET') {
        return;
    }

    // Navegação: network-first com fallback para index.html em cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Atualiza o cache do index.html
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Para recursos estáticos (css, js, manifest, imagens locais)
    // Estratégia: stale-while-revalidate
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request)
                .then((response) => {
                    // Só armazena respostas válidas e do mesmo domínio
                    if (response && response.status === 200 && response.type === 'basic') {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached); // Se falhar, usa o cache (mesmo que antigo)

            // Retorna cache imediatamente, e atualiza em segundo plano
            return cached || fetchPromise;
        })
    );
});