"""Clip H3 (nền xanh) -> WebM VP9 trong suốt (24fps, 1344x768), cắt bỏ đoạn đứng yên đầu/cuối, + ảnh tư thế tĩnh.
Dùng: python tools/build_clips.py <thư mục giải nén*> <thư mục ra kitten2/clips>
  <thư mục giải nén> chứa <id>/<id>_h3local_s*.mp4 (kết quả notebook A100), mặc định chọn bản s...01.
Clip cũ (Video/video_cat_walk.mp4, Video/cat_turn.mp4) vẫn dùng cho đi bộ / quay đầu vì chưa tạo bản H3.
"""
import json, os, glob, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(OUT, exist_ok=True)
AW, AH = 336, 192
LOGO = 'drawbox=x=1135:y=575:w=50:h=50:color=0x228B51:t=fill'      # dấu ✦ Gemini của clip cũ (khung 1280x720)
KEY = ("format=rgba,geq=r='r(X,Y)':g='min(g(X,Y),max(r(X,Y),b(X,Y))+4)':b='b(X,Y)'"
       ":a='255*clip(1-(g(X,Y)-max(r(X,Y),b(X,Y))-12)/30,0,1)'")
clips_cfg = {c['id']: c for c in json.load(open(os.path.join(ROOT, 'video_gen', 'clips.json'), encoding='utf-8'))['clips']}


def read_frames(path, pre=''):
    vf = (pre + ',' if pre else '') + f'scale={AW}:{AH}:flags=area'
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, AH, AW, 3)


def masks_of(fr):
    f = fr.astype(np.int16)
    return (f[..., 1] - np.maximum(f[..., 0], f[..., 2])) < 28


def trim_range(m, pad=2):
    n = len(m)
    d = [0] + [int((m[i] ^ m[i - 1]).sum()) for i in range(1, n)]
    s = next((i for i in range(2, n) if d[i] > 25), 0)
    e = max((i for i in range(n) if d[i] > 25), default=n - 1)
    return max(0, s - pad), min(n - 1, e + pad)


def best_loop(fr, m, lo, hi, minp, maxp):
    g = fr.mean(axis=3).reshape(len(fr), -1).astype(np.float32)
    best = None
    for a in range(lo, hi - minp):
        for b in range(a + minp, min(hi, a + maxp) + 1):
            d = float(np.abs(g[a] - g[b]).mean()) + 0.4 * float((m[a] ^ m[b]).mean() * 255) - 0.02 * (b - a)
            if best is None or d < best[0]:
                best = (d, a, b)
    return best[1], best[2]


def encode(src, a, b, name, pre=''):
    """cắt khung a..b (gồm cả b), tách nền, ghi <name>.webm"""
    out = os.path.join(OUT, name + '.webm')
    vf = (pre + ',' if pre else '') + f'trim=start_frame={a}:end_frame={b + 1},setpts=PTS-STARTPTS,{KEY}'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', vf, '-r', '24', '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
                    '-b:v', '0', '-crf', '30', '-auto-alt-ref', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '3', out], check=True)
    return os.path.getsize(out)


def still(src, idx, name, pre=''):
    out = os.path.join(OUT, name + '.webp')
    vf = (pre + ',' if pre else '') + f'select=eq(n\\,{idx}),{KEY}'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', vf, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '92', '-pix_fmt', 'yuva420p', out], check=True)


def boxes_of(m):
    out = []
    for mm in m:
        ys, xs = np.where(mm)
        out.append((int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) > 30 else None)
    return out


def auto_cues(cid, m, a):
    """mốc tự đo theo hộp bao (khung nguồn): vồ = lúc chân rời/chạm đất, rơi = lúc chạm đất"""
    bx = boxes_of(m); sec = lambda f: round(max(0, f - a) / 24, 3)
    if cid == 'pounce':
        air = [i for i, b in enumerate(bx) if b and b[3] < 174]
        if air: return {'swish': sec(air[0] - 2), 'thump': sec(air[-1] + 1), 'move0': sec(air[0] - 3), 'move1': sec(air[-1] + 2)}
        x0 = next(b[2] for b in bx if b)          # không rời đất (vồ kiểu chồm tới): đo theo lúc thân vươn ra phía trước
        lunge = [i for i, b in enumerate(bx) if b and b[2] > x0 + 12]
        if lunge: return {'swish': sec(lunge[0]), 'thump': sec(lunge[-1]), 'move0': sec(lunge[0]), 'move1': sec(lunge[-1])}
    if cid == 'land':
        land = next((i for i in range(20, len(bx)) if bx[i] and bx[i - 1] and bx[i][1] > 35 and bx[i - 1][1] <= 35), None)
        if land: return {'thump': sec(land)}
    fixed = {'swat': {'swish': 20}, 'reach_up': {'swish': 33}, 'catch_bite': {'bite': 60}, 'belly_roll': {'thump': 40}, 'scratch': {'swish': 40}}
    return {k: sec(f) for k, f in fixed.get(cid, {}).items()}


# Tăng dần: chỉ encode clip chưa có file (FORCE=1 để làm lại tất cả). Mọi seed trong zip đều dùng: bản thứ 2 là <id>_b, ...
FORCE = os.environ.get('FORCE') == '1'
mpath = os.path.join(OUT, 'manifest.json')
manifest = json.load(open(mpath, encoding='utf-8')) if os.path.exists(mpath) and not FORCE else {}
jobs, srcs = [], {}
POSE_SRC = {'stand_right': 'run', 'sit_front': 'swat', 'lie_side': 'knead', 'belly_up': 'belly_kick', 'held': 'held_dangle'}


