// Sao chép bản web kitten2/ (kèm clip + âm thanh) vào android-app/www/
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'kitten2'), dst = path.join(__dirname, 'www');
for (const need of ['clips/manifest.json', 'sounds/music.mp3']) if (!fs.existsSync(path.join(src, need))) { console.error('Thiếu kitten2/' + need); process.exit(1); }
fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(src, dst, { recursive: true });
console.log('synced kitten2 -> android-app/www');
