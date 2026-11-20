"""Tạo ảnh tham chiếu "quay xa" (refs/wide/*.png): thu nhỏ mèo quanh điểm chân để có khoảng trống phía trên/hai bên,
giúp clip nhảy/vồ/với cao không bị cắt ở mép khung. Điểm chân giữ nguyên nên engine phóng to lại (zoom = 1/SCALE) là khớp.
Dùng: python video_gen/make_wide_refs.py
"""
import os
import numpy as np
from PIL import Image, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__))
SCALE = 0.72
AX, AY = 552, 671                      # điểm neo (giữa thân, chân) trong ảnh 1280x720 (= 580,716 trong khung 1344x768)
os.makedirs(os.path.join(HERE, 'refs', 'wide'), exist_ok=True)


def wide(src, dst, mirror=False):
    # tách mèo khỏi nền xanh rồi đặt lên nền xanh phẳng mới (không còn viền/khung ảnh cũ)
    im = np.asarray(Image.open(os.path.join(HERE, 'refs', src)).convert('RGB')).astype(np.float32)
    h, w, _ = im.shape
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    m = np.maximum(r, b)
    alpha = np.clip(1 - (g - m - 12) / 30, 0, 1)
    fg = im.copy(); fg[..., 1] = np.minimum(g, m + 4)
    bgc = (28, 140, 78)                      # cùng 1 màu xanh cho mọi ảnh để clip chuyển tư thế không đổi màu nền
    rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
    cat = Image.fromarray(rgba, 'RGBA').resize((round(w * SCALE), round(h * SCALE)), Image.LANCZOS)
    if mirror: cat = ImageOps.mirror(cat)
    out = Image.new('RGB', (w, h), tuple(int(c) for c in bgc))
    ax = (w * SCALE - AX * SCALE) if mirror else AX * SCALE      # vị trí điểm neo trong ảnh nhỏ
    out.paste(cat, (round(AX - ax), round(AY - AY * SCALE)), cat)
    out.save(os.path.join(HERE, 'refs', 'wide', dst))
    print('refs/wide/' + dst, 'nền', tuple(int(c) for c in bgc))


for name in ['stand_right', 'sit_front', 'lie_side', 'belly_up', 'held']:
    wide(name + '.png', name + '.png')
wide('stand_right.png', 'stand_left.png', mirror=True)
