# Đóng gói & xuất bản

Chạy `bash tools/package.sh` sau mỗi lần sửa code/sprite/âm thanh: đồng bộ `app/` và tạo `dist/kitten-pomodoro-extension.zip`.

## 1. Extension Chrome
**Dùng thử (không cần store):** `chrome://extensions` → bật Developer mode → Load unpacked → chọn `extension/`.

**Lên Chrome Web Store:**
1. Tạo tài khoản developer tại chrome.google.com/webstore/devconsole (phí một lần ~5 USD).
2. New item → tải `dist/kitten-pomodoro-extension.zip`.
3. Điền mô tả, ảnh chụp màn hình 1280x800 (mèo đang đi + mèo chặn màn hình), icon 128px (có sẵn), **chính sách quyền riêng tư** (extension này không thu thập dữ liệu, chỉ lưu cài đặt cục bộ).
4. Giải thích quyền: `storage` (lưu cài đặt/giờ), `alarms` (hẹn giờ), `notifications` (báo hết giờ), content script chạy trên mọi trang http/https (để mèo hiện ở mọi tab). Quyền "mọi trang" làm duyệt lâu hơn, nên giải thích rõ.
5. Gửi duyệt: thường vài ngày.

**Bán được không?** Chrome Web Store **không còn bán extension trực tiếp** (Google đã tắt thanh toán trong store từ 2020). Cách làm được:
- Miễn phí + bản Pro bán ngoài: dùng ExtensionPay hoặc Stripe/Gumroad/Lemon Squeezy cấp license key, extension kiểm tra key.
- Miễn phí + nhận donate; hoặc dùng làm sản phẩm kéo người dùng sang app mobile trả phí.

## 2. App di động
Mình làm bản **PWA** trong `app/` để thử ngay (dùng lại nguyên code mèo của extension).

**Thử trên Android (không cần cài gì thêm):**
- Cách A (cài như app thật): đưa thư mục `app/` lên hosting HTTPS miễn phí (Netlify Drop: kéo thả thư mục `app/` lên app.netlify.com/drop; hoặc GitHub Pages / Cloudflare Pages). Mở link bằng Chrome trên điện thoại → menu ⋮ → **Cài đặt ứng dụng / Thêm vào màn hình chính**.
- Cách B (xem nhanh, cùng wifi): `node tools/serve.js` trên PC, mở `http://<IP máy tính>:8765/app/index.html` trên điện thoại. Không cài được và không offline, nhưng đủ xem mèo + âm thanh.
- Lần đầu chạm màn hình để mở khoá âm thanh (quy định của trình duyệt).

**iPhone:** mở cùng link bằng Safari → Chia sẻ → **Thêm vào Màn hình chính**.

**Giới hạn của PWA:** mèo chỉ sống **trong app**; hẹn giờ không chạy khi tắt màn hình/ẩn app; thông báo không đáng tin cậy.

**Bản store thật (làm sau):**
- Bọc PWA bằng **Capacitor** (cùng một code cho Android + iOS), cần Android Studio (+ JDK) để build `.aab`.
- Android: viết thêm module native Kotlin dùng quyền `SYSTEM_ALERT_WINDOW` để mèo nổi **trên mọi app**; Google Play phí một lần 25 USD.
- iOS: phải có Mac hoặc dịch vụ build cloud (Codemagic, EAS); Apple Developer 99 USD/năm. iOS **không cho vẽ đè lên app khác**; chỉ làm được thông báo, Live Activity, widget, và chặn app qua Screen Time (cần xin quyền Apple). Apple dễ từ chối app chỉ là "website bọc lại", nên cần tính năng native (thông báo, widget).

## 3. Trước khi bán: kiểm tra bản quyền tài nguyên
- `sounds/tieng_meo_keu-www_tiengdong_com.mp3`: nguồn tiengdong.com, **chưa rõ giấy phép dùng thương mại**.
- `sounds/dragon-studio-purring-cat-*.mp3`: kiểu Pixabay, cần kiểm tra điều khoản của đúng file đó.
- Video mèo tạo từ Gemini/Veo: xem điều khoản sử dụng thương mại của gói Gemini bạn đang dùng.
- Thay âm thanh bằng tiếng bé mèo của bạn tự thu là cách sạch nhất.
