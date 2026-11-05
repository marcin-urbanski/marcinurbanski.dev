# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "torch", "transformers"]
# ///
"""Depth map for the ASCII portrait, run once offline; nothing here ships to the browser.

Reads the 320x393 brightness grid (lum) from public/portrait-data.json, estimates depth with Depth Anything V2
Small, fills the holes left by black lines inside the face (eyes, mouth), and writes the depth at half resolution
(one sample every 2 grid points) back into portrait-data.json as depth, base64 like lum.

    uv run tools/portrait-depth.py          # rewrites depth in public/portrait-data.json
    python3 tools/portrait-depth.py --check # only prints the grid sizes in portrait-data.json
"""
import base64
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "public" / "portrait-data.json"


def check(data):
    for name in ("lum", "depth"):
        grid = data[name]
        size = len(base64.b64decode(grid["b64"]))
        print(f"{name}: {grid['w']}x{grid['h']}, {size} bytes" + ("" if size == grid["w"] * grid["h"] else " (size mismatch)"))


def depth_of(lum_grid, scale):
    """The depth grid (one sample every `scale` grid points) for a brightness grid, as w, h and base64."""
    import numpy as np
    from PIL import Image, ImageFilter
    from transformers import pipeline

    W, H = lum_grid["w"], lum_grid["h"]
    lum = np.frombuffer(base64.b64decode(lum_grid["b64"]), np.uint8).reshape(H, W)

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

    # One sample every `scale` grid points: sample (i, j) is grid point (i * scale, j * scale).
    hw, hh = (W - 1) // scale + 1, (H - 1) // scale + 1
    half = d[: hh * scale : scale, : hw * scale : scale].astype(np.uint8)
    return {"w": hw, "h": hh, "scale": scale, "b64": base64.b64encode(half.tobytes()).decode()}


if __name__ == "__main__":
    data = json.loads(DATA.read_text())
    if "--check" not in sys.argv[1:]:
        data["depth"] = depth_of(data["lum"], 2)
        DATA.write_text(json.dumps(data, indent=2) + "\n")
    check(data)
