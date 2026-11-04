const test = require("node:test");
const assert = require("node:assert/strict");
const { depthAt, sourcePoint, normalAt, lightFactor, ease, toEdge, portraitLayout, faceFade, fieldChar, inRects, cellInZones, fieldMask } = require("../public/portrait-3d.js");

// A 3 x 2 depth grid, one sample every 2 portrait grid points.
const depth = { w: 3, h: 2, scale: 2, data: Uint8Array.from([0, 51, 255, 102, 153, 204]) };

test("depthAt returns the stored sample at a sample point", () => {
  assert.equal(depthAt(depth, 2, 0), 51 / 255);
  assert.equal(depthAt(depth, 4, 2), 204 / 255);
});

test("depthAt interpolates between samples", () => {
  assert.ok(Math.abs(depthAt(depth, 1, 0) - 25.5 / 255) < 1e-9);
  assert.ok(Math.abs(depthAt(depth, 3, 1) - (51 + 255 + 153 + 204) / 4 / 255) < 1e-9);
});

test("depthAt is 0 outside the grid", () => {
  assert.equal(depthAt(depth, -1, 0), 0);
  assert.equal(depthAt(depth, 0, 3), 0);
  assert.equal(depthAt(depth, 5, 0), 0);
});

// 20 x 20 samples, one per grid point.
const grid = fill => ({ w: 20, h: 20, scale: 1, data: Uint8Array.from({ length: 400 }, (_, k) => fill(k % 20, (k / 20) | 0)) });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("sourcePoint leaves the face in place when it is not turned", () => {
  assert.deepEqual(sourcePoint(grid(() => 255), 10, 10, 0, 0), [10, 10]);
});

test("sourcePoint draws a near point shifted with the turn", () => {
  // depth 1 everywhere: the point drawn at x = 10 comes from half a shift to the left
  const [sx, sy] = sourcePoint(grid(() => 255), 10, 10, 4, -2);
  assert.ok(near(sx, 8) && near(sy, 11), `${sx}, ${sy}`);
});

test("sourcePoint finds the point that lands on the cell on a slope", () => {
  const slope = grid(x => x * 13);                 // nearer to the right
  const [sx, sy] = sourcePoint(slope, 10, 10, 6, 0);
  const landsAt = sx + 6 * (depthAt(slope, sx, sy) - .5);
  assert.ok(near(landsAt, 10, .05), `lands at ${landsAt}`);
});

test("normalAt faces the viewer on a flat surface", () => {
  assert.deepEqual(normalAt(grid(() => 128), 10, 10), [0, 0, 1]);
});

test("normalAt turns away from the side that comes nearer", () => {
  const [nx, ny, nz] = normalAt(grid(x => x * 10), 10, 10);   // nearer to the right: the surface faces left
  assert.ok(nx < 0 && near(ny, 0) && nz > 0, `${nx}, ${ny}, ${nz}`);
  const [, my] = normalAt(grid((x, y) => y * 10), 10, 10);    // nearer downwards: the surface faces up
  assert.ok(my < 0);
  assert.ok(near(Math.hypot(nx, ny, nz), 1));
});

test("lightFactor leaves brightness as drawn with the light straight ahead", () => {
  assert.ok(near(lightFactor([.6, 0, .8], [0, 0, 1], .55), 1));
  assert.ok(near(lightFactor([0, 0, 1], [0, 0, 5], .55), 1));
});

test("lightFactor brightens the side facing the light and darkens the other", () => {
  const right = [.6, 0, .8], left = [-.6, 0, .8], light = [1, 0, 1];
  assert.ok(lightFactor(right, light, .55) > 1);
  assert.ok(lightFactor(left, light, .55) < 1);
});

test("ease lands exactly on its target in a few dozen frames", () => {
  let v = .17, frames = 0;
  while (v !== 0 && frames < 200) { v = ease(v, 0); frames++; }
  assert.equal(v, 0);
  assert.ok(frames < 100, `${frames} frames`);
});

