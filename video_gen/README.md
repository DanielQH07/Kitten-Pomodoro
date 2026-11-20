# Tạo video mèo bằng ComfyUI (Colab L4) hoặc MiniMax H3

Bộ công cụ tạo hàng loạt clip cho mèo, dùng **khung đầu + khung cuối** để các clip nối mượt với nhau.

| File | Việc |
|---|---|
| `clips.json` | Toàn bộ cấu hình: prompt từng clip, ảnh đầu/cuối, độ phân giải, model, backend |
| `refs/` | Ảnh tham chiếu (tư thế trung tâm) nền xanh |
| `comfy_batch.py` | Chạy hàng loạt qua API của ComfyUI, tải kết quả về mp4 |
| `colab_h3_a100.ipynb` | **Khuyên dùng.** Notebook Colab A100: MiniMax H3 chạy cục bộ trong ComfyUI, 1344×768, 24fps |
| `colab_comfyui.ipynb` | Dự phòng: Wan 2.2 trên Colab L4 |
| `make_notebook_h3.js`, `make_notebook.js` | Sinh lại 2 notebook (`node video_gen/make_notebook_h3.js`) |

## 1. Ý tưởng: 3 tư thế trung tâm

Mọi clip bắt đầu và kết thúc ở một trong các tư thế sau, nên khi ghép vào app không bị giật:

| Tư thế | Ảnh | Có sẵn? |
|---|---|---|
| STAND (đứng nhìn ngang, quay phải) | `refs/stand_right.png` | ✅ |
| SIT (ngồi nhìn thẳng) | `refs/sit_front.png` | ✅ |
| LIE (nằm nghiêng ngủ) | `refs/lie_side.png` | ✅ |
| HELD (bị nhấc lên, thân thõng) | `refs/held.png` | ✅ (đã xoá dấu ✦ Gemini) |
| BELLY (nằm ngửa) | `refs/belly_up.png` | ✅ (đã xoá dấu ✦ Gemini) |

Tạo 2 ảnh còn thiếu: đưa `stand_right.png` (cho HELD) và `lie_side.png` (cho BELLY) vào **Gemini (Nano Banana)** hoặc công cụ sửa ảnh trong ComfyUI, dán prompt ở `clips.json → refs.held.generate.prompt` và `refs.belly_up.generate.prompt`. Chọn ảnh **giống bé mèo nhất**, giữ nguyên nền xanh và cỡ ảnh 1280×720, lưu vào `refs/`.
Chưa có 2 ảnh này thì các clip dùng chúng (`held_dangle`, `land`, `hiss_squirm`, `belly_*`) tự bị bỏ qua, các clip còn lại chạy bình thường.

Xem danh sách và clip nào còn thiếu ảnh: `python video_gen/comfy_batch.py --list`

## 2. Chạy MiniMax H3 cục bộ trên A100 (khuyên dùng)

Lý do chọn H3 thay Wan: H3 bám prompt tốt hơn, chạy 24fps ở 1344×768 (nét hơn 848×480 của Wan) và nhận prompt theo dòng thời gian. Lần chạy Wan đầu tiên có lỗi: mèo đi bộ thay vì phi, không chổng mông, bàn tay người xuất hiện dù đã cấm, mèo đi khỏi khung. Nguyên nhân chính là LoRA 4 bước chạy cfg=1 nên prompt phủ định không có tác dụng.

1. Đưa `video_gen/` lên GitHub (hoặc Drive: `MyDrive/kitten_video_gen`).
2. Mở `colab_h3_a100.ipynb`, chọn **A100**, chạy lần lượt từng ô. Model lưu ở Drive (`ComfyUI_H3_models`) nên phiên sau không phải tải lại.
3. Chạy thử `pounce`, xem ổn rồi chạy `--priority 1`.
4. Kết quả: `MyDrive/kitten_video_h3/<id>/<id>_h3local_s<seed>.mp4`.

**Prompt có cấu trúc** (cùng định dạng notebook mẫu và template chính thức của ComfyUI): `subject_definitions` (mèo; `<Picture 1>` = khung đầu, `<Picture 2>` = khung cuối) → `summary` → `retention_analysis` (khoá nền xanh, camera, vị trí, cỡ mèo, cấm tay/người) → `detailed_description` theo từng giây. Phần chung nằm ở `clips.json → global.h3_prompt`; timeline riêng của mỗi clip ở `clips[].timeline`. Mỗi clip có `h3_frames` dạng **17k+5** (56, 73, 90, 107, 124 = 2,3 / 3,0 / 3,75 / 4,5 / 5,2 giây ở 24fps). Timeline phải kết thúc trước giây cuối của clip.

Tuỳ chọn: `--quality turbo` (LoRA 8-step, 6 bước, nhanh hơn nhiều), `--variant fp8` nếu int8 lỗi. Muốn ép tư thế trung gian cho một clip: thêm `"keyframes": [{"ref": "ten_anh_trong_refs", "at": 1.0}]` (giây) để runner nối node `MiniMaxH3AddGuide`.

Clip lặp (`run`) dùng `sprite_start` và `sprite_sec` để chỉ cắt đoạn giữa (vòng chạy) khi build sprite.

