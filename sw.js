const VERSION = '1.0.3'; // UPDATE THIS VERSION IN app.js TOO!
const CACHE_NAME = `biodiversity-explorer-v${VERSION}`;
const API_CACHE_NAME = `biodiversity-api-v${VERSION}`;

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/main.css',
    './css/mobile.css',
    './js/app.js',
    './js/api.js',
    './js/location.js',
    './js/species.js',
    './js/i18n.js',
    './assets/icons.svg',
    './lang/en.json',
    './lang/es.json',
    './lang/fr.json',
    './lang/de.json'
];

const API_ENDPOINTS = [
    'https://api.inaturalist.org/v1/',
    'https://static.inaturalist.org/'
];


self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (isAPIRequest(url)) {
        event.respondWith(handleAPIRequest(request));
    } else if (isStaticAsset(request)) {
        event.respondWith(handleStaticAsset(request));
    } else {
        event.respondWith(handleNavigation(request));
    }
});

function isAPIRequest(url) {
    return API_ENDPOINTS.some(endpoint => url.href.startsWith(endpoint));
}

function isStaticAsset(request) {
    return request.method === 'GET' &&
        (request.url.includes('.js') ||
            request.url.includes('.css') ||
            request.url.includes('.svg') ||
            request.url.includes('.json') ||
            request.url.includes('.png'));
}

async function handleAPIRequest(request) {
    const cache = await caches.open(API_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !isStale(cachedResponse)) {
        console.log('Serving API from cache:', request.url);
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            const responseWithTimestamp = addTimestamp(responseClone);
            cache.put(request, responseWithTimestamp);
            console.log('Cached API response:', request.url);
        }
        return networkResponse;
    } catch (error) {
        console.log('Network failed, serving stale cache:', request.url);
        if (cachedResponse) {
            return cachedResponse;
        }
        return new Response('Network error and no cached data available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

async function handleStaticAsset(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        console.log('Serving static asset from cache:', request.url);
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
            console.log('Cached static asset:', request.url);
        }
        return networkResponse;
    } catch (error) {
        console.log('Failed to fetch static asset:', request.url);
        return new Response('Asset not available', {
            status: 404,
            statusText: 'Not Found'
        });
    }
}

async function handleNavigation(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        console.log('Network failed for navigation, serving index.html');
        const cachedResponse = await cache.match('./index.html');
        return cachedResponse || new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

function addTimestamp(response) {
    const headers = new Headers(response.headers);
    headers.set('sw-cached-at', Date.now().toString());

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
    });
}

function isStale(response) {
    const cachedAt = response.headers.get('sw-cached-at');
    if (!cachedAt) return false;

    const cacheAge = Date.now() - parseInt(cachedAt);
    const maxAge = 10 * 60 * 1000; // 10 minutes for API responses

    return cacheAge > maxAge;
}

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }).then(() => {
                event.ports[0].postMessage({ success: true });
            })
        );
    } else if (event.data && event.data.type === 'CHECK_UPDATE') {
        event.ports[0].postMessage({
            version: VERSION,
            cacheNames: [CACHE_NAME, API_CACHE_NAME]
        });
    } else if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
        }
    }
});

// Notify clients when service worker is updated
self.addEventListener('install', event => {
    console.log(`Service Worker v${VERSION} installing...`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Notify all clients about the update
                return self.clients.matchAll();
            })
            .then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATE_AVAILABLE',
                        version: VERSION
                    });
                });
                // Don't auto-skipWaiting - let user decide when to update
            })
    );
});

// Clean up old caches more thoroughly
self.addEventListener('activate', event => {
    console.log(`Service Worker v${VERSION} activating...`);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheName.includes(VERSION)) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Notify all clients that update is complete
            return self.clients.matchAll();
        }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_UPDATE_COMPLETE',
                    version: VERSION
                });
            });
            return self.clients.claim();
        })
    );
});