# Tạo icon launcher từ kitten2/icon-512.png:  python android-app/icons.py
import os
from PIL import Image
root = os.path.dirname(os.path.abspath(__file__))
src = Image.open(os.path.join(root, '..', 'kitten2', 'icon-512.png')).convert('RGBA')
for d, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    out = os.path.join(root, 'android', 'app', 'src', 'main', 'res', 'mipmap-' + d)
    for n in ('ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'):
        src.resize((px, px), Image.LANCZOS).save(os.path.join(out, n))
print('icons ok')

# Màn hình khởi động (splash): nền kem + logo ở giữa, thay ảnh mặc định của Capacitor
import glob
splash = Image.new('RGB', (2048, 2048), src.getpixel((8, 8)))
logo = src.resize((720, 720), Image.LANCZOS); splash.paste(logo, ((2048 - 720) // 2, (2048 - 720) // 2))
res = os.path.join(root, 'android', 'app', 'src', 'main', 'res')
for f in glob.glob(os.path.join(res, 'drawable*', 'splash.png')):
    splash.save(f)
print('splash ok')
