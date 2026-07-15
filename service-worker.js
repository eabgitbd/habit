// Habit Garden Service Worker
const CACHE_NAME = 'habit-garden-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './bengali-fonts.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    if (url.hostname.includes('cdn') || url.hostname.includes('gstatic') || url.hostname.includes('google')) {
      event.respondWith(
        fetch(event.request).catch(() => {
          return caches.match(event.request);
        })
      );
    }
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => {
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Offline</title>' +
          '<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;' +
          'height:100vh;margin:0;background:#F6F3EA;color:#2D3A2E;text-align:center;}' +
          '.box{padding:40px;}h1{font-size:24px;margin-bottom:16px;}p{font-size:16px;color:#5C6B5E;}</style>' +
          '</head><body><div class="box"><h1>Habit Garden</h1>' +
          '<p>You are offline. Please check your internet connection.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      });
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-habit-data') {
    event.waitUntil(syncHabitData());
  }
});

async function syncHabitData() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
}

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Habit Garden', {
      body: data.body || 'Time to check your habits!',
      icon: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f33f.svg',
      badge: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/1f33f.svg',
      tag: 'habit-reminder',
      requireInteraction: false
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('./')
  );
});