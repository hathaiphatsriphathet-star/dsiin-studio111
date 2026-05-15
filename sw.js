// ===== DSIIN STUDIO SERVICE WORKER =====
// Cache-first สำหรับ fonts และ images
// Network-first สำหรับ HTML

const CACHE_NAME = 'dsiin-v4';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/shop.html',
  '/styles.css',
  '/script.js',
  '/รูปโปร/LOGO.png',
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ข้ามคำขอที่ไม่ใช่ GET
  if (request.method !== 'GET') return;

  // ข้าม Firebase / Google APIs
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) return;

  const isFontOrImage = /\.(ttf|woff|woff2|otf|png|jpg|jpeg|gif|webp|svg|PNG|JPG|JPEG)$/.test(url.pathname);
  const isCSS = /\.css$/.test(url.pathname);
  const isJS  = /\.js$/.test(url.pathname);
  const isHTML = request.headers.get('accept')?.includes('text/html');

  if (isFontOrImage) {
    // Cache-first สำหรับ font/image ที่ไม่เปลี่ยนบ่อย
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  if (isCSS || isJS) {
    // Network-first สำหรับ CSS/JS เพื่อให้รับ update ได้ทันที
    event.respondWith(
      fetch(request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  if (isHTML) {
    // Network-first สำหรับ HTML: ให้ content อัปเดตได้ตลอด
    event.respondWith(
      fetch(request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request))
    );
  }
});
