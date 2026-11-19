const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, protocol, net, screen, nativeImage } = require('electron');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');

const WWW = path.join(__dirname, 'www');
const DEFAULTS = { phase: 'idle', endsAt: 0, workMin: 25, breakMin: 5, catOn: true, volume: 0.5 };
let state = { ...DEFAULTS }, overlay, panel, tray, timer;
const stateFile = () => path.join(app.getPath('userData'), 'state.json');

protocol.registerSchemesAsPrivileged([{ scheme: 'kitten', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();

function load() { try { state = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(stateFile(), 'utf8')) }; } catch (e) {} }
function broadcast(changes) {
  for (const w of [overlay, panel]) if (w && !w.isDestroyed()) w.webContents.send('state-changed', changes);
}

function setState(obj) {
  const changes = {};
  for (const k in obj) {
    if (state[k] !== obj[k]) changes[k] = { oldValue: state[k], newValue: obj[k] };
    state[k] = obj[k];
  }
  if (!Object.keys(changes).length) return;
  try { fs.writeFileSync(stateFile(), JSON.stringify(state)); } catch (e) {}
  broadcast(changes); schedule(); refreshTray();
}

function startPhase(phase) {
  const min = phase === 'work' ? state.workMin : state.breakMin;
  setState({ phase, endsAt: Date.now() + min * 60000 });
}
function schedule() {
  clearTimeout(timer);
  if (state.phase === 'idle') return;
  timer = setTimeout(() => {
    if (state.phase === 'work') {
      new Notification({ title: 'Hết giờ làm việc!', body: 'Mèo đang tới. Nghỉ ngơi một chút nhé.' }).show();
      startPhase('break');
    } else startPhase('work');
  }, Math.max(0, state.endsAt - Date.now()));
}

function handleMsg(m) {
  if (m.type === 'start' || m.type === 'skip-break') startPhase('work');
  else if (m.type === 'stop') setState({ phase: 'idle', endsAt: 0 });
  else if (m.type === 'test-break') startPhase('break');
  return { ok: true };
}

function createOverlay() {
  const d = { bounds: screen.getPrimaryDisplay().workArea };
  overlay = new BrowserWindow({
    ...d.bounds, transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true, resizable: false,
    movable: false, hasShadow: false, focusable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  // Overlay tự tải lại nếu renderer bị crash
  overlay.webContents.on('render-process-gone', (_e, d) => {
    if (d.reason !== 'clean-exit' && !overlay.isDestroyed()) overlay.reload();
  });
  overlay.loadURL('kitten://app/overlay.html');
  overlay.once('ready-to-show', () => overlay.showInactive());
}
function fitOverlay() { if (overlay && !overlay.isDestroyed()) overlay.setBounds(screen.getPrimaryDisplay().workArea); }

function showPanel() {
  if (panel && !panel.isDestroyed()) { panel.show(); panel.focus(); return; }
  panel = new BrowserWindow({
    width: 300, height: 450, useContentSize: true, resizable: false, autoHideMenuBar: true, title: 'Kitten Pomodoro', backgroundColor: '#fff8f3',
    icon: path.join(WWW, 'icons', 'icon256.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  panel.loadURL('kitten://app/popup.html');
  panel.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); panel.hide(); } });
}

function refreshTray() {
  if (!tray) return;
  const working = state.phase !== 'idle';
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở bảng điều khiển', click: showPanel },
    { type: 'separator' },
    { label: working ? 'Dừng đếm giờ' : 'Bắt đầu làm việc', click: () => handleMsg({ type: working ? 'stop' : 'start' }) },
    { label: 'Thử mèo chặn màn hình', click: () => handleMsg({ type: 'test-break' }) },
    { label: 'Hiện mèo', type: 'checkbox', checked: state.catOn !== false, click: (i) => setState({ catOn: i.checked }) },
    { label: 'Khởi động cùng Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { type: 'separator' },
    { label: 'Thoát', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

app.whenReady().then(() => {
  protocol.handle('kitten', (req) => {
    const p = path.normalize(decodeURIComponent(new URL(req.url).pathname));
    const f = path.join(WWW, p);
    if (!f.startsWith(WWW) || !fs.existsSync(f)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(f).toString());
  });
  load(); schedule();
  ipcMain.handle('state-get', () => ({ ...state }));
  ipcMain.handle('state-set', (_e, o) => setState(o));
  ipcMain.handle('msg', (_e, m) => handleMsg(m));
  ipcMain.on('ignore', (_e, v) => {
    if (!overlay || overlay.isDestroyed()) return;
    overlay.setIgnoreMouseEvents(v, { forward: true });
    overlay.setFocusable(!v && state.phase === 'break');
  });

  createOverlay();
  tray = new Tray(nativeImage.createFromPath(path.join(WWW, 'icons', 'icon48.png')));
  tray.setToolTip('Kitten Pomodoro');
  tray.on('click', showPanel);
  refreshTray();
  screen.on('display-metrics-changed', fitOverlay);
  screen.on('display-added', fitOverlay);
  screen.on('display-removed', fitOverlay);
  if (!app.getLoginItemSettings().wasOpenedAtLogin) showPanel();
});
app.on('second-instance', showPanel);
app.on('window-all-closed', (e) => e.preventDefault());   // sống trong khay hệ thống