def add(name, src, cfg, pre='', loop_search=None, base=None):
    fr = read_frames(src, pre.split(',scale')[0] if pre else ''); m = masks_of(fr)
    if loop_search:
        a, b = best_loop(fr, m, 0, len(fr) - 1, *loop_search); b -= 1
    else:
        a, b = trim_range(m)
    srcs[name] = src
    entry = {'start': cfg['start'], 'end': cfg['end'], 'frames': b - a + 1, 'dur': round((b - a + 1) / 24, 3), 'src': os.path.basename(src),
             'trim': [a, b], 'cues': auto_cues(base or name, m, a)}
    if loop_search or cfg.get('loop'): entry['loop'] = True
    if base and base != name: entry['variant_of'] = base
    old = manifest.get(name, {})
    if FORCE or not os.path.exists(os.path.join(OUT, name + '.webm')) or old.get('trim') != [a, b] or old.get('src') != entry['src']:
        jobs.append((name, src, a, b, pre))
    else:
        entry['bytes'] = old.get('bytes')
    manifest[name] = entry


LOOPS = ('held_dangle', 'hiss_squirm', 'belly_kick', 'walk', 'sleep')     # đầu = cuối nên lặp lại cả clip vẫn liền mạch
flat = sorted(glob.glob(os.path.join(SRC, '*.mp4')))
if flat:
    # Thư mục phẳng (notebook --flat): <tên hành động>.mp4, bản thứ 2: <tên>_b.mp4. Thay luôn các bản cũ cùng tên.
    import re
    by_name = {c.get('name', c['id']): c for c in clips_cfg.values()}
    by_name.update({c['name']: c for c in clips_cfg.values() if c.get('name')})
    groups = {}
    for f in flat:
        stem = os.path.splitext(os.path.basename(f))[0]
        m_ = re.match(r'^(.*)_([b-h])$', stem)
        base = m_.group(1) if m_ and m_.group(1) in by_name else stem
        groups.setdefault(base, []).append((stem, f))
    strip = lambda p: p[:-2] if p.endswith('_w') else p
    for base, items in groups.items():
        cfg = by_name.get(base)
        if not cfg:
            print('không biết hành động', base); continue
        for k in [k for k, v in manifest.items() if k == base or v.get('variant_of') == base]:
            manifest.pop(k)
            if k not in dict(items) and os.path.exists(os.path.join(OUT, k + '.webm')): os.remove(os.path.join(OUT, k + '.webm'))
        for stem, f in sorted(items):
            add(stem, f, {**cfg, 'start': strip(cfg['start']), 'end': strip(cfg['end']), 'loop': base in LOOPS or cfg.get('loop')}, base=base)
            if cfg.get('ref_scale'): manifest[stem]['zoom'] = round(1 / cfg['ref_scale'], 4)
else:
    for cid, cfg in clips_cfg.items():
        if cfg.get('batch'): continue
        fs = sorted(glob.glob(os.path.join(SRC, cid, f'{cid}_h3local_s*.mp4')))
        if not fs:
            print('thiếu', cid); continue
        for i, f in enumerate(fs):
            add(cid + ('' if i == 0 else '_' + 'bcdefg'[i - 1]), f, {**cfg, 'loop': cid in LOOPS}, base=cid)

# clip cũ (chưa có bản H3): đi bộ (đoạn lặp tốt nhất), cào khi bị chạm vào đuôi/thân
OLD = f'{LOGO},scale=1344:768'
vw = os.path.join(ROOT, 'Video', 'video_cat_walk.mp4')
if os.path.exists(vw) and manifest.get('walk', {}).get('src', 'video_cat_walk.mp4') == 'video_cat_walk.mp4': add('walk', vw, {'start': 'walk', 'end': 'walk'}, OLD, loop_search=(18, 60))
vs = os.path.join(ROOT, 'Video', 'cat_scratch.mp4')
if os.path.exists(vs) and manifest.get('scratch', {}).get('src', 'cat_scratch.mp4') == 'cat_scratch.mp4':
    fr = read_frames(vs, LOGO); m = masks_of(fr)
    srcs['scratch'] = vs; a, b = 0, 91                     # 0-3.8 s: quay sang nhìn, cào, quay lại đứng
    manifest['scratch'] = {'start': 'stand_right', 'end': 'stand_right', 'frames': b - a + 1, 'dur': round((b - a + 1) / 24, 3), 'src': 'cat_scratch.mp4', 'trim': [a, b], 'cues': auto_cues('scratch', m, a)}
    if FORCE or not os.path.exists(os.path.join(OUT, 'scratch.webm')): jobs.append(('scratch', vs, a, b, OLD))
if manifest.get('turn', {}).get('src') == 'cat_turn.mp4': manifest.pop('turn')

with ThreadPoolExecutor(3) as ex:
    for (cid, src, a, b, pre), size in zip(jobs, ex.map(lambda j: encode(j[1], j[2], j[3], j[0], j[4]), jobs)):
        manifest[cid]['bytes'] = size
        print(f'{cid:16} khung {a}-{b} ({manifest[cid]["dur"]}s) {size // 1024} KB', flush=True)

for pose, cid in POSE_SRC.items():           # ảnh tư thế tĩnh: khung 0 của clip bắt đầu ở tư thế đó
    if cid in srcs and (FORCE or not os.path.exists(os.path.join(OUT, f'pose_{pose}.webp'))): still(srcs[cid], 0, 'pose_' + pose)
json.dump(manifest, open(mpath, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('xong', len(manifest), 'clip, encode mới', len(jobs), ', tổng', sum(v.get('bytes') or 0 for v in manifest.values()) // 1024, 'KB', flush=True)
