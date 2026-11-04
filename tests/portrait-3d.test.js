const test = require("node:test");
const assert = require("node:assert/strict");
const { depthAt, sourcePoint, normalAt, lightFactor } = require("../public/portrait-3d.js");

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
