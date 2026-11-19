// Service worker de Al Día.
// IMPORTANTE: cada publicación debe cambiar VERSION (publicar.ps1 lo hace solo).
// Al cambiar este archivo, el teléfono detecta la versión nueva y la app avisa "Hay una nueva versión".
const VERSION = 'v10';
const CACHE = 'al-dia-' + VERSION;
const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' }))))
  );
  // No se llama skipWaiting aquí: la app pregunta antes de actualizar.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('al-dia-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'VERSION' && e.source) e.source.postMessage({ version: VERSION });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Cache primero (la versión instalada es coherente); si no está, red.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => caches.match('./index.html')))
  );
});
