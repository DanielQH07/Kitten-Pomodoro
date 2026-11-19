#!/usr/bin/env bash
# Đóng gói: đồng bộ file dùng chung sang app/ và tạo zip extension trong dist/
set -e
cd "$(dirname "$0")/.."
rm -rf app/sprites app/sounds
cp extension/content.js app/content.js
cp -r extension/sprites app/sprites
cp -r extension/sounds app/sounds
mkdir -p dist; rm -f dist/kitten-pomodoro-extension.zip
(cd extension && tar -a -c -f ../dist/kitten-pomodoro-extension.zip manifest.json background.js content.js popup.html popup.js icons sprites sounds)
echo "OK: dist/kitten-pomodoro-extension.zip  +  app/ (PWA) đã đồng bộ"
