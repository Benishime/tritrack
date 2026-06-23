const CACHE_NAME = 'tritrack-v43';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './supabase.min.js',
  // ES modülleri (js/) — uygulama kodu app.js'ten buraya bölündü
  './js/main.js',
  './js/state.js',
  './js/cloud.js',
  './js/theme.js',
  './js/today.js',
  './js/program.js',
  './js/diet.js',
  './js/foods.js',
  './js/workout.js',
  './js/profile.js',
  './js/ai.js',
  './js/data.js',
  './js/importgpx.js',
  './js/strava.js',
  './js/analysis.js',
  './js/onboarding.js',
  './js/utils.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-1024.png',
  './assets/icon-maskable-512.png',
  './assets/screenshot-dashboard.png',
  './assets/screenshot-analysis.png'
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