test("ease moves part of the way towards a distant target", () => {
  const v = ease(0, 1);
  assert.ok(v > 0 && v < .2, `${v}`);
});

test("ease over dt = 2 frames moves as two one-frame steps", () => {
  const v = ease(.17, -.05, 2), twice = ease(ease(.17, -.05), -.05);
  assert.ok(near(v, twice, 1e-12), `${v} vs ${twice}`);
});

test("ease over a fraction of a frame moves less than one frame", () => {
  const v = ease(0, 1, .5);
  assert.ok(v > 0 && v < ease(0, 1), `${v}`);
});

test("ease still lands exactly on its target once close, whatever dt", () => {
  assert.equal(ease(.1005, .1, 2), .1);
  assert.equal(ease(.1005, .1, .5), .1);
});

test("toEdge spans -1 .. 1 from an off-centre point to each viewport edge", () => {
  assert.equal(toEdge(900, 900, 1280), 0);
  assert.equal(toEdge(0, 900, 1280), -1);
  assert.equal(toEdge(1280, 900, 1280), 1);
  assert.ok(near(toEdge(1090, 900, 1280), .5));
});

test("toEdge is 0, not NaN, with the centre on the viewport edge", () => {
  assert.equal(toEdge(0, 0, 800), 0);
  assert.equal(toEdge(800, 800, 800), 0);
});

// README "ASCII portrait": an aspect of .8 keeps the expected numbers exact.
const layoutNear = (got, want) => {
  for (const key of Object.keys(want)) assert.ok(near(got[key], want[key], 1e-9), `${key}: ${got[key]} != ${want[key]}`);
};

test("portraitLayout anchors the face right and bottom at 1280x800 in 7px", () => {
  layoutNear(portraitLayout(1280, 800, .8), { x: 691.2, y: 80, pw: 537.6, ph: 672, fontPx: 7 });
});

test("portraitLayout keeps the face 120px shorter than a low hero", () => {
  layoutNear(portraitLayout(1280, 600, .8), { x: 1280 - 384 - 51.2, y: 72, pw: 384, ph: 480, fontPx: 7 });
});

test("portraitLayout uses 7px at 1100px wide", () => {
  layoutNear(portraitLayout(1100, 800, .8), { x: 594, y: 174.5, pw: 462, ph: 577.5, fontPx: 7 });
});

test("portraitLayout uses 6px under 1100px wide", () => {
  layoutNear(portraitLayout(1099, 800, .8), { x: 1099 - 461.58 - 43.96, y: 800 - 576.975 - 48, pw: 461.58, ph: 576.975, fontPx: 6 });
});

test("portraitLayout still anchors right and bottom at 760px wide", () => {
  layoutNear(portraitLayout(760, 800, .8), { x: 410.4, y: 353, pw: 319.2, ph: 399, fontPx: 6 });
});

test("portraitLayout centres the face at the top in 5.5px under 760px wide", () => {
  layoutNear(portraitLayout(759, 800, .8), { x: 187.5, y: 64, pw: 384, ph: 480, fontPx: 5.5 });
});

test("portraitLayout fits a phone's width at 375x812", () => {
  layoutNear(portraitLayout(375, 812, .8), { x: 18.75, y: 64, pw: 337.5, ph: 421.875, fontPx: 5.5 });
});

test("faceFade is full above the bottom 22% of the face and 0 from its bottom down", () => {
  assert.equal(faceFade(100, 600, 500), 1);
  assert.equal(faceFade(490, 600, 500), 1);
  assert.ok(near(faceFade(545, 600, 500), .5));
  assert.equal(faceFade(600, 600, 500), 0);
  assert.equal(faceFade(640, 600, 500), 0);
});

// README "Background field": t in seconds.
test("fieldChar draws + where the field is strongest", () => {
  assert.equal(fieldChar(51, 17, 0), "+");     // n = 1.905
});

