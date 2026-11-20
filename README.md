# 🐱 Kitten Pomodoro

Đồng hồ Pomodoro có một chú mèo trắng lông dài. Làm việc 25 phút, đến **5 phút nghỉ** thì mèo xuất hiện trên màn hình để bạn xoa đầu, câu bằng lông vũ, cho ăn bánh. Hết giờ nghỉ mèo tự đi ra.

Có 3 bản dùng chung một engine (`kitten2/`): **laptop Windows (exe)**, **Android (APK)** và **web/PWA**.

> Chỉ mèo hiện trong giờ nghỉ. Giờ làm việc app chỉ là đồng hồ, không có mèo.

---

## Cách chơi (giống nhau ở mọi bản)

Trong giờ nghỉ sẽ có nút nổi **🐾** (có đồng hồ đếm ngược nhỏ). Chạm vào để mở menu:

| Nút | Làm gì |
|---|---|
| 🖐 **Bàn tay** | Vuốt trên đầu mèo để xoa (mèo gật đầu, gừ gừ). Chạm đuôi: mèo cào. Chạm thân: mèo kêu. Giữ và kéo thân để xách mèo lên, thả ra mèo rơi xuống. |
| 🪶 **Cần câu** | Di chuyển cần câu, mèo quay theo, vồ, với lên. Nhấn chuột (hoặc chạm) để giật lông, mèo dễ vồ hơn. |
| 🐟 **Thả bánh** | Thả một miếng cá trước mặt mèo, mèo đi tới ăn (3 cái mỗi giờ nghỉ). |

- **Chuột phải** (laptop): quay về bàn tay.
- **Kéo nút 🐾** để đổi vị trí; nó tự dính vào mép trái/phải và mờ đi khi không dùng.
- Mèo thỉnh thoảng nhảy lên nửa trên màn hình, nằm ngủ, đuổi theo đồ chơi.
- **Độ thân thiết:** xoa đầu +1, ăn bánh +2, vồ trúng lông +3. Xem thanh Lv ở cửa sổ cài đặt (mục "Cách tăng điểm").

---

## 💻 Bản laptop (Windows)

**Cài đặt**
1. Lấy file trong `dist/desktop/`:
   - `Kitten Pomodoro Setup 0.5.0.exe`: bản cài, có lối tắt trên Desktop.
   - `Kitten Pomodoro 0.5.0.exe`: bản portable, bấm là chạy.
2. Nếu Windows báo *"Windows protected your PC"* (app chưa ký số): bấm **More info → Run anyway**.

**Sử dụng**
1. Mở app → cửa sổ cài đặt hiện ra. Chỉnh số phút **Làm** / **Nghỉ**, âm lượng, bật/tắt nhạc nền.
2. Bấm **Bắt đầu làm việc**. Bạn có thể đóng cửa sổ: app thu vào **khay hệ thống** (cạnh đồng hồ Windows) và vẫn đếm giờ.
3. Hết giờ làm: một cửa sổ **trong suốt phủ toàn màn hình** hiện ra, mèo đi lại *đè lên* ứng dụng bạn đang dùng. Bạn **vẫn làm việc bình thường** ở các cửa sổ khác, chuột xuyên qua và chỉ "bắt" khi trỏ vào mèo hoặc nút 🐾.
4. Khi chọn **Cần câu**, cửa sổ mèo bắt chuột toàn màn hình; chuột phải để về bàn tay rồi làm việc tiếp.
5. Hết 5 phút, mèo tự đi ra và cửa sổ mèo ẩn đi.

**Menu khay hệ thống** (chuột phải vào icon 🐱): mở cài đặt, bắt đầu/dừng đếm giờ, *Thử giờ nghỉ ngay* (xem mèo liền), khởi động cùng Windows, thoát.

Mẹo: bấm **Thử giờ nghỉ ngay** để xem mèo mà không phải chờ 25 phút.

---

## 📱 Bản Android

**Cài đặt**
1. Chép `dist/Kitten-Pomodoro.apk` sang điện thoại (Zalo, Google Drive, cáp USB…).
2. Mở file APK. Nếu máy hỏi, cho phép **Cài đặt từ nguồn không xác định** cho ứng dụng đang dùng để mở file.
3. Mở **Kitten Pomodoro** từ màn hình chính. App chạy toàn màn hình, **không cần mạng**.

