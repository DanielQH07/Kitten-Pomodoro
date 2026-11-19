// Copy tài nguyên dùng chung từ extension/ sang desktop/www/
const fs = require('fs'), path = require('path');
const ext = path.join(__dirname, '..', 'extension'), www = path.join(__dirname, 'www');
for (const d of ['sprites', 'sounds', 'icons']) {
  fs.rmSync(path.join(www, d), { recursive: true, force: true });
  fs.cpSync(path.join(ext, d), path.join(www, d), { recursive: true });
}
for (const f of ['content.js', 'popup.js']) fs.copyFileSync(path.join(ext, f), path.join(www, f));
const popup = fs.readFileSync(path.join(ext, 'popup.html'), 'utf8')
  .replace('<script src="popup.js">', '<script src="bridge.js"></script>\n<script src="popup.js">');
fs.writeFileSync(path.join(www, 'popup.html'), popup);
console.log('synced extension -> desktop/www');
