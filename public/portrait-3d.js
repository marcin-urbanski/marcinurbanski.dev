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

  // The portrait grid point drawn at (x, y) when the face is turned. Turning draws a point at depth d
  // (d - .5) * (shx, shy) grid points away from its flat place, so near points (the nose) move with the turn
  // and far ones (the ears) against it; a few fixed-point steps find the point that lands on (x, y).
  function sourcePoint(depth, x, y, shx, shy) {
    let sx = x, sy = y;
    for (let n = 0; n < 4; n++) {
      const z = depthAt(depth, sx, sy) - .5;
      sx = x - shx * z; sy = y - shy * z;
    }
    return [sx, sy];
  }

  // Unit surface normal [nx, ny, nz] at a grid point, from the slope of the depth map (y grows downwards).
  const SLOPE = 23;   // how far a depth slope tilts the normal; the face is about 300 grid points wide and deep
  function normalAt(depth, x, y) {
    const s = depth.scale;
    const gx = (depthAt(depth, x + s, y) - depthAt(depth, x - s, y)) / (2 * s) * SLOPE;
    const gy = (depthAt(depth, x, y + s) - depthAt(depth, x, y - s)) / (2 * s) * SLOPE;
    const l = Math.hypot(gx, gy, 1);
    return [-gx / l || 0, -gy / l || 0, 1 / l];
  }

  // How much a light from direction l (any length; z towards the viewer) scales brightness at normal n.
  // Only the change against a light straight ahead counts, so with the light in front the face is as drawn.
  function lightFactor(n, l, strength) {
    const ll = Math.hypot(l[0], l[1], l[2]);
    return 1 + strength * ((n[0] * l[0] + n[1] * l[1] + n[2] * l[2]) / ll - n[2]);
  }

  const api = { depthAt, sourcePoint, normalAt, lightFactor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Portrait3D = api;
})(this);
