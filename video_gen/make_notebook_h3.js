// Sinh video_gen/colab_h3_a100.ipynb:  node video_gen/make_notebook_h3.js
// Notebook chạy MiniMax H3 cục bộ trong ComfyUI trên A100 (dựa trên notebook mẫu của bạn), gọi comfy_batch.py qua API.
const fs = require('fs'), path = require('path');

const lines = (s) => s.split('\n').map((l, i, a) => (i < a.length - 1 ? l + '\n' : l));
const md = (s) => ({ cell_type: 'markdown', metadata: {}, source: lines(s) });
const code = (s) => ({ cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: lines(s) });

const cells = [
  md(`# 🐱 Kitten Pomodoro — video mèo bằng MiniMax H3 (cục bộ) trên A100

Chạy **MiniMax H3** mã nguồn mở (\`Comfy-Org/MiniMax-H3\`) trong ComfyUI, khung đầu + khung cuối, nền xanh, rồi gọi \`video_gen/comfy_batch.py\` chạy hàng loạt clip trong \`clips.json\`.
Prompt được dựng theo định dạng có cấu trúc + timeline giống notebook mẫu (subject_definitions / summary / retention_analysis / detailed_description).

- Runtime → Change runtime type → **A100 GPU**.
- Model lưu ở Drive (\`ComfyUI_H3_models\`) nên các phiên sau không phải tải lại.
- Mặc định 1344×768, 24fps, \`quality = "full"\` (20 bước). Muốn nhanh hơn: \`"turbo"\` (LoRA 8-step, 6 bước).`),

  md('## 1. Kiểm tra GPU'),
  code(`import subprocess, torch
print(subprocess.check_output(["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"], text=True))
print("PyTorch:", torch.__version__, "| CUDA:", torch.version.cuda, "| available:", torch.cuda.is_available())
if not torch.cuda.is_available():
    raise RuntimeError("Chưa bật GPU: Runtime > Change runtime type > A100 GPU.")
name = torch.cuda.get_device_name(0)
print("OK:", name) if "A100" in name else print("CẢNH BÁO: runtime là", name, "không phải A100.")
!apt-get -qq install -y ffmpeg > /dev/null`),

  md(`## 2. Cấu hình + Google Drive + mã nguồn

- \`SOURCE = "github"\`: clone repo (cần đã push \`video_gen/\`). Hoặc \`"drive"\`: copy \`video_gen\` lên \`MyDrive/kitten_video_gen\`.
- \`MODEL_VARIANT\`: \`"int8"\` (khuyên dùng, như notebook mẫu) hoặc \`"fp8"\` nếu int8 lỗi.
- \`QUALITY\`: \`"full"\` hoặc \`"turbo"\`.`),
  code(`from google.colab import drive
drive.mount("/content/drive")

SOURCE = "github"          # "github" | "drive"
REPO = "https://github.com/DanielQH07/Kitten-Pomodoro.git"
MODEL_VARIANT = "int8"     # "int8" | "fp8"
QUALITY = "full"           # "full" | "turbo"

COMFY_ROOT = "/content/ComfyUI"
DRIVE_MODEL_ROOT = "/content/drive/MyDrive/ComfyUI_H3_models"
OUT = "/content/drive/MyDrive/kitten_video_h3"     # kết quả mp4 lưu ở đây

import os, shutil
os.makedirs(OUT, exist_ok=True); os.makedirs(DRIVE_MODEL_ROOT, exist_ok=True)
if os.path.exists("/content/video_gen"): shutil.rmtree("/content/video_gen")
if SOURCE == "github":
    !git clone --depth 1 {REPO} /content/_repo
    shutil.copytree("/content/_repo/video_gen", "/content/video_gen")
else:
    shutil.copytree("/content/drive/MyDrive/kitten_video_gen", "/content/video_gen")
!ls /content/video_gen /content/video_gen/refs`),

  md('## 3. Cài ComfyUI (bản mới nhất, có sẵn node MiniMax H3)'),
  code(`import os, subprocess, sys
from pathlib import Path
if not Path(COMFY_ROOT).exists():
    subprocess.run(["git", "clone", "--depth", "1", "https://github.com/Comfy-Org/ComfyUI.git", COMFY_ROOT], check=True)
else:
    subprocess.run(["git", "-C", COMFY_ROOT, "pull", "--ff-only"], check=True)
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", f"{COMFY_ROOT}/requirements.txt"], check=True)
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-U", "huggingface_hub", "hf_xet"], check=True)
if not Path(COMFY_ROOT, "comfy_extras", "nodes_minimax_h3.py").exists():
    raise RuntimeError("ComfyUI chưa có node MiniMax H3: hãy cập nhật ComfyUI lên bản mới nhất.")
print("ComfyUI sẵn sàng:", COMFY_ROOT)`),

  md(`## 4. Tải model từ Hugging Face (lưu cache ở Drive)
Danh sách nằm trong \`clips.json → models_h3local\`. File lớn (text encoder Qwen3-VL 32B + DiT), lần đầu tải mất vài chục phút.`),
  code(`import json
from huggingface_hub import hf_hub_download
cfg = json.load(open("/content/video_gen/clips.json", encoding="utf-8"))
for m in cfg["models_h3local"]:
    if m.get("variant") and m["variant"] != MODEL_VARIANT: continue
    if m.get("optional") and m["optional"] != QUALITY: continue
    target = Path(DRIVE_MODEL_ROOT) / m["dir"] / m["file"]
    if target.exists() and target.stat().st_size > 0:
        print("đã có:", target.name)
    else:
        print("tải:", m["repo"], "/", m["path"])
        target.parent.mkdir(parents=True, exist_ok=True)
        got = hf_hub_download(repo_id=m["repo"], filename=m["path"], local_dir=str(Path(DRIVE_MODEL_ROOT) / "_dl"))
        shutil.move(got, target)
    dest_dir = Path(COMFY_ROOT) / "models" / m["dir"]; dest_dir.mkdir(parents=True, exist_ok=True)
    link = dest_dir / m["file"]
    if link.is_symlink() or link.exists(): link.unlink()
    link.symlink_to(target)
print("xong")`),

  md(`## 5. Bật ComfyUI (chạy nền, không cần ngrok vì runner gọi qua localhost)
Nếu lỗi hết VRAM thử \`QUALITY = "turbo"\` hoặc thêm \`"--lowvram"\` vào danh sách tham số.`),
  code(`import subprocess, time, urllib.request
log = open("/content/comfyui.log", "w")
server = subprocess.Popen(
    ["python", "main.py", "--listen", "127.0.0.1", "--port", "8188", "--disable-auto-launch"],
    cwd=COMFY_ROOT, stdout=log, stderr=subprocess.STDOUT)
for i in range(180):
    try:
        urllib.request.urlopen("http://127.0.0.1:8188/system_stats", timeout=2); print("ComfyUI sẵn sàng sau", i * 2, "giây"); break
    except Exception:
        time.sleep(2)
else:
    print(open("/content/comfyui.log").read()[-4000:])`),

  md('## 6. Kiểm tra node + xem danh sách clip (khung/giây theo H3)'),
  code(`!python /content/video_gen/comfy_batch.py --backend h3local --check
!python /content/video_gen/comfy_batch.py --backend h3local --list`),

  md(`## 7. Chạy thử 1 clip: \`pounce\`
Xem kết quả ở ô sau rồi mới chạy cả loạt.`),
  code(`!python /content/video_gen/comfy_batch.py --backend h3local --quality {QUALITY} --variant {MODEL_VARIANT} --out {OUT} --only pounce --keep-frames`),
  code(`from IPython.display import Video, display
import glob
f = sorted(glob.glob(OUT + "/pounce/*.mp4")); print(f)
if f: display(Video(f[-1], embed=True, width=720))`),

  md(`## 8. Chạy cả loạt
- \`--priority 1\`: nhóm ưu tiên 1 (run, crouch_wiggle, pounce, held_dangle, land, pet). Đổi 2 hoặc 3 để chạy thêm.
- \`--only a,b,c\`: chỉ chạy các clip chỉ định (vd chạy lại clip lỗi).
- \`--variants 2\`: mỗi clip 2 seed để chọn bản đẹp.
- Clip nào có mp4 rồi sẽ tự bỏ qua (thêm \`--force\` để chạy lại).`),
  code(`!python /content/video_gen/comfy_batch.py --backend h3local --quality {QUALITY} --variant {MODEL_VARIANT} --out {OUT} --priority 1 --variants 2 --keep-frames`),

  md(`## 9. Sau khi xong
Kết quả: \`MyDrive/kitten_video_h3/<id>/<id>_h3local_s<seed>.mp4\` (và thư mục \`*_frames\` PNG không nén).
Chọn bản đẹp nhất, đổi tên \`<id>.mp4\`, bỏ vào \`Video/\` của dự án, rồi \`bash tools/build_sprites.sh\`.

Xem log khi lỗi:`),
  code(`print(open("/content/comfyui.log", errors="ignore").read()[-12000:])`),
];

const nb = {
  cells,
  metadata: {
    colab: { provenance: [], gpuType: 'A100' },
    accelerator: 'GPU',
    kernelspec: { name: 'python3', display_name: 'Python 3' },
    language_info: { name: 'python' },
  },
  nbformat: 4,
  nbformat_minor: 5,
};
fs.writeFileSync(path.join(__dirname, 'colab_h3_a100.ipynb'), JSON.stringify(nb, null, 1));
console.log('wrote colab_h3_a100.ipynb with', cells.length, 'cells');
