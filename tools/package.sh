#!/usr/bin/env bash
# Đóng gói vào dist/:
#   dist/kitten-pomodoro-extension.zip  (extension Chrome v1, sprite)
#   dist/kitten-pomodoro-web.zip        (bản điện thoại/PWA: kitten2 — giải nén rồi đưa lên hosting HTTPS)
#   dist/desktop/*.exe                  (bản laptop: cd desktop && npm run dist)
set -e
cd "$(dirname "$0")/.."
mkdir -p dist; rm -f dist/kitten-pomodoro-extension.zip dist/kitten-pomodoro-web.zip
(cd extension && /c/Windows/System32/tar.exe -a -c -f ../dist/kitten-pomodoro-extension.zip manifest.json background.js content.js popup.html popup.js icons sprites sounds)
(cd kitten2 && /c/Windows/System32/tar.exe -a -c -f ../dist/kitten-pomodoro-web.zip index.html engine.js sw.js manifest.webmanifest icon-192.png icon-512.png favicon.png assets clips sounds)
echo "OK: dist/kitten-pomodoro-extension.zip + dist/kitten-pomodoro-web.zip"
