# Kitten Pomodoro v2 — kế hoạch tính năng và hiệu ứng

Bản xem thử: `node tools/serve.js` rồi mở http://localhost:8765/kitten2/  (thêm `?break` để vào thẳng giờ nghỉ, `#debug` để xem trạng thái mèo, phím 1/2/3 đổi công cụ).

## Dữ liệu
- Toàn bộ 28 video H3 trong zip (22 clip + 6 bản seed thứ 2 của run, crouch_wiggle, pounce, held_dangle, land, pet) đã tách nền sang WebM VP9 trong suốt, cắt đoạn đứng yên đầu/cuối (`tools/build_clips.py`, chạy lại chỉ encode clip mới). Engine chọn ngẫu nhiên giữa các bản để mèo đỡ lặp.
- Clip cũ còn dùng: đi bộ (`walk`) và cào khi bị chạm đuôi (`scratch`), vì chưa có bản H3.
- Âm thanh cắt và đưa về mức đều nhau (`tools/build_sounds.py`).

## Tư thế và chuyển cảnh
Tư thế: đứng, ngồi, nằm, nằm ngửa, bị xách. Mỗi clip đi từ một tư thế sang tư thế khác (ví dụ stand_to_sit, lie_down, get_up), nên không còn cảnh cắt đột ngột.

## Tính năng
| Nhóm | Hành vi | Clip | Âm thanh |
|---|---|---|---|
| Tự do | đi dạo, leo tường, ngồi, nằm ngủ, nhào bột, liếm lông, vồ không khí | walk, stand_to_sit, lie_down, knead, groom, crouch_wiggle+pounce | meo nhỏ, gừ khi nằm |
| Giờ nghỉ | mèo ra giữa, phóng to chặn màn hình, ngồi/nằm/chơi tại chỗ | như trên | meo to, nhạc nền, gừ gừ |
| Bàn tay | rê vào đầu: con trỏ thành bàn tay; bấm để xoa đầu | pet, pet_sit | gừ gừ + tim bay |
| Bàn tay | bấm vào thân: ngồi thì vả/liếm, đứng thì dụi/vươn | swat, headbutt, reach_up | cào |
| Bụng | mèo đang nằm, bấm vào thân: lăn ra ngửa; bấm lần nữa: đạp chân | belly_roll, belly_kick, belly_return | thịch nhẹ, meo |
| Xách | giữ và kéo thân mèo: mèo bị xách lên; xách quá 4 giây thì khè và giãy; thả ra thì rơi xuống sàn (đổi vị trí) | held_dangle, hiss_squirm, land | meo to, khè, thịch |
| Laser | chấm đỏ có vệt; mèo nhìn theo, rình rồi vồ, bắt được thì lấp lánh | watch_track, crouch_wiggle, pounce, run | chirp, vút |
| Cần câu lông | mèo nhìn, với lên khi lông cao, vả/ngoạm khi bấm | reach_up, swat, catch_bite | sột soạt theo tốc độ tay, trill |

## Giữ người chơi lâu hơn (cơ chế đã thêm)
Tham khảo các app thú cưng ảo / desktop pet: điểm hút người chơi là phản ứng ngay với thao tác, có tiến triển nhẹ nhàng, có bất ngờ nhỏ, và không gây áp lực hay cảm giác có lỗi (không làm mèo "đói/buồn" khi bỏ app).
- **Độ thân thiết (Lv)**: xoa đầu +1, bắt được +3, cho ăn +2, xoa bụng +2. Lên cấp có tim bay và thông báo. Lv2 trở lên, xoa nhiều thì mèo nằm ngửa cho xoa bụng.
- **Phản ứng tăng dần khi xoa**: vuốt đầu liên tục (giữ chuột/ngón tay và vuốt) thì gừ to dần, dụi đầu vào tay, rồi nằm ngửa.
- **Thể lực**: vồ/chạy nhiều thì mèo mệt, nằm nghỉ 15 giây; xoa đầu và cho ăn giúp hồi sức, tạo nhịp chơi – nghỉ.
- **Combo bắt mồi**: "Bắt được! x3 🔥".
- **Bánh thưởng 🐟**: 3 cái mỗi giờ nghỉ, thả xuống sàn, mèo phi tới ngồi xuống ăn.
- **Bất ngờ**: mèo chạy loạn (zoomies), đòi chơi khi bạn để yên lâu, biểu cảm ❗ 💤 😾 💗 trên đầu.
- **Tổng kết giờ nghỉ**: số lần xoa, bắt được, bánh đã ăn.

## Hiệu ứng
Bóng dưới chân, thở nhẹ khi đứng yên, quay đầu kèm nhảy nhẹ, bụi khi chạy và tiếp đất, rung màn hình khi mèo to tiếp đất, tim bay, lấp lánh khi bắt được, chữ Z khi ngủ, vệt laser, cần câu cán cầm chĩa lên – dây và lông đung đưa như con lắc, âm sột soạt theo tốc độ tay.

## Việc tiếp theo
1. Tạo thêm clip H3: `walk` (đi bộ, thay clip cũ), `run_loop` (phi liên tục để chạy xa mượt hơn), `turn` (quay đầu thật ~1 giây), `sleep` (ngủ lặp), `scratch` bản H3, `eat` (cúi ăn).
2. Khử viền sáng quanh lông khi mèo to trên nền tối.
3. Đưa engine v2 vào extension Chrome, app Electron và PWA.
4. App Android thật (APK): bọc bằng Capacitor (cần Android Studio/SDK) hoặc TWA; trước mắt thử qua trình duyệt điện thoại.
5. Thay tiếng meo từ tiengdong.com bằng tiếng CC0, kiểm tra giấy phép nhạc trước khi bán.
