> **Bản mới:** prompt đầy đủ cho ~20 clip (kèm cấu hình ComfyUI/Colab/MiniMax H3) nằm ở `video_gen/clips.json` và `video_gen/README.md`. File này giữ lại các prompt đầu tiên.

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

---

## 5. `cat_pet.mp4` (xoa đầu, khi bấm vào ĐẦU mèo)
Ảnh tham chiếu (khung đầu và khung cuối): `references/ref_walk_side.png`
Lưu `Video/cat_pet.mp4`, rồi `bash tools/build_sprites.sh`. Trong app, con trỏ chuột trở thành bàn tay khi trỏ vào đầu mèo; bấm vào thân thì mèo cào (clip `cat_scratch`).

**Chỉ có con mèo trong video, không có bàn tay hay người nào** (bàn tay là con trỏ chuột của app, vẽ đè lên mèo; mèo chỉ cần diễn như đang được vuốt ve).

> The standing white fluffy cat (side view, facing right, as in the reference) is being gently petted on the head by an invisible hand that is not shown. It lowers its head slightly and pushes the top of its head upward and forward into the invisible touch, closes its eyes in bliss, ears relaxed and slightly flattened back, a soft contented expression. Its head moves gently down and up three times as if being stroked from forehead to between the ears, tail tip swaying very slightly, a faint purr in the chest. Then it lifts its head, opens its eyes and returns to the exact starting standing pose. Action about 4 seconds, then the cat stays still. Only the cat is in the frame: no hand, no person, no arm, no objects.

+ phần đuôi chung. Nếu Veo vẫn vẽ ra bàn tay, thêm: *"absolutely no human hand, no fingers, no arm anywhere in the frame"*.

## 6. `cat_pet_sit.mp4` (tuỳ chọn: xoa đầu khi mèo đang ngồi nhìn thẳng, lúc chặn màn hình)
Ảnh tham chiếu: `references/ref_sit_front.png`

Cũng chỉ có con mèo, không có bàn tay.

> The white fluffy cat sits facing the camera (as in the reference) and is being gently petted on the head by an invisible hand that is not shown. It tilts its head slightly upward into the invisible touch, closes its eyes, ears relaxed, with a content smile-like expression, and its head moves gently down and up three times as if being stroked. Then it opens its eyes and returns to the exact starting sitting pose. About 4 seconds. Only the cat is in the frame: no hand, no person, no arm, no objects.

+ phần đuôi chung. Nếu Veo vẫn vẽ ra bàn tay, thêm: *"absolutely no human hand, no fingers, no arm anywhere in the frame"*.

Cách mèo xác định "đầu" so với "thân": code lấy hộp bao của mèo ở khung hình đang hiện, đầu là ~1/3 phía trước và ~60% phía trên của hộp (mèo ngồi nhìn thẳng thì đầu là phần trên giữa). Vì vậy clip nên giữ đầu mèo ở đúng chỗ đó, đừng quay mèo đi chỗ khác.
