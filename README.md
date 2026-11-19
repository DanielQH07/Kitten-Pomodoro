# Kitten Pomodoro (bản thử)

Mèo trắng đi dạo ở đáy mọi trang web; hết giờ làm thì mèo đi ra giữa, ngồi chặn màn hình, gừ gừ + kêu meo.

## Tài nguyên không nằm trong repo
`Video/`, `sounds/`, `extension/sounds/`, `images/` và các file `.exe`/`.zip` bị gitignore (nặng hoặc chưa rõ bản quyền).
- **Sprite mèo** (`extension/sprites/`) đã được build sẵn và có trong repo; chỉ cần `Video/` nếu muốn build lại bằng `tools/build_sprites.sh`.
- **Âm thanh:** tự thêm vào `extension/sounds/`: `purr.mp3` (gừ gừ lặp), `scratch.mp3` (khi bấm vào mèo), `meow1.mp3`..`meow4.mp3`. Thiếu thì app vẫn chạy nhưng im lặng.
- Sau khi sửa gì trong `extension/`, chạy `bash tools/package.sh` (bản web/PWA + zip) hoặc `cd desktop && npm run dist` (bản desktop) để đồng bộ.

## Bản Desktop (Windows) — mèo đi ngoài mọi cửa sổ
- Cài: chạy `dist/desktop/Kitten Pomodoro Setup 0.2.0.exe` (hoặc bản portable `Kitten Pomodoro 0.2.0.exe`, không cần cài).
- Mèo nằm trên cùng mọi cửa sổ, đi quanh viền vùng làm việc của màn hình chính, **chuột xuyên qua** (chỉ bấm được khi trỏ vào mèo).
- Biểu tượng khay hệ thống: mở bảng điều khiển, bắt đầu/dừng, thử chặn màn hình, ẩn/hiện mèo, khởi động cùng Windows, thoát.
- Chạy từ mã nguồn: `cd desktop && npm install && npm start`. Build lại: `npm run dist` (kết quả vào `dist/desktop/`).
- Windows SmartScreen có thể cảnh báo vì app chưa ký số; bấm "More info → Run anyway".
- Mới hỗ trợ màn hình chính (chưa phủ nhiều màn hình).

## Cài vào Chrome
1. Mở `chrome://extensions`, bật **Developer mode**.
2. **Load unpacked** → chọn thư mục `extension/`.
3. Bấm icon extension → **Thử mèo chặn màn hình** để xem ngay, hoặc **Bắt đầu làm việc** (mặc định 25 phút làm / 5 phút nghỉ).
4. Tab đang mở sẵn cần tải lại (F5) để mèo xuất hiện.

## Xem thử không cần cài
```
node tools/serve.js
```
Mở http://localhost:8765/tools/demo.html (thêm `?break` để xem chế độ chắn màn hình).

## Tạo lại sprite từ video
Cần ffmpeg. Đặt video nền xanh vào `Video/`, sửa danh sách ở cuối `tools/build_sprites.sh`, rồi:
```
bash tools/build_sprites.sh
```
Script xóa nền xanh (tách theo kênh G vượt R/B, hợp với lông trắng), cắt logo Gemini, xuất sprite sheet WebP trong suốt + JSON vào `extension/sprites/`.

## Hành vi
- Mèo đi vòng quanh **cả 4 cạnh màn hình** (đáy, phải, trên, trái, xoay theo cạnh); chỉ ngồi ở cạnh đáy.
- Thỉnh thoảng quay đầu và kêu meo (nhỏ, tối đa 1 lần/6 giây). Chạm vào mèo: meo to, và cào nếu có clip `scratch`.
- Âm thanh thật trong `extension/sounds/` (cắt từ `sounds/`): `purr.mp3` lặp liền mạch, `meow1-4.mp3`.

## Video cần tạo thêm
Xem `docs/gemini_prompts.md` (ảnh tham chiếu ở `references/`). Bỏ `cat_scratch.mp4` vào `Video/` rồi chạy build_sprites là mèo tự biết cào khi bị bấm.

## Còn thiếu
- Chưa có nhạc nền.
- Chưa có clip đứng dậy / quay đầu (đang lật ảnh và cắt cảnh).
- Clip đi bộ chưa lặp liền mạch tuyệt đối.
- Icon `extension/icon.png` đang là ảnh nền xanh.

