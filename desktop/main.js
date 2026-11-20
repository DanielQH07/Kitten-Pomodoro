// Kitten Pomodoro (desktop): 1 cửa sổ chạy bản web kitten2/, sống trong khay hệ thống.
// Hết giờ làm -> cửa sổ tự bật toàn màn hình, luôn nằm trên cùng để mèo chặn màn hình; hết giờ nghỉ -> thu lại.
const { app, BrowserWindow, Tray, Menu, Notification, protocol, net, nativeImage } = require('electron');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');

const WWW = path.join(__dirname, 'www');
const ICON = path.join(WWW, 'icon-512.png');
let win, tray, quitting = false, phase = 'idle';

protocol.registerSchemesAsPrivileged([{ scheme: 'kitten', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();

function setBreakMode(on) {
  if (!win || win.isDestroyed()) return;
  if (on) {
    win.show(); win.setAlwaysOnTop(true, 'screen-saver'); win.setFullScreen(true); win.focus();
    new Notification({ title: 'Hết giờ làm việc!', body: 'Mèo đang tới. Nghỉ ngơi một chút nhé.' }).show();
  } else {
    win.setFullScreen(false); win.setAlwaysOnTop(false);
    if (phase === 'work') win.hide();            // đang làm việc: thu vào khay cho khỏi vướng
  }
}

function createWindow(show = true) {
  win = new BrowserWindow({
    width: 1100, height: 740, minWidth: 360, minHeight: 520, show, title: 'Kitten Pomodoro', icon: ICON, backgroundColor: '#fff3ea',
    autoHideMenuBar: true,
    webPreferences: { autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false, contextIsolation: true },
  });
  win.setMenu(null);
  win.webContents.on('console-message', (_e, level, msg) => {       // trang báo pha qua console để không cần preload
    const m = /^K2PHASE (\w+)$/.exec(typeof level === 'object' ? level.message : msg);
    if (!m) return;
    const prev = phase; phase = m[1];
    if (phase === 'break' && prev !== 'break') setBreakMode(true);
    else if (prev === 'break' && phase !== 'break') setBreakMode(false);
    refreshTray();
  });
  win.webContents.on('did-finish-load', () => win.webContents.executeJavaScript(
    "KS.on(s => console.log('K2PHASE ' + s.phase)); console.log('K2PHASE ' + KS.get().phase)"));
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); if (win.isFullScreen()) win.setFullScreen(false); win.hide(); } });
  win.webContents.on('render-process-gone', () => { if (!win.isDestroyed()) win.reload(); });
  win.loadURL('kitten://app/index.html');
}

function run(js) { if (win && !win.isDestroyed()) win.webContents.executeJavaScript(js); }
function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở cửa sổ', click: () => { win.show(); win.focus(); } },
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
  createWindow(!app.getLoginItemSettings().wasOpenedAtLogin);
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 32, height: 32 }));
  tray.setToolTip('Kitten Pomodoro'); tray.on('click', () => { win.show(); win.focus(); }); refreshTray();
});
app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => { quitting = true; });
