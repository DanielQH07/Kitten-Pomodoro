// Gán cầu nối preload thành window.chrome (Chromium đã có sẵn window.chrome nên phải ghi đè)
Object.defineProperty(window, 'chrome', { value: window.kittenChrome, configurable: true, writable: true });
window.__kittenAutoplay = true;   // Electron cho phát tiếng không cần bấm trước
