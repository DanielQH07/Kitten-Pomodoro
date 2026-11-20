// Server tĩnh nhỏ (có hỗ trợ Range cho video):  node tools/serve.js  ->  http://localhost:8765/kitten2/
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.css': 'text/css' };
http.createServer((q, r) => {
  let rel = decodeURIComponent(q.url.split('?')[0]); if (rel.endsWith('/')) rel += 'index.html';
  const f = path.join(root, rel);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end('404'); }
  const size = fs.statSync(f).size, type = types[path.extname(f)] || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
  r.setHeader('content-type', type); r.setHeader('accept-ranges', 'bytes'); r.setHeader('cache-control', 'no-cache');
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    r.writeHead(206, { 'content-range': `bytes ${a}-${b}/${size}`, 'content-length': b - a + 1 });
    fs.createReadStream(f, { start: a, end: b }).pipe(r);
  } else { r.setHeader('content-length', size); fs.createReadStream(f).pipe(r); }
}).listen(8765, () => console.log('http://localhost:8765/kitten2/'));
