"""Cắt + chỉnh âm lượng đều các tiếng mèo/hiệu ứng từ sounds/ -> kitten2/sounds/*.mp3  (xem docs/sounds_sources.md)
Dùng: python tools/build_sounds.py
Mỗi tiếng: cắt đoạn [giây đầu, giây cuối] -> (lọc nếu cần) -> đưa về mức RMS mục tiêu (dBFS, tính trên phần có tiếng) -> fade -> mp3.
"""
import os, subprocess, tempfile
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = os.path.join(ROOT, 'sounds'); EXT = os.path.join(ROOT, 'extension', 'sounds'); OUT = os.path.join(ROOT, 'kitten2', 'sounds')
os.makedirs(OUT, exist_ok=True)
SR = 44100


def load(path, a=None, b=None, af=None):
    cmd = ['ffmpeg', '-v', 'error']
    if a is not None: cmd += ['-ss', str(a)]
    if b is not None: cmd += ['-t', str(b - (a or 0))]
    cmd += ['-i', path, '-ac', '1', '-ar', str(SR)]
    if af: cmd += ['-af', af]
    cmd += ['-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).copy()


def rms_db(x):
    win = SR // 50; n = len(x) // win
    if n == 0: return -60
    e = np.sqrt((x[:n * win].reshape(n, win) ** 2).mean(axis=1))
    act = e[e > 10 ** (-45 / 20)]                     # chỉ tính các đoạn có tiếng
    return 20 * np.log10(np.sqrt((act ** 2).mean()) + 1e-9) if len(act) else -60


def save(name, x, target, fade_in=0.01, fade_out=0.04, loop=False):
    x = x * 10 ** ((target - rms_db(x)) / 20)
    pk = np.abs(x).max()
    if pk > 0.89: x = x * 0.89 / pk                     # chặn đỉnh, tránh vỡ tiếng
    if not loop:
        fi, fo = int(fade_in * SR), int(fade_out * SR)
        x[:fi] *= np.linspace(0, 1, fi); x[-fo:] *= np.linspace(1, 0, fo)
    tmp = tempfile.mktemp(suffix='.f32')
    x.astype(np.float32).tofile(tmp)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', tmp, '-c:a', 'libmp3lame', '-q:a', '4',
                    os.path.join(OUT, name + '.mp3')], check=True)
    os.remove(tmp)
    print(f'{name:10} {len(x) / SR:5.2f}s  đỉnh {20 * np.log10(np.abs(x).max()):.1f} dB')


def seamless(x, xf):
    """vòng lặp liền mạch: đuôi hoà vào đầu bằng crossfade"""
    n = int(xf * SR); head, tail = x[:n], x[-n:]
    mix = tail * np.linspace(1, 0, n) + head * np.linspace(0, 1, n)
    return np.concatenate([mix, x[n:-n]])


# --- meo (giữ 4 tiếng cũ từ tiengdong, thêm 1 tiếng CC0 từ BigSoundBank) ---
for i in range(1, 5):
    save(f'meow{i}', load(os.path.join(EXT, f'meow{i}.mp3')), -17, 0.01, 0.12)
save('meow5', load(os.path.join(S, 'ANMLCat_Meow cat 3 (ID 1891)_BigSoundBank.com.wav')), -17, 0.01, 0.2)
# --- gừ gừ: vòng lặp liền mạch 14 s lấy ở giữa file dài, và đoạn ngắn từ file Dragon Studio ---
save('purr', seamless(load(os.path.join(S, 'ANMLCat_Cat purring 3 (ID 1010)_BigSoundBank.com.wav'), 30, 44.5), 1.5), -27, loop=True)
save('scratch', load(os.path.join(EXT, 'scratch.mp3')), -19, 0.01, 0.1)
# --- khè (bị nhấc quá lâu) ---
save('hiss', load(os.path.join(S, '146960__zabuhailo__cathisses.wav'), 0.85, 2.1), -19, 0.03, 0.15)
# --- tiếng chiêu dụ: chirp / trill (mèo mẹ gọi con), dùng khi chơi laser/cần câu ---
chirp = os.path.join(S, '451250__dreamstobecome__cat-chirp.wav'); trill = os.path.join(S, '200336__jsbarrett__cat-trilling.aiff')
save('chirp1', load(chirp, 2.5, 3.05), -21, 0.01, 0.1)
save('chirp2', load(chirp, 6.4, 6.95), -21, 0.01, 0.1)
save('trill1', load(trill, 7.7, 8.45), -21, 0.01, 0.1)
save('trill2', load(trill, 9.8, 10.35), -21, 0.01, 0.1)
# --- hiệu ứng: tiếp đất (cắt tần số cao cho êm), vút (vồ/vả), sột soạt (cần câu lông) ---
save('thump', load(os.path.join(S, '207824__macif__thump.wav'), 0.08, 0.7, 'lowpass=f=450,volume=1.0'), -19, 0.004, 0.2)
sw = os.path.join(S, '235553__simosco__swish.wav')
save('swish1', load(sw, 0.5, 0.95, 'highpass=f=250'), -25, 0.02, 0.15)
save('swish2', load(sw, 2.05, 2.5, 'highpass=f=250'), -25, 0.02, 0.15)
rs = os.path.join(S, '181774__keweldog__rustling-paper.wav')
save('rustle1', load(rs, 2.55, 3.6, 'lowpass=f=7000'), -27, 0.03, 0.2)
save('rustle2', load(rs, 0.95, 1.5, 'lowpass=f=7000'), -27, 0.03, 0.2)
# --- nhạc nền nhẹ (Lukrembo - Bread, freetouse.com: cần ghi nguồn) ---
save('music', load(os.path.join(S, 'Lukrembo - Bread (freetouse.com).mp3'), 0, 120), -30, 1.5, 3.0)
