const test = require("node:test");
const assert = require("node:assert/strict");
const { currentHeading, atPageEnd, keptJump, readingProgress, readingBar, minutesLeft } = require("../public/contents-core.js");

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

// A jump to a late section can stop at the page's end, where the scroll position alone would light the last one.
test("currentHeading at the page's end is the heading the reader jumped to, if any", () => {
  assert.equal(currentHeading([-3000, 82, 400], 120, true, 1), 1);
  assert.equal(currentHeading([-3000, 82, 400], 120, true, -1), 2);
});

// After a jump the reader may reach the end with the scrollbar, which leaves the jump unchanged.
test("currentHeading at the page's end ignores a jump whose heading has scrolled above the viewport", () => {
  assert.equal(currentHeading([-5466, 62, 457], 120, true, 0), 2);
});

test("currentHeading ignores the jump away from the page's end", () => {
  assert.equal(currentHeading([-3000, -900, 90], 120, false, 0), 2);
});

// A jump to a late section stops at the page's end; once the reader leaves the end, the jump has done its job.
test("keptJump forgets the jump once the page leaves its end", () => {
  assert.equal(keptJump(1, true, false), -1);
});

test("keptJump keeps the jump while the page stays at its end or has not reached it yet", () => {
  assert.equal(keptJump(1, true, true), 1);
  assert.equal(keptJump(1, false, false), 1);
  assert.equal(keptJump(1, false, true), 1);
  assert.equal(keptJump(-1, true, false), -1);
});

test("atPageEnd is true once the page can scroll no further, allowing for fractional scroll", () => {
  assert.equal(atPageEnd(3000, 800, 3800), true);
  assert.equal(atPageEnd(2998.5, 800, 3800), true);
  assert.equal(atPageEnd(2997, 800, 3800), false);
});

// The post's end comes into view while its last few headings are still below the line; they must each get a turn.
test("currentHeading keeps to the reading line until the page can scroll no further", () => {
  assert.equal(currentHeading([-3000, 90, 400], 120, false), 1);
});

test("currentHeading stays on the last heading after it has scrolled away", () => {
  assert.equal(currentHeading([-3000, -2000, -900], 120), 2);
});

// Progress is read at the same line as the current heading: the share of the post above the reading line.
test("readingProgress is 0 while the post's top is below the reading line", () => {
  assert.equal(readingProgress(400, 5000, 120, false), 0);
});

test("readingProgress is the share of the post above the reading line", () => {
  assert.equal(readingProgress(-1130, 5000, 120, false), .25);
});

// The reported bug: the post's end is in view, but the reading line is still above it.
test("readingProgress is below 1 while the post's end is in view but below the reading line", () => {
  assert.ok(readingProgress(-4200, 5000, 120, false) < 1);
});

test("readingProgress is 1 once the post's bottom has passed the reading line", () => {
  assert.equal(readingProgress(-4880, 5000, 120, false), 1);
  assert.equal(readingProgress(-6000, 5000, 120, false), 1);
});

// A short post, or a tall screen, never brings the post's bottom up to the line.
test("readingProgress is 1 once the page can scroll no further", () => {
  assert.equal(readingProgress(100, 600, 120, true), 1);
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
