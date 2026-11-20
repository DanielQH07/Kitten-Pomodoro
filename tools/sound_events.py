"""In ra các đoạn có tiếng (theo đường bao RMS) của một file âm thanh: python tools/sound_events.py file [ngưỡng_dB]"""
import subprocess, sys
import numpy as np
f, thr = sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else -35
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32); hop = 160
env = 20 * np.log10(np.sqrt(np.convolve(x * x, np.ones(hop) / hop, 'same'))[::hop] + 1e-9)
on = env > thr; ev = []; i = 0
while i < len(on):
    if on[i]:
        j = i
        while j < len(on) and (on[j] or (j + 15 < len(on) and on[j:j + 15].any())): j += 1
        ev.append((i / 100, j / 100, float(env[i:j].max()))); i = j
    else: i += 1
print(f, 'dur %.2f' % (len(x) / 16000), 'peak %.1f dB' % (20 * np.log10(np.abs(x).max() + 1e-9)))
for a, b, m in ev[:40]: print('  %.2f-%.2f (%.2fs) max %.1f dB' % (a, b, b - a, m))
