const VERSION = '1.1.2'; // UPDATE THIS VERSION IN app.js TOO!
const CACHE_NAME = `biodiversity-explorer-v${VERSION}`;
const API_CACHE_NAME = `biodiversity-api-v${VERSION}`;

// Track current location for cache management
let currentLocation = null;

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
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            const responseWithTimestamp = addTimestamp(responseClone);
            cache.put(request, responseWithTimestamp);
        }
        return networkResponse;
    } catch (error) {
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
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
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
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days for API responses

    return cacheAge > maxAge;
}

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        console.log('🧹 SW: Received CLEAR_CACHE message');
        event.waitUntil(
            caches.keys().then(cacheNames => {
                console.log('🗑️ SW: Clearing all caches:', cacheNames);
                const deletePromises = cacheNames.map(cacheName => {
                    console.log('🗑️ SW: Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                });
                return Promise.all(deletePromises);
            }).then(() => {
                console.log('✅ SW: All caches cleared successfully');
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ success: true });
                }
            }).catch(error => {
                console.error('❌ SW: Cache clearing failed:', error);
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ success: false, error: error.message });
                }
            })
        );
    } else if (event.data && event.data.type === 'CHECK_UPDATE') {
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
                version: VERSION,
                cacheNames: [CACHE_NAME, API_CACHE_NAME]
            });
        }
    } else if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('⏭️ SW: Received SKIP_WAITING, activating new version');
        self.skipWaiting();
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
        }
    } else if (event.data && event.data.type === 'LOCATION_CHANGED') {
        console.log('📍 SW: Location changed, updating cache strategy');
        const newLocationKey = event.data.locationKey;
        
        // No longer clear cache on location change - let it expire naturally after 7 days
        // This allows multiple locations to be cached simultaneously
        
        currentLocation = newLocationKey;
        console.log('📍 SW: Current location set to:', currentLocation);
    }
});

// Notify clients when service worker is updated
self.addEventListener('install', event => {
    console.log('🔧 SW: Installing version:', VERSION);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('📦 SW: Installation complete for version:', VERSION);
                // Don't skipWaiting here - wait for user decision
            })
    );
});

// Clean up old caches more thoroughly
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            // Delete ALL old caches that don't match current version
            const deletePromises = cacheNames.map(cacheName => {
                if (!cacheName.includes(VERSION)) {
                    console.log('🗑️ SW: Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                }
            });
            
            return Promise.all(deletePromises);
        }).then(() => {
            console.log('✅ SW: Cache cleanup complete, claiming clients');
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