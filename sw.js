/* ==============================================================================
   DBYC PWA SERVICE WORKER (Don Bosco Youth Centre - Basin Bridge, Chennai)
   High-Performance Offline App Shell & Smart Cache Engine
   ============================================================================== */

const CACHE_NAME = 'dbyc-portal-v2.2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo.png',
  './assets/don_bosco.webp',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/dbyc_seal.png',
  './assets/director_signature.png',
  './assets/id_bg_theme.jpg'
];

// 1. Install & Cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[DBYC SW] Optional asset cache warning:', asset, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// 2. Activate & Purge Stale Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[DBYC SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Strategy: Network-First for HTML/Navigation, Cache-First for Assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass Google Apps Script & external cloud APIs (always live network; never cache sensitive data)
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleusercontent.com') ||
    req.method !== 'GET'
  ) {
    return;
  }

  // Network-First with Offline Fallback for index.html / navigation
  if (
    req.mode === 'navigate' ||
    url.pathname.endsWith('index.html') ||
    url.pathname === '/' ||
    url.pathname === ''
  ) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const cachedIndex = await caches.match('./index.html') || await caches.match('index.html');
          if (cachedIndex) return cachedIndex;
          const rootCached = await caches.match('./');
          return rootCached || Response.error();
        })
    );
    return;
  }

  // Cache-First for static assets (images, icons, fonts)
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      if (cachedRes) {
        return cachedRes;
      }
      return fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => null);
    })
  );
});
