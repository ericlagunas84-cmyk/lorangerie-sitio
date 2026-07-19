/* ============================================================
   L'Orangerie — Service Worker
   Estrategia:
   - Archivos propios del sitio (HTML, manifest, íconos): cache-first,
     así carga instantáneo y funciona sin conexión.
   - Todo lo demás (Supabase, Google Sheets, fuentes, imágenes externas):
     network-first, para nunca mostrar precios o puntos desactualizados.
     Si no hay internet, usa la última copia guardada como respaldo.
   ============================================================ */

/* ============================================================
   L'Orangerie — Service Worker
   Estrategia:
   - El HTML del sitio (index.html): network-first — SIEMPRE intenta
     traer la versión más nueva primero. Solo usa la copia guardada
     si no hay internet. Así cada actualización se ve de inmediato,
     sin necesitar recargar dos veces.
   - Íconos y manifest (rara vez cambian): cache-first, para velocidad.
   - Todo lo demás (Supabase, Google Sheets, fuentes, imágenes externas):
     network-first, para nunca mostrar precios o puntos desactualizados.
   ============================================================ */

const CACHE_NAME = 'lorangerie-v2';

const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

const HTML_PATHS = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...HTML_PATHS, ...STATIC_ASSETS]))
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
  const isHTML = request.mode === 'navigate' ||
    (url.origin === self.location.origin &&
     HTML_PATHS.some((path) => url.pathname.endsWith(path.replace('./', '/')) || url.pathname === '/'));

  const isStaticAsset = url.origin === self.location.origin &&
    STATIC_ASSETS.some((path) => url.pathname.endsWith(path.replace('./', '/')));

  if (isHTML){
    // Network-first: el sitio siempre intenta traer la versión más nueva.
    // Si no hay internet, usa la última copia guardada como respaldo.
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request))
    );
  } else if (isStaticAsset){
    // Cache-first: íconos y manifest casi nunca cambian, priorizamos velocidad
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
