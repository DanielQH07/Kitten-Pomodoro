// Sinh video_gen/colab_comfyui.ipynb:  node video_gen/make_notebook.js
const fs = require('fs'), path = require('path');

const md = (s) => ({ cell_type: 'markdown', metadata: {}, source: s.split('\n').map((l, i, a) => (i < a.length - 1 ? l + '\n' : l)) });
const code = (s) => ({ cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: s.split('\n').map((l, i, a) => (i < a.length - 1 ? l + '\n' : l)) });

const cells = [
  md(`# 🐱 Kitten Pomodoro — tạo video mèo bằng ComfyUI trên Colab (L4)

Notebook này: cài ComfyUI → tải model **Wan 2.2 14B** → chạy hàng loạt clip trong \`video_gen/clips.json\` (khung đầu + khung cuối, nền xanh) → lưu mp4 vào Google Drive.

**Trước khi chạy:** Runtime → Change runtime type → **L4 GPU**.
Mỗi phiên Colab phải tải lại ~37GB model (5–10 phút). Kết quả lưu ở Drive nên không mất khi ngắt kết nối.`),

  md('## 1. GPU + công cụ'),
  code(`!nvidia-smi
!apt-get -qq install -y ffmpeg aria2 > /dev/null
!ffmpeg -version | head -1`),

  md(`## 2. Google Drive + lấy mã nguồn / ảnh tham chiếu

\`SOURCE = "github"\`: clone repo (cần đã push thư mục \`video_gen/\`).
\`SOURCE = "drive"\`: copy thư mục \`video_gen\` của bạn lên Drive tại \`MyDrive/kitten_video_gen\` rồi chọn "drive".
Ảnh tham chiếu còn thiếu (\`held.png\`, \`belly_up.png\`) bạn tạo bằng Gemini rồi bỏ vào \`video_gen/refs/\` (xem README).`),
  code(`from google.colab import drive
drive.mount('/content/drive')

SOURCE = "github"   # hoặc "drive"
REPO = "https://github.com/DanielQH07/Kitten-Pomodoro.git"
OUT = "/content/drive/MyDrive/kitten_video"       # nơi lưu kết quả (trên Drive)

import os, shutil
os.makedirs(OUT, exist_ok=True)
if os.path.exists("/content/video_gen"): shutil.rmtree("/content/video_gen")
if SOURCE == "github":
    !git clone --depth 1 {REPO} /content/_repo
    shutil.copytree("/content/_repo/video_gen", "/content/video_gen")
else:
    shutil.copytree("/content/drive/MyDrive/kitten_video_gen", "/content/video_gen")
!ls /content/video_gen /content/video_gen/refs`),

  md('## 3. Cài ComfyUI'),
  code(`%cd /content
!git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git
%cd /content/ComfyUI
!pip install -q -r requirements.txt`),

  md(`## 4. Tải model Wan 2.2 (danh sách nằm trong \`clips.json → models\`)
Chỉ cần chạy khi dùng backend **wan**. Backend **h3** (MiniMax, qua API) không cần model.`),
  code(`import json, subprocess, os
cfg = json.load(open("/content/video_gen/clips.json", encoding="utf-8"))
for m in cfg["models"]:
    d = f"/content/ComfyUI/models/{m['dir']}"
    os.makedirs(d, exist_ok=True)
    if os.path.exists(f"{d}/{m['file']}"):
        print("có sẵn:", m["file"]); continue
    print("tải:", m["file"])
    subprocess.run(["aria2c", "-x16", "-s16", "-k1M", "-c", "--console-log-level=warn", "-d", d, "-o", m["file"], m["url"]], check=True)
print("xong")`),

  md(`## 5. Bật ComfyUI (chạy nền)
Nếu gặp lỗi hết VRAM: thêm \`"--lowvram"\` vào danh sách tham số bên dưới rồi chạy lại ô này.`),
  code(`import subprocess, time, urllib.request, os
log = open("/content/comfyui.log", "w")
server = subprocess.Popen(
    ["python", "main.py", "--listen", "127.0.0.1", "--port", "8188", "--disable-auto-launch"],
    cwd="/content/ComfyUI", stdout=log, stderr=subprocess.STDOUT)
for i in range(120):
    try:
        urllib.request.urlopen("http://127.0.0.1:8188/system_stats", timeout=2); print("ComfyUI đã sẵn sàng sau", i * 2, "giây"); break
    except Exception:
        time.sleep(2)
else:
    print(open("/content/comfyui.log").read()[-3000:])`),

  md('## 6. Kiểm tra node + xem danh sách clip'),
  code(`!python /content/video_gen/comfy_batch.py --check
!python /content/video_gen/comfy_batch.py --list`),

  md(`## 7. Chạy thử 1 clip (Wan 2.2, ~vài phút)
Xem kết quả ở ô tiếp theo. Nếu ổn mới chạy cả loạt.`),
  code(`!python /content/video_gen/comfy_batch.py --server http://127.0.0.1:8188 --out {OUT} --only run`),
  code(`from IPython.display import Video, display
import glob
f = sorted(glob.glob(OUT + "/run/*.mp4"))
print(f)
if f: display(Video(f[-1], embed=True, width=640))`),

  md(`## 8. Chạy cả loạt clip
- \`--priority 1\`: chỉ nhóm ưu tiên 1; đổi thành 2 hoặc 3 để chạy thêm.
- \`--variants 3\`: mỗi clip 3 seed khác nhau để bạn chọn bản đẹp nhất.
- Clip nào thiếu ảnh tham chiếu sẽ tự bị bỏ qua và báo trong phần tóm tắt.
- Clip đã có mp4 sẽ tự bỏ qua, nên chạy lại sau khi bị ngắt kết nối không mất công.`),
  code(`!python /content/video_gen/comfy_batch.py --server http://127.0.0.1:8188 --out {OUT} --priority 1 --variants 2 --keep-frames`),

  md(`## 9. (Tuỳ chọn) MiniMax H3 qua ComfyUI API node
Cần **COMFY_API_KEY** (tạo ở platform.comfy.org, có credit). Lưu vào Colab: biểu tượng 🔑 (Secrets) → thêm \`COMFY_API_KEY\` → bật "Notebook access".
Mặc định dùng \`MiniMax H3 Max Turbo\` 768P (đổi trong \`clips.json → backends.h3\`). Giá xem trên node trong ComfyUI trước khi chạy cả loạt.`),
  code(`from google.colab import userdata
os.environ["COMFY_API_KEY"] = userdata.get("COMFY_API_KEY")
!python /content/video_gen/comfy_batch.py --server http://127.0.0.1:8188 --backend h3 --out {OUT} --only run`),

  md(`## 10. Sau khi xong
Kết quả ở Google Drive: \`MyDrive/kitten_video/<id>/<id>_<backend>_s<seed>.mp4\`.
Chọn bản đẹp nhất, đổi tên thành \`<id>.mp4\`, bỏ vào thư mục \`Video/\` của dự án rồi chạy \`bash tools/build_sprites.sh\`.`),
];

const nb = {
  cells,
  metadata: {
    colab: { provenance: [], gpuType: 'L4' },
    accelerator: 'GPU',
    kernelspec: { name: 'python3', display_name: 'Python 3' },
    language_info: { name: 'python' },
  },
  nbformat: 4,
  nbformat_minor: 5,
};
fs.writeFileSync(path.join(__dirname, 'colab_comfyui.ipynb'), JSON.stringify(nb, null, 1));
console.log('wrote colab_comfyui.ipynb with', cells.length, 'cells');
