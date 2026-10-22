/**
 * CantiereSmart - Service Worker Offline-First & Notifiche Promemoria
 * Impresa Vittorini Emidio Costruzioni S.r.l.
 * 
 * Version: 1.1.0
 */

const CACHE_NAME = 'cantieresmart-v5';

// Asset statici principali da precachare
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './assets/logo-vittorini.js',
  './assets/template-assets.js',
  './assets/icons.js',
  './assets/icon-192.png',
  './assets/icon-192-maskable.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './js/lib/jspdf.umd.min.js',
  './js/lib/fflate.umd.min.js',
  './js/lib/docx.umd.js',
  './js/store.js',
  './js/auth.js',
  './js/autocomplete.js',
  './js/app.js',
  './js/notifications.js',
  './js/drawer.js',
  './js/init.js',
  './js/pdf-generator.js',
  './js/docx-generator.js',
  './js/word-generator.js'
];

// Installazione Service Worker: precache tollerante agli asset opzionali/progressivi
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Precache individuale per evitare fallimenti se alcuni moduli JS sono in fase di sviluppo
      const cachePromises = PRECACHE_ASSETS.map(async (url) => {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          if (response && response.ok) {
            await cache.put(url, response);
          }
        } catch (err) {
          // Ignora file non ancora presenti durante lo scaffolding
        }
      });
      await Promise.all(cachePromises);
      return self.skipWaiting();
    })
  );
});

// Attivazione Service Worker: pulizia cache obsolete
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Strategia di Fetch: Cache First con Network Fallback e Runtime Cache
self.addEventListener('fetch', (event) => {
  // Ignora richieste non GET o schemi non http/https (es. chrome-extension)
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Opzionale Stale-While-Revalidate in background per navigazioni
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Offline silenzioso
          });
        return cachedResponse;
      }

      // Risorsa non in cache: fetch di rete con salvataggio runtime
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Se la richiesta è di tipo navigation (HTML), mostra la pagina principale offline
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });
    })
  );
});

// Gestione Notifiche Push (Promemoria cantiere 11:55 e 16:55)
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'CantiereSmart - Vittorini', body: event.data.text() };
    }
  }

  const title = payload.title || 'CantiereSmart - Promemoria Rapportino';
  const options = {
    body: payload.body || 'È ora di compilare o completare il rapportino di cantiere di oggi!',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'vittorini-rapportino-reminder',
    renotify: true,
    data: {
      url: payload.url || './',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Apri Rapportino' },
      { action: 'later', title: 'Più tardi' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click sulla notifica: apre o porta in primo piano l'applicazione
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'later') {
    return;
  }

  const targetUrl = new URL(event.notification.data?.url || './', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Comunicazione con l'app (Client -> Service Worker)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const defaultOptions = {
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png',
      vibrate: [150, 80, 150],
      tag: 'vittorini-local-reminder',
      renotify: true,
      data: { url: './' }
    };
    self.registration.showNotification(
      title || 'CantiereSmart - Promemoria',
      Object.assign(defaultOptions, options || {})
    );
  }
});