test("fieldChar draws a dot where the field is above 1.52 but not 1.78", () => {
  assert.equal(fieldChar(17, 0, 0), "·");      // n = 1.692
});

test("fieldChar draws nothing where the field is weak", () => {
  assert.equal(fieldChar(0, 0, 0), "");        // n = 0
  assert.equal(fieldChar(51, 17, 2), "");      // n = 1.456
});

test("fieldChar moves with time", () => {
  assert.equal(fieldChar(44, 20, 0), "·");     // n = 1.611
  assert.equal(fieldChar(44, 20, 2), "+");     // n = 1.894
});

// One headline line box from x 100 to 300 and y 50 to 90, padded 12 x 10 as the README says.
const lines = [{ left: 100, top: 50, right: 300, bottom: 90 }];

test("inRects finds a point inside a line box", () => {
  assert.equal(inRects(200, 70, lines, 12, 10), true);
});

test("inRects finds a point in the padding around a line box", () => {
  assert.equal(inRects(90, 45, lines, 12, 10), true);
  assert.equal(inRects(311, 99, lines, 12, 10), true);
});

test("inRects leaves a point on the padding edge outside", () => {
  assert.equal(inRects(88, 70, lines, 12, 10), false);
  assert.equal(inRects(200, 100, lines, 12, 10), false);
});

test("inRects leaves a point outside every box outside", () => {
  assert.equal(inRects(400, 70, lines, 12, 10), false);
  assert.equal(inRects(200, 70, [], 12, 10), false);
});

test("inRects checks every box", () => {
  assert.equal(inRects(200, 130, [...lines, { left: 100, top: 120, right: 250, bottom: 160 }], 12, 10), true);
});

// Cells 10 x 12px against the line box above (padded box: x 88 .. 312, y 40 .. 100).
test("cellInZones counts a cell whose top-left is in the padded box, even with its centre outside", () => {
  assert.equal(cellInZones(31, 5, 10, 12, lines, 12, 10), true);    // top-left (310, 60), centre (315, 66)
});

test("cellInZones leaves out a cell whose top-left is outside, even with its centre inside", () => {
  assert.equal(cellInZones(20, 3, 10, 12, lines, 12, 10), false);   // top-left (200, 36), centre (205, 42)
});

// Face cells 4 x 8px, 5 x 3 of them; field cells 6 x 10px, 5 x 4 of them, so the field runs past the face's right
// and bottom edges. Face cell (1, 1) is covered, and so is (0, 3), one row past the face's bottom.
const fcover = Uint8Array.from({ length: 5 * 4 }, (_, k) => k === 1 * 5 + 1 || k === 3 * 5 + 0 ? 1 : 0);
const fmask = fieldMask(fcover, 5, 3, 4, 8, 6, 10, 5, 4);

test("fieldMask leaves out a field cell whose top-left falls in a covered face cell", () => {
  assert.equal(fmask.length, 5 * 4);
  assert.equal(fmask[1 * 5 + 1], 1);              // top-left (6, 10) is in face cell (1, 1)
});

test("fieldMask keeps the neighbouring field cells", () => {
  assert.equal(fmask[1 * 5 + 2], 0);              // (12, 10): face cell (3, 1)
  assert.equal(fmask[2 * 5 + 1], 0);              // (6, 20): face cell (1, 2)
  assert.equal(fmask[1 * 5 + 0], 0);              // (0, 10): face cell (0, 1)
});

test("fieldMask cuts off face indices past the right edge", () => {
  // (24, 0) is face column 6 of 5: unchecked, its index 6 would wrap to the covered cell (1, 1)
  assert.equal(fmask[0 * 5 + 4], 0);
});

test("fieldMask cuts off face indices past the bottom edge", () => {
  // (0, 30) is face row 3 of 3: unchecked, its index 15 would read the covered cell past the bottom
  assert.equal(fmask[3 * 5 + 0], 0);
});