### Bộ v2 (13 clip, kết quả là 1 thư mục video theo tên hành động)
- `python video_gen/make_wide_refs.py` tạo `refs/wide/`: mèo thu nhỏ còn 72% quanh điểm chân, đặt trên nền xanh phẳng, để clip nhảy/vồ/với cao không bị cắt mép. Engine phóng to lại (`zoom = 1/0.72`) nên khớp với các clip cũ.
- Clip v2 trong `clips.json` (batch `fix` = 6 clip bị cắt khung + ăn, notebook `colab_h3_fix.ipynb`; batch `later` = các clip còn lại), `"name"` (tên hành động) và `"ref_scale": 0.72`: pounce, reach_up, swat, land, walk, run, turn, eat (priority 1); sleep, lie_down, belly_roll, belly_return, catch_bite (priority 2).
- Notebook (ô 8): `comfy_batch.py --flat --batch later --variants 2` lưu `OUT/<tên>.mp4` và `OUT/<tên>_b.mp4`, không lưu khung hình; ô 9 nén thành zip.
- Đưa vào bản xem thử: giải nén vào `video_gen/output/v2/` rồi `python tools/build_clips.py video_gen/output/v2 kitten2/clips` (thay các clip cùng tên).

## 2b. Phương án dự phòng: Wan 2.2 trên Colab L4

1. Đưa thư mục `video_gen/` lên GitHub (hoặc Drive: `MyDrive/kitten_video_gen`).
2. Mở `colab_comfyui.ipynb` trong Colab, chọn **GPU L4**, chạy lần lượt từng ô.
3. Chạy thử 1 clip (`run`) trước, xem ổn rồi mới chạy cả loạt.
4. Kết quả: `MyDrive/kitten_video/<id>/<id>_wan_s<seed>.mp4`.

Mặc định: Wan 2.2 14B fp8, bản LoRA lightx2v 4 bước, 848×480, 81 khung hình 16fps (≈5 giây). Mình chưa đo được thời gian thực trên L4; bạn đo ở clip đầu tiên rồi nhân lên để biết cả loạt mất bao lâu.
Muốn chất lượng cao hơn: `backends.wan.quality = "full"` (20 bước, chậm hơn nhiều lần). 720p trên L4 không khuyến khích.

## 3. MiniMax H3 qua API node (tuỳ chọn, tính phí)

- ComfyUI có sẵn node **MiniMax H3 First-Last-Frame to Video** (hỗ trợ khung đầu + khung cuối).
- Cần `COMFY_API_KEY` (platform.comfy.org) và credit. Mặc định model `MiniMax H3 Max Turbo` 768P. Các lựa chọn: `MiniMax H3` (768P/2K), `MiniMax H3 Max`, `MiniMax H3 Max Turbo` (480P/768P).
- Theo mã nguồn ComfyUI (v0.46), đơn giá khoảng: H3 768P ≈ 0,129 USD/giây, H3 Max 768P ≈ 0,114 USD/giây, H3 Max Turbo 768P ≈ 0,057 USD/giây. Một clip 5 giây Max Turbo ≈ 0,29 USD. Giá có thể đổi, xem trên node trước khi chạy cả loạt.
- Độ dài tối thiểu 4–5 giây nên clip 2 giây vẫn ra 5 giây, `sprite_sec` sẽ cắt lại.
- Chạy: `python video_gen/comfy_batch.py --backend h3 --priority 1` (đặt `COMFY_API_KEY` trước).

Gợi ý: **Wan** (miễn phí, chạy lại thoải mái) cho phần lớn clip; **H3** cho vài clip Wan làm khó (vồ, nhảy, chuyển tư thế lớn).

## 4. Chọn kết quả và đưa vào app

1. Xem các bản `s<seed>` (`--variants 3` tạo 3 bản). Chọn bản: mèo **cùng cỡ, cùng vị trí** với ảnh tham chiếu, nền xanh sạch, clip lặp thì khung cuối giống khung đầu, không có tay/người/đồ vật.
2. Đổi tên thành `<id>.mp4` (ví dụ `run.mp4`) và bỏ vào thư mục `Video/` của dự án.
3. `bash tools/build_sprites.sh` — script tự nhận mọi clip có trong `clips.json` rồi tách nền xanh, xuất sprite vào `extension/sprites/`.
4. Việc nối clip vào hành vi của mèo (đồ thị chuyển động, tương tác chuột) làm ở bước tiếp theo.

## 5. Viết thêm clip mới

Thêm một object vào `clips.json → clips`:

```json
{ "id": "yawn", "priority": 3, "start": "sit_front", "end": "sit_front",
  "frames": 49, "sprite_sec": 3.0, "used_for": "ngáp",
  "prompt": "The cat sits facing the camera and yawns widely, then returns to the starting pose." }
```

- `frames` phải có dạng 4n+1: 33 (~2s), 49 (~3s), 65 (~4s), 81 (~5s).
- Prompt chỉ mô tả hành động của mèo; mô tả mèo, nền xanh, camera cố định đã nằm sẵn ở `global.prefix/suffix`.
- Cần "bàn tay/cần câu/laser" thì **không** vẽ trong video; chúng là con trỏ chuột của app. Mô tả mèo như đang tương tác với vật vô hình.

## 6. Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| Hết VRAM (OOM) | Thêm `--lowvram` khi bật ComfyUI (ô 5 trong notebook); giảm `resolution` còn `[768, 432]` |
| Mèo méo mặt / đổi lông giữa clip | Chạy thêm `--variants`, hoặc đổi sang backend `h3` cho clip đó |
| Nền xanh bị nhiễm vào lông | Thêm vào prompt: "no green reflection on the fur"; thử seed khác |
| Mèo trôi khỏi giữa khung | Thêm "the cat does not move across the frame"; clip dùng `loop` đảm bảo đầu = cuối |
| `node_errors` khi gửi H3 | Chạy `--check --backend h3`; cập nhật ComfyUI lên bản mới nhất |
| Thiếu ffmpeg | `apt-get install -y ffmpeg` (Colab có sẵn sau ô 1) |
