# Tạo icon app từ images/logo.png (xóa dấu sao Gemini ở góc dưới phải):  python tools/make_icons.py
import os
from PIL import Image, ImageDraw
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
im = Image.open(os.path.join(root, 'images', 'logo.png')).convert('RGB')
w, h = im.size
bg = im.getpixel((int(w * 0.80), int(h * 0.94)))                       # màu nền gần góc
ImageDraw.Draw(im).rectangle([int(w * 0.88), int(h * 0.86), w, h], fill=bg)
for name, px in (('icon-512.png', 512), ('icon-192.png', 192)):
    im.resize((px, px), Image.LANCZOS).save(os.path.join(root, 'kitten2', name))
im.resize((32, 32), Image.LANCZOS).save(os.path.join(root, 'kitten2', 'favicon.png'))
print('icons ok', bg)
