// InstruMed Service Worker v4
// Estratégia: Cache First para assets estáticos, Network First para imagens externas

const CACHE_NAME = 'instromed-v4';
const WIKI_CACHE = 'instromed-wiki-v4';

// App shell — arquivos essenciais para funcionar offline
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== WIKI_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Wikimedia images: cache-first, mas aceita network quando disponível
  if (url.includes('commons.wikimedia.org') || url.includes('upload.wikimedia.org')) {
    e.respondWith(
      caches.open(WIKI_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request)
            .then(res => {
              if (res && res.status === 200) cache.put(e.request, res.clone());
              return res;
            })
            .catch(() => cached || new Response('', { status: 404 }));
        })
      )
    );
    return;
  }

  // Google Fonts: stale-while-revalidate
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const network = fetch(e.request).then(res => {
            cache.put(e.request, res.clone());
            return res;
          });
          return cached || network;
        })
      )
    );
    return;
  }

  // App shell + fotos locais (img/): cache-first
  if (url.includes(self.location.origin) || url.startsWith('file://')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }
});

// ── MESSAGE: força atualização ────────────────────────────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