> APK này là bản debug ký tạm, dùng để thử trên máy của bạn. Muốn đăng Google Play thì cần build bản release có khóa ký riêng.

**Sử dụng**
1. Chỉnh phút Làm / Nghỉ rồi bấm **Bắt đầu làm việc**. Đừng thoát app hẳn (để app chạy nền) để đếm giờ không bị ngắt.
2. Hết giờ làm, mèo hiện trên màn hình app. Chạm nút 🐾 để chọn Bàn tay / Cần câu / Thả bánh.
3. Xoa đầu: vuốt ngón tay qua đầu mèo. Xách mèo: giữ và kéo thân.
4. Âm thanh dùng nút âm lượng của điện thoại.
5. Xoay ngang được: thanh công cụ tự thu gọn.

**Giới hạn:** mèo chỉ hiện *trong app*, không hiện đè lên ứng dụng khác như bản laptop (Android cần quyền "hiển thị trên ứng dụng khác" và một service riêng, chưa làm).

**Cài thẳng từ web (không cần APK):** đưa `dist/kitten-pomodoro-web.zip` (giải nén) lên hosting HTTPS như Netlify (kéo thả thư mục), mở link bằng Chrome Android → ⋮ → *Thêm vào màn hình chính*. Khi deploy lại, tăng số trong `const V = 'kitten2-vN'` ở `kitten2/sw.js` để điện thoại nhận bản mới.

---

## 🌐 Chạy thử trên máy (web)

```
node tools/serve.js
```
Mở http://localhost:8765/kitten2/ (thêm `?break` để vào thẳng giờ nghỉ). Trên điện thoại cùng Wi-Fi: `http://<IP máy>:8765/kitten2/`.

---

## Tài nguyên không nằm trong repo
`Video/`, `sounds/`, `images/`, `kitten2/clips/`, `kitten2/sounds/`, `dist/`, và các file `.exe`/`.zip`/`.apk` bị gitignore (nặng hoặc chưa rõ bản quyền). Muốn build lại cần có sẵn trên máy:
- `kitten2/clips/`: 36 clip WebM mèo đã tách nền, sinh bằng `python tools/build_clips.py <thư mục video> kitten2/clips` (cần Python + `pip install numpy pillow` + ffmpeg).
- `kitten2/sounds/`: âm thanh đã xử lý, sinh bằng `python tools/build_sounds.py` từ thư mục `sounds/`.

## Tự build các bản
Cần Node.js; Android cần thêm JDK 17 và Android SDK (platform 34).

| Bản | Lệnh | Kết quả |
|---|---|---|
| Laptop | `cd desktop && npm install && npm run dist` | `dist/desktop/*.exe` |
| Chạy thử desktop | `cd desktop && npm start` | |
| Android | `cd android-app && npm install && npm run build`, rồi chép `android/app/build/outputs/apk/debug/app-debug.apk` | APK |
| Web (zip) | `bash tools/package.sh` | `dist/kitten-pomodoro-web.zip` |
| Icon từ logo | `python tools/make_icons.py` rồi `python android-app/icons.py` | |

Mã nguồn chính: `kitten2/engine.js` (mèo, đồ chơi, âm thanh), `kitten2/index.html` (giao diện), `desktop/main.js` (cửa sổ cài đặt + cửa sổ mèo trong suốt), `android-app/` (vỏ Capacitor).

## Tạo thêm clip mèo bằng AI
Xem `video_gen/README.md` (notebook Colab chạy MiniMax H3) và `docs/KITTEN2_PLAN.md`.

## Bản Chrome extension (v1, cũ)
Thư mục `extension/` là bản cũ dùng sprite: mèo đi quanh viền trang web. Cài: `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn `extension/`. Bản này chưa dùng engine mới.

## Ghi nguồn
Nhạc nền: Lukrembo – *Bread* (freetouse.com). Lông vũ: Twemoji (CC-BY 4.0). Cần kiểm tra bản quyền các tiếng mèo kêu trước khi phát hành công khai.
