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
  // and far ones (the ears) against it; a few fixed-point steps find the point that lands on (x, y). Where
  // depth jumps (the edge of the face) the mapping folds over and the steps only get close, which reads as
  // a slight softening of the outline.
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

  // Easing towards a target, .08 of the way a 60fps frame, over dt such frames (as EffectsCore.lerp), so the
  // turn has the same speed at any refresh rate; lands exactly on the target once close, so at rest the face
  // is exactly flat.
  function ease(v, target, dt = 1) {
    return Math.abs(target - v) < 1e-3 ? target : v + (target - v) * (1 - (1 - .08) ** dt);
  }

  // Position p as -1 .. 1 from centre c to the edge of 0 .. size on that side, so the turn reaches its
  // full size both ways even when the face is off-centre.
  function toEdge(p, c, size) {
    return (p - c) / Math.max(1, p > c ? size - c : c);
  }

  // README "ASCII portrait": where the face sits in a w x h hero and its font size; asp = face width / height.
  // Desktop: anchored right and bottom. Under 760px: centred near the top.
  function portraitLayout(w, h, asp) {
    const mobile = w < 760;
    const ph = mobile ? Math.min(h * .6, w * .9 / asp) : Math.min(h - 120, w * .42 / asp), pw = ph * asp;
    return {
      x: mobile ? (w - pw) / 2 : w - pw - Math.max(16, w * .04),
      y: mobile ? 64 : h - ph - 48,
      pw, ph,
      fontPx: mobile ? 5.5 : w < 1100 ? 6 : 7
    };
  }

  // How much of a cell at height cy is kept as the face of height ph dissolves towards its bottom:
  // 1 above the bottom 22%, falling to 0 at the bottom and below it.
  function faceFade(cy, bottom, ph) {
    return Math.max(0, Math.min(1, (bottom - cy) / (ph * .22)));
  }

  // README "Background field": the character at field cell (col, row) at t seconds: "+" where the wave sum
  // is above 1.78, "·" above 1.52, otherwise "" (nothing drawn).
  function fieldChar(col, row, t) {
    const n = Math.sin(col * .09 + t * .35) * Math.cos(row * .16 - t * .25) + Math.sin((col - row) * .045 + t * .18);
    return n > 1.78 ? "+" : n > 1.52 ? "·" : "";
  }

  // Whether (x, y) is strictly inside any of the boxes { left, top, right, bottom } grown by padX and padY on
  // each side: the headline line boxes under which the portrait dims.
  function inRects(x, y, rects, padX, padY) {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x > r.left - padX && x < r.right + padX && y > r.top - padY && y < r.bottom + padY) return true;
    }
    return false;
  }

  // The background field cells (fcols x frows, each fcw x fch px) to leave out: those whose top-left falls in a
  // face cell (cols x rows, each cw x ch px) that `cover` marks, so the field never shows through the face.
  // Cells map with Math.floor, as the design's `|0` (.dc.html:536).
  function fieldMask(cover, cols, rows, cw, ch, fcw, fch, fcols, frows) {
    const mask = new Uint8Array(fcols * frows);
    for (let r = 0; r < frows; r++) for (let c = 0; c < fcols; c++) {
      const x = Math.floor(c * fcw / cw), y = Math.floor(r * fch / ch);
      if (x < cols && y < rows && cover[y * cols + x]) mask[r * fcols + c] = 1;
    }
    return mask;
  }

  const api = { depthAt, sourcePoint, normalAt, lightFactor, ease, toEdge, portraitLayout, faceFade, fieldChar, inRects, fieldMask };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Portrait3D = api;
})(this);
