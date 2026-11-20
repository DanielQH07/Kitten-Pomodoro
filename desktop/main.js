// Kitten Pomodoro (desktop)
//  - Cửa sổ cài đặt: chỉ chỉnh giờ Pomodoro (kitten2/index.html?mode=panel), thu vào khay hệ thống khi đóng.
//  - Cửa sổ mèo: trong suốt, luôn nằm trên cùng, phủ cả màn hình, chuột xuyên qua (kitten2/index.html?mode=overlay).
//    Chỉ hiện trong giờ nghỉ; vẫn làm việc bình thường ở các cửa sổ khác.
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, protocol, net, screen, nativeImage } = require('electron');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');

const WWW = path.join(__dirname, 'www');
const ICON = path.join(WWW, 'icon-512.png');
let panel, overlay, tray, quitting = false, phase = 'idle', hideTimer;

protocol.registerSchemesAsPrivileged([{ scheme: 'kitten', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();

const fit = () => { if (overlay && !overlay.isDestroyed()) overlay.setBounds(screen.getPrimaryDisplay().workArea); };

function createOverlay() {
  overlay = new BrowserWindow({
    ...screen.getPrimaryDisplay().workArea, transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true, resizable: false,
    movable: false, hasShadow: false, focusable: false, show: false, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.webContents.on('render-process-gone', () => { if (!overlay.isDestroyed()) overlay.reload(); });
  overlay.loadURL('kitten://app/index.html?mode=overlay');
}

function createPanel(show = true) {
  panel = new BrowserWindow({
    width: 440, height: 720, minWidth: 380, minHeight: 560, show, title: 'Kitten Pomodoro', icon: ICON, backgroundColor: '#fff3ea',
    autoHideMenuBar: true, webPreferences: { backgroundThrottling: false, contextIsolation: true },
  });
  panel.setMenu(null);
  panel.webContents.on('console-message', (_e, level, msg) => {       // trang cài đặt báo pha qua console, không cần preload
    const m = /^K2PHASE (\w+)$/.exec(typeof level === 'object' ? level.message : msg);
    if (!m) return;
    const prev = phase; phase = m[1];
    if (phase === 'break' && prev !== 'break') startBreak();
    else if (prev === 'break' && phase !== 'break') endBreak();
    refreshTray();
  });
  panel.webContents.on('did-finish-load', () => panel.webContents.executeJavaScript("KS.on(s => console.log('K2PHASE ' + s.phase)); console.log('K2PHASE ' + KS.get().phase)"));
  panel.on('close', (e) => { if (!quitting) { e.preventDefault(); panel.hide(); } });
  panel.loadURL('kitten://app/index.html?mode=panel');
}

function startBreak() {
  clearTimeout(hideTimer); fit();
  overlay.setAlwaysOnTop(true, 'screen-saver'); overlay.setIgnoreMouseEvents(true, { forward: true }); overlay.showInactive();
  new Notification({ title: 'Hết giờ làm việc!', body: 'Mèo đang tới. Nghỉ ngơi một chút nhé.' }).show();
}
function endBreak() { clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (phase !== 'break' && overlay && !overlay.isDestroyed()) overlay.hide(); }, 9000); }   // chờ mèo đi ra khỏi màn hình

function run(js) { if (panel && !panel.isDestroyed()) panel.webContents.executeJavaScript(js); }
function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở cài đặt', click: () => { panel.show(); panel.focus(); } },
    { type: 'separator' },
    { label: phase === 'idle' ? 'Bắt đầu làm việc' : 'Dừng đếm giờ', click: () => run(phase === 'idle' ? "document.querySelector('#start').click()" : "document.querySelector('#stop').click()") },
    { label: 'Thử giờ nghỉ ngay', click: () => run("document.querySelector('#test').click()") },
    { label: 'Khởi động cùng Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { type: 'separator' },
    { label: 'Thoát', click: () => { quitting = true; app.quit(); } },
  ]));
}

app.whenReady().then(() => {
  protocol.handle('kitten', (req) => {
    const f = path.join(WWW, path.normalize(decodeURIComponent(new URL(req.url).pathname)));
    if (!f.startsWith(WWW) || !fs.existsSync(f)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(f).toString());
  });
  ipcMain.on('ignore', (e, v) => { if (overlay && !overlay.isDestroyed() && e.sender === overlay.webContents) overlay.setIgnoreMouseEvents(v, { forward: true }); });
  createOverlay(); createPanel(!app.getLoginItemSettings().wasOpenedAtLogin);
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 32, height: 32 }));
  tray.setToolTip('Kitten Pomodoro'); tray.on('click', () => { panel.show(); panel.focus(); }); refreshTray();
  for (const ev of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(ev, fit);
});
app.on('second-instance', () => { if (panel) { panel.show(); panel.focus(); } });
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { quitting = true; });
