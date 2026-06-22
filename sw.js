const CACHE_NAME = 'tritrack-v41';
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
  const req = e.request;
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  // HTML/navigasyon: AĞ-ÖNCELİKLİ → en güncel sürüm hemen gelir (eski önbellekte takılı kalmaz).
  // Çevrimdışıysa önbellekteki index.html'e düşer.
  if (isHTML) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Diğer (sürümlü ?v= asset'ler): önbellek-öncelikli, yoksa ağ.
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
