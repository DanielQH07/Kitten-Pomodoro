// Giả lập chrome.* (storage + runtime) qua IPC để dùng lại nguyên content.js và popup.js của extension.
const { contextBridge, ipcRenderer } = require('electron');
const listeners = [];
ipcRenderer.on('state-changed', (_e, changes) => listeners.forEach((f) => f(changes)));
contextBridge.exposeInMainWorld('kittenChrome', {
  runtime: {
    id: 'shim', getURL: (p) => p,
    sendMessage: (m) => ipcRenderer.invoke('msg', m),
  },
  storage: {
    local: { get: () => ipcRenderer.invoke('state-get'), set: (o) => ipcRenderer.invoke('state-set', o) },
    onChanged: { addListener: (f) => listeners.push(f) },
  },
});
contextBridge.exposeInMainWorld('kittenDesktop', { setIgnore: (v) => ipcRenderer.send('ignore', v) });
