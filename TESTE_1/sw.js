/* Service Worker — app shell offline para o Hack da Torre de Copos */
const VERSION = '1.0.4';
const CACHE = 'torre-copos-' + VERSION;
const OFFLINE_URL = './index.html';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/audio.js',
  './js/game.js',
  './js/papercraft.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg',
  './icons/favicon.ico',
  './icons/favicon-32.png',
  './papercrafts/estandarte.svg',
  './papercrafts/estandarte.pdf',
  './papercrafts/preview-estandarte.png',
  './papercrafts/mascara.svg',
  './papercrafts/mascara.pdf',
  './papercrafts/preview-mascara.png',
  './papercrafts/trofeu.svg',
  './papercrafts/trofeu.pdf',
  './papercrafts/preview-trofeu.png',
  './screenshots/home-390x844.png',
  './screenshots/jogo-390x844.png',
  './screenshots/resultado-390x844.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map((url) => cache.add(url).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('torre-copos-') && key !== CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(OFFLINE_URL, fresh.clone());
        return fresh;
      } catch (error) {
        return (await caches.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  })());
});
