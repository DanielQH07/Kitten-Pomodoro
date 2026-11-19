#!/usr/bin/env python3
"""Tạo hàng loạt video mèo qua ComfyUI (Wan 2.2 trên GPU / MiniMax H3 qua API node).

Đọc video_gen/clips.json, với mỗi clip: upload ảnh đầu/cuối -> dựng workflow -> gửi /prompt
-> chờ -> tải kết quả về --out/<id>/<id>_<backend>_s<seed>.mp4.  Chỉ dùng thư viện chuẩn.

Ví dụ:
  python comfy_batch.py --list
  python comfy_batch.py --dry-run --only run                 # in workflow, không cần server
  python comfy_batch.py --check                              # kiểm tra node/model trên server
  python comfy_batch.py --only run,pounce --variants 3       # Wan 2.2, mỗi clip 3 seed
  python comfy_batch.py --backend h3 --priority 1            # MiniMax H3 (cần COMFY_API_KEY)
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))


# --------------------------------------------------------------------------- config
def load_cfg(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def full_prompt(cfg, clip):
    g = cfg["global"]
    prefix = g["prefix"].replace("{character}", g["character"])
    return f"{prefix} {clip['prompt']} {g['suffix']}".strip()


def negative_prompt(cfg):
    g = cfg["global"]
    return f"{g['negative_cn']}，{g['negative_en']}"


def select_clips(cfg, args):
    clips = cfg["clips"]
    if args.only:
        wanted = [s.strip() for s in args.only.split(",") if s.strip()]
        unknown = [w for w in wanted if w not in {c["id"] for c in clips}]
        if unknown:
            sys.exit(f"Không có clip: {', '.join(unknown)}  (dùng --list để xem)")
        clips = [c for c in clips if c["id"] in wanted]
    if args.priority:
        clips = [c for c in clips if c.get("priority", 9) <= args.priority]
    return clips


# --------------------------------------------------------------------------- workflows
def node(class_type, **inputs):
    return {"class_type": class_type, "inputs": inputs}


def wan_workflow(cfg, clip, start_img, end_img, seed, save_prefix):
    """Wan 2.2 14B I2V, first+last frame (dựa trên template chính thức video_wan2_2_14B_flf2v)."""
    g, b = cfg["global"], cfg["backends"]["wan"]
    width, height = g["resolution"]
    length = clip.get("frames", g["length"])
    if (length - 1) % 4 != 0:
        raise ValueError(f"{clip['id']}: frames phải có dạng 4n+1 (33, 49, 65, 81), đang là {length}")
    fast = b.get("quality", "lightx2v") == "lightx2v"
    steps, cfg_scale, split, shift = (4, 1.0, 2, 5.0) if fast else (20, 4.0, 10, 8.0)

    wf = {
        "1": node("UNETLoader", unet_name=b["unet_high"], weight_dtype="default"),
        "2": node("UNETLoader", unet_name=b["unet_low"], weight_dtype="default"),
        "7": node("CLIPLoader", clip_name=b["clip"], type="wan", device="default"),
        "8": node("VAELoader", vae_name=b["vae"]),
        "9": node("CLIPTextEncode", text=full_prompt(cfg, clip), clip=["7", 0]),
        "10": node("CLIPTextEncode", text=negative_prompt(cfg), clip=["7", 0]),
        "11": node("LoadImage", image=start_img),
        "12": node("LoadImage", image=end_img),
    }
    high, low = "1", "2"
    if fast:  # LoRA lightx2v 4 bước
        wf["3"] = node("LoraLoaderModelOnly", model=["1", 0], lora_name=b["lora_high"], strength_model=1.0)
        wf["4"] = node("LoraLoaderModelOnly", model=["2", 0], lora_name=b["lora_low"], strength_model=1.0)
        high, low = "3", "4"
    wf["5"] = node("ModelSamplingSD3", model=[high, 0], shift=shift)
    wf["6"] = node("ModelSamplingSD3", model=[low, 0], shift=shift)
    wf["13"] = node("WanFirstLastFrameToVideo", positive=["9", 0], negative=["10", 0], vae=["8", 0],
                    width=width, height=height, length=length, batch_size=1,
                    start_image=["11", 0], end_image=["12", 0])
    common = dict(steps=steps, cfg=cfg_scale, sampler_name="euler", scheduler="simple")
    wf["14"] = node("KSamplerAdvanced", model=["5", 0], add_noise="enable", noise_seed=seed,
                    positive=["13", 0], negative=["13", 1], latent_image=["13", 2],
                    start_at_step=0, end_at_step=split, return_with_leftover_noise="enable", **common)
    wf["15"] = node("KSamplerAdvanced", model=["6", 0], add_noise="disable", noise_seed=0,
                    positive=["13", 0], negative=["13", 1], latent_image=["14", 0],
                    start_at_step=split, end_at_step=10000, return_with_leftover_noise="disable", **common)
    wf["16"] = node("VAEDecode", samples=["15", 0], vae=["8", 0])
    wf["17"] = node("SaveImage", images=["16", 0], filename_prefix=save_prefix)
    return wf


def h3_workflow(cfg, clip, start_img, end_img, seed, save_prefix):
    """MiniMax H3 First-Last-Frame to Video (API node của ComfyUI)."""
    g, b = cfg["global"], cfg["backends"]["h3"]
    model = b["model"]
    is_max = model != "MiniMax H3"
    seconds = math.ceil(clip.get("frames", g["length"]) / g["fps"])
    lo = 5 if is_max else 4
    duration = max(lo, min(15, seconds))
    resolution = b["resolution"]
    allowed = ["480P", "768P"] if is_max else ["768P", "2K"]
    if resolution not in allowed:
        raise ValueError(f"model '{model}' chỉ hỗ trợ resolution {allowed}, đang là {resolution}")
    inputs = {
        "model": model,
        "model.prompt": full_prompt(cfg, clip),
        "model.resolution": resolution,
        "model.duration": duration,
        "first_frame": ["11", 0],
        "last_frame": ["12", 0],
        "seed": seed,
        "watermark": False,
    }
    if is_max:
        inputs["model.prompt_expansion_mode"] = b.get("prompt_expansion_mode", "balanced")
    return {
        "11": node("LoadImage", image=start_img),
        "12": node("LoadImage", image=end_img),
        "13": {"class_type": "MinimaxHailuo03FirstLastFrameNode", "inputs": inputs},
        "14": {"class_type": "SaveVideo", "inputs": {"video": ["13", 0], "filename_prefix": save_prefix,
                                                      "format": "mp4", "format.codec": "auto"}},
    }


BUILDERS = {"wan": wan_workflow, "h3": h3_workflow}
REQUIRED_NODES = {
    "wan": ["UNETLoader", "LoraLoaderModelOnly", "ModelSamplingSD3", "CLIPLoader", "VAELoader", "CLIPTextEncode",
            "LoadImage", "WanFirstLastFrameToVideo", "KSamplerAdvanced", "VAEDecode", "SaveImage"],
    "h3": ["LoadImage", "MinimaxHailuo03FirstLastFrameNode", "SaveVideo"],
}


# --------------------------------------------------------------------------- ComfyUI HTTP client
class Comfy:
    def __init__(self, server, api_key=None):
        self.base = server.rstrip("/")
        self.api_key = api_key
        self.client_id = uuid.uuid4().hex

    def _req(self, method, path, data=None, headers=None, timeout=120):
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            raise RuntimeError(f"HTTP {e.code} {method} {path}: {body[:1500]}") from None

    def get_json(self, path):
        return json.loads(self._req("GET", path))

    def upload_image(self, filepath):
        boundary = uuid.uuid4().hex
        name = os.path.basename(filepath)
        with open(filepath, "rb") as f:
            blob = f.read()
        parts = []
        for k, v in (("type", "input"), ("overwrite", "true")):
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        parts.append((f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\n'
                      f'Content-Type: image/png\r\n\r\n').encode() + blob + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        res = json.loads(self._req("POST", "/upload/image", b"".join(parts),
                                   {"Content-Type": f"multipart/form-data; boundary={boundary}"}))
        return f"{res['subfolder']}/{res['name']}" if res.get("subfolder") else res["name"]

    def queue(self, workflow, use_api_key=False):
        body = {"prompt": workflow, "client_id": self.client_id}
        if use_api_key:
            body["extra_data"] = {"api_key_comfy_org": self.api_key}
        res = json.loads(self._req("POST", "/prompt", json.dumps(body).encode(), {"Content-Type": "application/json"}))
        if res.get("node_errors"):
            raise RuntimeError("node_errors: " + json.dumps(res["node_errors"], ensure_ascii=False)[:1500])
        return res["prompt_id"]

    def wait(self, prompt_id, timeout):
        t0, last = time.time(), 0
        while time.time() - t0 < timeout:
            hist = self.get_json(f"/history/{prompt_id}")
            if prompt_id in hist:
                h = hist[prompt_id]
                st = h.get("status", {})
                if st.get("status_str") == "error":
                    msgs = [m for m in st.get("messages", []) if m and m[0] == "execution_error"]
                    raise RuntimeError("Lỗi ComfyUI: " + json.dumps(msgs[-1][1] if msgs else st, ensure_ascii=False)[:1500])
                if st.get("completed") or h.get("outputs"):
                    return h
            if time.time() - last > 30:
                print(f"    ... đang chạy {int(time.time() - t0)}s", flush=True)
                last = time.time()
            time.sleep(4)
        raise TimeoutError(f"Quá {timeout}s chưa xong")

    def download(self, item):
        q = urllib.parse.urlencode({"filename": item["filename"], "subfolder": item.get("subfolder", ""),
                                    "type": item.get("type", "output")})
        return self._req("GET", "/view?" + q, timeout=600)


def collect_outputs(history):
    items = []
    for out in history.get("outputs", {}).values():
        for key in ("images", "videos", "gifs"):
            items.extend(out.get(key, []))
    return sorted(items, key=lambda i: i["filename"])


def frames_to_mp4(frame_files, fps, dest):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("Không có ffmpeg để ghép khung hình (Colab có sẵn: !apt-get install -y ffmpeg)")
    with tempfile.TemporaryDirectory() as tmp:
        for i, p in enumerate(frame_files, 1):
            shutil.copy(p, os.path.join(tmp, f"f{i:05d}.png"))
        subprocess.run([ffmpeg, "-v", "error", "-y", "-framerate", str(fps), "-i", os.path.join(tmp, "f%05d.png"),
                        "-c:v", "libx264", "-preset", "slow", "-crf", "10", "-pix_fmt", "yuv420p", dest], check=True)


# --------------------------------------------------------------------------- main
def run_clip(cfg, clip, backend, seed, comfy, args):
    refs = cfg["refs"]
    for key in (clip["start"], clip["end"]):
        path = os.path.join(HERE, refs[key]["file"])
        if not os.path.exists(path):
            return f"thiếu ảnh tham chiếu '{key}' ({refs[key]['file']}); xem refs.{key}.generate trong clips.json"
    out_dir = os.path.join(args.out, clip["id"])
    dest = os.path.join(out_dir, f"{clip['id']}_{backend}_s{seed}.mp4")
    if os.path.exists(dest) and not args.force:
        return f"bỏ qua (đã có {os.path.basename(dest)})"
    os.makedirs(out_dir, exist_ok=True)

    start = comfy.upload_image(os.path.join(HERE, refs[clip["start"]]["file"]))
    end = start if clip["end"] == clip["start"] else comfy.upload_image(os.path.join(HERE, refs[clip["end"]]["file"]))
    prefix = f"kitten/{clip['id']}_{backend}_s{seed}"
    wf = BUILDERS[backend](cfg, clip, start, end, seed, prefix)
    pid = comfy.queue(wf, use_api_key=(backend == "h3"))
    print(f"    prompt_id {pid}", flush=True)
    hist = comfy.wait(pid, args.timeout)

    items = collect_outputs(hist)
    if not items:
        raise RuntimeError("ComfyUI không trả file đầu ra")
    if items[0]["filename"].lower().endswith((".mp4", ".webm", ".mov", ".mkv")):
        with open(dest, "wb") as f:
            f.write(comfy.download(items[0]))
    else:  # chuỗi ảnh PNG (Wan) -> mp4
        with tempfile.TemporaryDirectory() as tmp:
            files = []
            for i, it in enumerate(items):
                p = os.path.join(tmp, f"{i:05d}.png")
                with open(p, "wb") as f:
                    f.write(comfy.download(it))
                files.append(p)
            if args.keep_frames:
                fdir = os.path.join(out_dir, f"{clip['id']}_{backend}_s{seed}_frames")
                os.makedirs(fdir, exist_ok=True)
                for p in files:
                    shutil.copy(p, fdir)
            frames_to_mp4(files, cfg["global"]["fps"], dest)
    return f"xong -> {dest}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=os.path.join(HERE, "clips.json"))
    ap.add_argument("--server", default="http://127.0.0.1:8188")
    ap.add_argument("--out", default=os.path.join(HERE, "output"))
    ap.add_argument("--backend", choices=list(BUILDERS), default="wan")
    ap.add_argument("--only", help="id clip, cách nhau dấu phẩy")
    ap.add_argument("--priority", type=int, help="chỉ chạy clip có priority <= N")
    ap.add_argument("--variants", type=int, default=1, help="số seed khác nhau cho mỗi clip")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="in workflow JSON rồi thoát (không cần server)")
    ap.add_argument("--check", action="store_true", help="kiểm tra server có đủ node cần thiết")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--keep-frames", action="store_true", help="giữ chuỗi PNG không nén (Wan)")
    ap.add_argument("--timeout", type=int, default=3600, help="giây tối đa cho mỗi clip")
    ap.add_argument("--api-key", default=os.environ.get("COMFY_API_KEY"))
    args = ap.parse_args()
    for stream in (sys.stdout, sys.stderr):  # console Windows mặc định không phải UTF-8
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    cfg = load_cfg(args.config)
    clips = select_clips(cfg, args)

    if args.list:
        print(f"{'id':16} pri  {'đầu':12} {'cuối':12} khung  dùng cho")
        for c in clips:
            miss = [k for k in (c["start"], c["end"]) if not os.path.exists(os.path.join(HERE, cfg["refs"][k]["file"]))]
            flag = "  [thiếu ảnh: " + ",".join(sorted(set(miss))) + "]" if miss else ""
            print(f"{c['id']:16} {c.get('priority', '-')!s:4} {c['start']:12} {c['end']:12} {c.get('frames', 81):4}   {c.get('used_for', '')}{flag}")
        return

    if args.dry_run:
        c = clips[0]
        wf = BUILDERS[args.backend](cfg, c, "start.png", "end.png", cfg["global"]["seed"], f"kitten/{c['id']}")
        print(json.dumps(wf, ensure_ascii=False, indent=2))
        return

    if args.backend == "h3" and not args.api_key:
        sys.exit("Backend h3 cần COMFY_API_KEY (tạo ở platform.comfy.org) hoặc --api-key")
    comfy = Comfy(args.server, args.api_key)

    if args.check:
        missing = []
        for cls in REQUIRED_NODES[args.backend]:
            try:
                comfy.get_json(f"/object_info/{cls}")
            except Exception:
                missing.append(cls)
        print("Thiếu node: " + ", ".join(missing) if missing else f"OK: đủ node cho backend {args.backend}")
        return

    results = []
    for clip in clips:
        for v in range(args.variants):
            seed = cfg["global"]["seed"] + v
            print(f"[{clip['id']}] backend={args.backend} seed={seed}", flush=True)
            try:
                msg = run_clip(cfg, clip, args.backend, seed, comfy, args)
            except Exception as e:  # tiếp tục các clip còn lại
                msg = f"LỖI: {e}"
            print(f"    {msg}", flush=True)
            results.append((clip["id"], seed, msg))
    print("\n== Tóm tắt ==")
    for cid, seed, msg in results:
        print(f"{cid:16} s{seed}  {msg}")


if __name__ == "__main__":
    main()
