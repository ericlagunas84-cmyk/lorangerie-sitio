/* ============================================================
   L'Orangerie — Service Worker
   Estrategia:
   - Archivos propios del sitio (HTML, manifest, íconos): cache-first,
     así carga instantáneo y funciona sin conexión.
   - Todo lo demás (Supabase, Google Sheets, fuentes, imágenes externas):
     network-first, para nunca mostrar precios o puntos desactualizados.
     Si no hay internet, usa la última copia guardada como respaldo.
   ============================================================ */

const CACHE_NAME = 'lorangerie-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // no interceptar POST/PUT (ej. llamadas a Supabase)

  const url = new URL(request.url);
  const isAppShell = url.origin === self.location.origin &&
    APP_SHELL.some((path) => url.pathname.endsWith(path.replace('./', '/')) || url.pathname === '/');

  if (isAppShell){
    // Cache-first: el sitio carga instantáneo desde caché y se actualiza en segundo plano
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  } else {
    // Network-first: precios, puntos y datos externos siempre intentan venir frescos
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request))
    );
  }
});
