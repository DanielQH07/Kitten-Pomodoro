// Cầu nối an toàn: trang mèo báo cho tiến trình chính biết lúc nào cửa sổ trong suốt cần bắt chuột
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kittenNative', { setIgnore: (v) => ipcRenderer.send('ignore', !!v) });
