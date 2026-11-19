# Prompt tạo thêm video cho mèo (Gemini / Veo)

## Quy tắc chung (áp dụng cho mọi clip)
1. **Ảnh tham chiếu = khung hình đầu.** Dùng ảnh trong thư mục `references/`
   (`ref_walk_side.png`: mèo đứng nhìn ngang; `ref_sit_front.png`: mèo ngồi). Đây là ảnh nền xanh lấy từ chính video đã tạo nên mèo sẽ giống nhau và cùng nền.
2. **Cùng khung hình với các clip cũ:** mèo cùng kích thước, cùng vị trí, chân chạm đáy khung, nhìn thấy cả đuôi. Nếu không, sprite sẽ nhảy cỡ khi chuyển clip.
3. **Camera đứng yên** (mèo không được đi khỏi vị trí; code sẽ tự dịch chuyển).
4. **Nền xanh lá trơn như ảnh tham chiếu**, không có đồ vật, không chữ. Logo Gemini ở góc phải dưới sẽ được cắt tự động.
5. Nếu Veo có "khung đầu + khung cuối", hãy dùng **cùng một ảnh cho cả hai** để clip trở về tư thế ban đầu (nối mượt với clip đi bộ).
6. Chọn video 8 giây rồi cắt lại. Tạo 3-4 lần, chọn bản mèo giống nhất.

Phần đuôi chung nên dán vào cuối mọi prompt:
> Static locked camera, no zoom, no pan. The cat stays in the exact same place and the same size as in the reference image, whole body and tail always fully visible. Solid flat green screen background identical to the reference, no shadows on walls, no objects, no text, no watermark. Realistic fluffy white long-haired cat, same face and eye colour as the reference. No sound.

---

## 1. `cat_scratch.mp4` (BẮT BUỘC: cào khi bị chạm)
Ảnh tham chiếu: `references/ref_walk_side.png`
Lưu thành `Video/cat_scratch.mp4`, rồi chạy `bash tools/build_sprites.sh`.

> The white fluffy cat is standing and facing right (as in the reference). It suddenly stops, turns its head and body toward the camera with an annoyed, grumpy look, rears up slightly and swipes its right front paw at the camera twice, quickly, claws out, as if scratching the screen. Then it relaxes, turns back to the right and returns to the exact starting standing pose. Total action about 3 seconds, then stays still.

+ phần đuôi chung.

Mẹo: nếu mèo bị lệch mặt khi quay về phía camera, thêm: *"keep the same face, pink nose, amber eyes at every frame"*.

## 2. `cat_turn.mp4` (nên có: quay đầu, đi kèm tiếng meo)
Ảnh tham chiếu: `references/ref_walk_side.png`

> The standing white fluffy cat looks over its shoulder, opens its mouth and meows once, then turns its whole body around to face the opposite direction (facing left) and stands still, ready to walk.

+ phần đuôi chung. (Code hiện đang chỉ lật ngang ảnh khi quay đầu; clip này sẽ làm cảnh quay đầu tự nhiên hơn.)

## 3. `cat_standup.mp4` (nên có: ngồi → đứng dậy, bỏ cảnh cắt đột ngột)
Ảnh tham chiếu: `references/ref_sit_front.png` (khung đầu). Khung cuối: `references/ref_walk_side.png`.

> The white fluffy cat is sitting in a relaxed pose. It yawns, stretches, gets up onto all four legs and turns to face right, ending in a standing side-view pose ready to walk.

+ phần đuôi chung.

## 4. `cat_sleep.mp4` (tuỳ chọn: giờ nghỉ dài, mèo ngủ gừ gừ)
Ảnh tham chiếu: `images/…395….jpg` (mèo nằm ngủ), hoặc dựng khung nền xanh trước bằng Gemini image:

> Same white fluffy cat curled up asleep lying on its side, solid green screen background, no shadow.

Sau đó image-to-video:
> The sleeping cat breathes slowly, its fluffy chest rising and falling, tail tip twitching very slightly, ears flicking once. Seamless loop, minimal movement.

---

## Tạo ảnh tư thế mới bằng Gemini (nếu Veo kéo mèo sai dáng)
Đưa `references/ref_walk_side.png` vào Gemini và yêu cầu:
> Edit this image: keep the exact same cat and same green background, but change the pose to: <tư thế>. Same camera angle, same cat size and position in the frame.

Dùng ảnh này làm khung đầu cho Veo.
