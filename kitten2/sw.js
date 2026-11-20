// Service worker: cache toàn bộ (kể cả clip) để chạy offline; hỗ trợ Range cho <video>.
const V = 'kitten2-v1';
const SOUNDS = ['meow1', 'meow2', 'meow3', 'meow4', 'meow5', 'purr', 'scratch', 'hiss', 'chirp1', 'chirp2', 'trill1', 'trill2', 'thump', 'swish1', 'swish2', 'rustle1', 'rustle2', 'music'];
const CORE = ['./', 'index.html', 'engine.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'assets/feather.svg', 'clips/manifest.json'];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(V); await c.addAll(CORE);
    try {                                    // tải sẵn clip + âm thanh nền, lỗi lẻ tẻ không làm hỏng cài đặt
      const man = await (await fetch('clips/manifest.json')).json();
      const urls = [...Object.keys(man).map((id) => `clips/${id}.webm`),
        ...['belly_up', 'held', 'lie_side', 'sit_front', 'stand_right'].map((n) => `clips/pose_${n}.webp`),
        ...SOUNDS.map((n) => `sounds/${n}.mp3`)];
      await Promise.all(urls.map((u) => c.add(u).catch(() => {})));
    } catch (_) {}
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
  await self.clients.claim();
})()));
async function ranged(req, res) {
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') || ''); if (!m || !res.ok) return res;
  const buf = await res.arrayBuffer(), s = +m[1], e = m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(s, e + 1), { status: 206, headers: { 'Content-Type': res.headers.get('Content-Type') || 'video/webm', 'Content-Range': `bytes ${s}-${e}/${buf.byteLength}`, 'Content-Length': e - s + 1 } });
}
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(V);
    let res = await c.match(req, { ignoreSearch: true, ignoreVary: true });
    if (!res) {
      res = await fetch(req.headers.has('range') ? new Request(req.url) : req).catch(() => null);
      if (!res) return new Response('offline', { status: 503 });
      if (res.status === 200) c.put(req.url, res.clone());
    }
    return req.headers.has('range') ? ranged(req, res) : res;
  })());
});
