const test = require("node:test");
const assert = require("node:assert/strict");
const { currentHeading, readingProgress, readingBar, minutesLeft } = require("../public/contents-core.js");

// Heading tops are measured from the top of the viewport; the reading line sits a little below it.
test("currentHeading is -1 while every heading is still below the reading line", () => {
  assert.equal(currentHeading([300, 900, 1500], 120), -1);
});

test("currentHeading is the last heading at or above the reading line", () => {
  assert.equal(currentHeading([-800, -200, 120, 700], 120), 2);
  assert.equal(currentHeading([-800, -200, 121, 700], 120), 1);
});

// On a tall screen a short last section never reaches the reading line before the page ends.
test("currentHeading is the last heading once the page can scroll no further", () => {
  assert.equal(currentHeading([-3000, -2000, 400], 120, true), 2);
});

// The post's end comes into view while its last few headings are still below the line; they must each get a turn.
test("currentHeading keeps to the reading line until the page can scroll no further", () => {
  assert.equal(currentHeading([-3000, 90, 400], 120, false), 1);
});

test("currentHeading stays on the last heading after it has scrolled away", () => {
  assert.equal(currentHeading([-3000, -2000, -900], 120), 2);
});

// The post is read from its top reaching the top of the viewport to its bottom reaching the bottom.
test("readingProgress is 0 before the post reaches the top of the viewport", () => {
  assert.equal(readingProgress(400, 5000, 800), 0);
});

test("readingProgress is the share of the scrollable length already scrolled", () => {
  assert.equal(readingProgress(-1050, 5000, 800), .25);
});

test("readingProgress is 1 once the post's end is in view", () => {
  assert.equal(readingProgress(-4200, 5000, 800), 1);
  assert.equal(readingProgress(-6000, 5000, 800), 1);
});

test("readingProgress is 1 for a post shorter than the viewport", () => {
  assert.equal(readingProgress(100, 600, 800), 1);
});

test("readingBar fills its cells with hashes in proportion to progress", () => {
  assert.deepEqual(readingBar(0, 20), { on: "", off: "#".repeat(20) });
  assert.deepEqual(readingBar(.38, 20), { on: "#".repeat(8), off: "#".repeat(12) });
  assert.deepEqual(readingBar(1, 20), { on: "#".repeat(20), off: "" });
});

test("readingBar keeps its length when progress strays outside 0..1", () => {
  assert.deepEqual(readingBar(-.2, 10), { on: "", off: "#".repeat(10) });
  assert.deepEqual(readingBar(1.4, 10), { on: "#".repeat(10), off: "" });
});

test("minutesLeft rounds the remaining reading time up to whole minutes", () => {
  assert.equal(minutesLeft(0, 8), "8 min left");
  assert.equal(minutesLeft(.5, 8), "4 min left");
  assert.equal(minutesLeft(.99, 8), "1 min left");
});

test("minutesLeft says the post is read once progress reaches the end", () => {
  assert.equal(minutesLeft(1, 8), "read to the end");
});
