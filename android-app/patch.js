// Tinh chỉnh dự án Android sau `cap sync`: toàn màn hình, icon mèo, cho phát media không cần chạm
const fs = require('fs'), path = require('path');
const res = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
const styles = path.join(res, 'values', 'styles.xml');
let s = fs.readFileSync(styles, 'utf8');
if (!s.includes('windowFullscreen')) {
  s = s.replace(/(<style name="AppTheme.NoActionBarLaunch"[^>]*>)/, '$1').replace(/(<style name="AppTheme.NoActionBar"[^>]*>)/,
    '$1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>');
  fs.writeFileSync(styles, s);
}
const any = path.join(res, 'mipmap-anydpi-v26'); if (fs.existsSync(any)) fs.rmSync(any, { recursive: true, force: true });
const manifest = path.join(__dirname, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
let m = fs.readFileSync(manifest, 'utf8');
if (!m.includes('screenOrientation')) m = m.replace('<activity', '<activity\n            android:screenOrientation="fullUser"');
fs.writeFileSync(manifest, m);
console.log('patched android project');
