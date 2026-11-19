// Cache toàn bộ app để chạy offline.
const CACHE = 'kitten-v3';
const FILES = ['./', 'index.html', 'shim.js', 'content.js', 'ui.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
  'sprites/walk.json', 'sprites/walk.webp', 'sprites/walk_sit.json', 'sprites/walk_sit.webp', 'sprites/scratch.json', 'sprites/scratch.webp', 'sprites/turn.json', 'sprites/turn.webp', 'sprites/standup.json', 'sprites/standup.webp', 'sprites/sleep.json', 'sprites/sleep.webp',
  'sounds/purr.mp3', 'sounds/scratch.mp3', 'sounds/meow1.mp3', 'sounds/meow2.mp3', 'sounds/meow3.mp3', 'sounds/meow4.mp3'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && e.request.method === 'GET') { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); }
    return res;
  })));
});
