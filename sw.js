/* ============================================================
   sw.js — Service Worker · Vigilancia Rentadores
   Estrategia: Network First
   - Siempre intenta la red primero
   - Cachea solo assets estáticos (HTML, JS libs, imágenes)
   - NUNCA cachea: graph.microsoft.com, login.microsoftonline.com
   ============================================================ */

const CACHE_NAME = 'vigilancia-v1';

// URLs que NUNCA se cachean (autenticación y datos en vivo)
const NEVER_CACHE = [
  'graph.microsoft.com',
  'login.microsoftonline.com',
  'login.microsoft.com',
  'microsoftonline.com',
  'sharepoint.com'
];

// Assets estáticos que sí se cachean para uso offline básico
const STATIC_ASSETS = [
  '/vigilancia/',
  '/vigilancia/index.html',
  '/vigilancia/manifest.json',
  '/vigilancia/icon-192.png',
  '/vigilancia/icon-512.png',
  '/vigilancia/logo.jpg',
  '/vigilancia/recorrido.jpg',
  '/vigilancia/vehicular.jpg',
  '/vigilancia/asistencia.jpg',
  '/vigilancia/visitantes.jpg'
];

// ── Install: pre-cachear assets estáticos ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Algunos assets no se pudieron cachear:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: limpiar caches viejos ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Network First ────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Ignorar peticiones no-GET
  if (event.request.method !== 'GET') return;

  // NUNCA interceptar autenticación ni APIs de SharePoint
  if (NEVER_CACHE.some(domain => url.includes(domain))) return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Si la red responde OK, actualizar cache y devolver
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Sin red: intentar desde cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback final: devolver index.html cacheado
          return caches.match('/vigilancia/index.html');
        });
      })
  );
});
