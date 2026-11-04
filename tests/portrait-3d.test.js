const test = require("node:test");
const assert = require("node:assert/strict");
const { depthAt } = require("../public/portrait-3d.js");

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
