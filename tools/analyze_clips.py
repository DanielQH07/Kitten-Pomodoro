"""Phân tích clip H3 (nền xanh): hộp bao mèo, chuyển động từng khung, đoạn lặp tốt nhất -> analysis.json.
Dùng: python tools/analyze_clips.py <thư mục chứa */<id>_h3local_s*.mp4> <analysis.json>
"""
import json, subprocess, sys, glob, os
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
AW, AH = 336, 192        # độ phân giải phân tích (1344x768 / 4)
FULLW, FULLH = 1344, 768


def read_frames(path, w=AW, h=AH):
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def cat_mask(fr):
    f = fr.astype(np.int16)
    return (f[..., 1] - np.maximum(f[..., 0], f[..., 2])) < 28     # mèo trắng: G không vượt R/B nhiều


def bbox(m):
    ys, xs = np.where(m)
    if len(xs) < 30:
        return None
    # bỏ nhiễu: lấy phân vị rất nhỏ
    return [int(np.percentile(xs, 0.2)), int(np.percentile(ys, 0.2)), int(np.percentile(xs, 99.8)), int(np.percentile(ys, 99.8))]


def best_loop(gray, masks, min_len, max_len, lo=0):
    n = len(gray); best = None
    g = gray.reshape(n, -1).astype(np.float32)
    for a in range(lo, n - min_len):
        for b in range(a + min_len, min(n, a + max_len + 1)):
            d = float(np.abs(g[a] - g[b]).mean()) + 0.4 * float((masks[a] ^ masks[b]).mean() * 255)
            score = d - 0.02 * (b - a)             # ưu tiên đoạn dài hơn một chút
            if best is None or score < best[0]:
                best = (score, a, b, d)
    return best


res = {}
for d in sorted(glob.glob(os.path.join(SRC, '*'))):
    cid = os.path.basename(d)
    fs = sorted(glob.glob(os.path.join(d, f'{cid}_h3local_s*.mp4')))
    if not fs:
        continue
    fr = read_frames(fs[0])
    masks = np.array([cat_mask(f) for f in fr])
    gray = fr.mean(axis=3).astype(np.uint8)
    boxes = [bbox(m) for m in masks]
    diffs = [0] + [int((masks[i] ^ masks[i - 1]).sum()) for i in range(1, len(fr))]
    gd = [0.0] + [float(np.abs(gray[i].astype(np.int16) - gray[i - 1]).mean()) for i in range(1, len(fr))]
    res[cid] = {'file': os.path.relpath(fs[0], SRC).replace('\\', '/'), 'n': len(fr), 'boxes': boxes, 'diff': diffs, 'gdiff': [round(x, 2) for x in gd]}
    if cid in ('run', 'held_dangle', 'hiss_squirm', 'belly_kick', 'knead', 'groom'):
        res[cid]['loops'] = {}
        for tag, (mn, mx, lo) in {'short': (8, 14, 0), 'mid': (14, 30, 0)}.items():
            b = best_loop(gray, masks, mn, mx, lo)
            res[cid]['loops'][tag] = {'a': b[1], 'b': b[2], 'dist': round(b[3], 2)}
    print(cid, len(fr), 'diff:', ''.join('#' if x > 25 else ('+' if x > 8 else '.') for x in diffs))

json.dump(res, open(OUT, 'w'))
