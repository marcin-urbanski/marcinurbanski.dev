# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "torch", "transformers"]
# ///
"""Depth map for the ASCII portrait, run once offline; nothing here ships to the browser.

Reads the 320x393 brightness grid from public/portrait.js, estimates depth with Depth Anything V2 Small,
fills the holes left by black lines inside the face (eyes, mouth), and prints the depth at half resolution
(one sample every 2 grid points) as base64, ready to paste into DEPTH in public/portrait.js.

    uv run tools/portrait-depth.py > /tmp/depth.txt
"""
import base64
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from transformers import pipeline

W, H, SCALE = 320, 393, 2

src = (Path(__file__).resolve().parent.parent / "public" / "portrait.js").read_text()
lum = np.frombuffer(base64.b64decode(re.search(r'atob\("([^"]+)"\)', src).group(1)), np.uint8)[: W * H].reshape(H, W)

img = Image.fromarray(lum).convert("RGB")
pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf")
raw = pipe(img.resize((W * 2, H * 2), Image.LANCZOS))["predicted_depth"].squeeze().cpu().numpy().astype(np.float32)
raw = np.array(Image.fromarray(raw).resize((W, H), Image.BILINEAR))

# The face silhouette, closed so thin black lines inside it still count as face.
mask = np.array(Image.fromarray(((lum > 0) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))) > 0
lo, hi = np.percentile(raw[lum > 0], 2), np.percentile(raw[lum > 0], 99.5)
d = (np.clip((raw - lo) / (hi - lo), 0, 1) * 255) * (lum > 0)

# Fill the black lines from their neighbours, then soften.
filled = np.array(Image.fromarray(d.astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5)), np.float32)
hole = mask & (lum == 0)
d[hole] = filled[hole]
d = np.array(Image.fromarray(d.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), np.float32)
d[~mask] = 0

# One sample every SCALE grid points: sample (i, j) is grid point (i * SCALE, j * SCALE).
hw, hh = (W - 1) // SCALE + 1, (H - 1) // SCALE + 1
half = d[: hh * SCALE : SCALE, : hw * SCALE : SCALE].astype(np.uint8)
print(f"// {hw} x {hh}", file=sys.stderr)
print(base64.b64encode(half.tobytes()).decode())
