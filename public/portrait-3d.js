// The maths behind the 3D portrait: sampling its depth map, finding which point of the portrait lands on a
// screen cell when the face turns, and how much a light moves a point's brightness. portrait.js uses it;
// it is also a CommonJS module so `node --test` can check it.
(function (root) {
  // Depth at a point of the full portrait grid (0 far .. 1 near), bilinear between the stored samples.
  // depth = { w, h, scale, data }: a w x h byte grid, one sample every `scale` grid points.
  function depthAt(depth, x, y) {
    const { w, h, scale, data } = depth, u = x / scale, v = y / scale;
    if (!(u >= 0 && v >= 0 && u <= w - 1 && v <= h - 1)) return 0;
    const i = Math.min(w - 2, u | 0), j = Math.min(h - 2, v | 0), fu = u - i, fv = v - j, k = j * w + i;
    const top = data[k] + (data[k + 1] - data[k]) * fu, bottom = data[k + w] + (data[k + w + 1] - data[k + w]) * fu;
    return (top + (bottom - top) * fv) / 255;
  }

  const api = { depthAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Portrait3D = api;
})(this);
