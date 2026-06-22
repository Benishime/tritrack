const CACHE_NAME = 'tritrack-v33';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './foods.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png',
  './icon-maskable-512.png',
  './screenshot-dashboard.png',
  './screenshot-analysis.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => {
        // Fallback for offline if resources aren't cached
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
