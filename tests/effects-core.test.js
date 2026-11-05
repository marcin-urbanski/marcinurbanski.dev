const test = require("node:test");
const assert = require("node:assert/strict");
const {
  scrambleText, easeOutCubic, easeOutQuart, easeInOutQuad, loaderState, formatCount, countFrame, runsFrame,
  litPercent, londonTime, stripStep, stripSkew, previewPos, lerp, decayVelocity, decayVelocityMs, frameDt,
  createLoop, afterPaint, whenIdle, loaderKey, inView, COUNT_MS, RUNS_MS
} = require("../public/effects-core.js");

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const first = () => 0;            // always the first scramble glyph, "!"

test("scrambleText ends exactly on the target text at progress 1", () => {
  assert.equal(scrambleText("abc", "hello world", 1, first), "hello world");
});

test("scrambleText clamps progress above 1 to the target text", () => {
  assert.equal(scrambleText("abc", "hello world", 1.5, first), "hello world");
});

test("scrambleText clamps progress below 0 to the first frame", () => {
  // at progress 0 only the first character has had its turn
  assert.equal(scrambleText("hello", "world", -1, first), "!ello");
});

test("scrambleText keeps a character's old text until its turn, then shows glyphs", () => {
  assert.equal(scrambleText("abcdefghij", "ABCDEFGHIJ", .3, first), "!!!!!fghij");
});

test("scrambleText settles each character on its target after its glyphs", () => {
  assert.equal(scrambleText("abcdefghij", "ABCDEFGHIJ", .5, first), "ABC!!!!!ij");
});

test("scrambleText picks glyphs from the design's set with rand", () => {
  assert.equal(scrambleText("x", "y", 0, () => .5), "{");
  assert.equal(scrambleText("x", "y", 0, () => .999), "1");
});

test("scrambleText keeps spaces of the target while scrambling", () => {
  assert.equal(scrambleText("vwxyz", "a b c", .3, first), "! !yz");
});

test("scrambleText grows from a shorter to a longer text", () => {
  assert.equal(scrambleText("ab", "abcdef", .5, first), "ab!!!");
});

test("scrambleText starts from empty text", () => {
  assert.equal(scrambleText("", "hi", .2, first), "!");
  assert.equal(scrambleText("", "hi", 1, first), "hi");
});

test("scrambleText drops the extra characters of a longer old text", () => {
  assert.equal(scrambleText("hello", "hi", .9, first), "hi");
});

test("easeOutCubic runs from 0 to 1, fast first", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(.5), .875);
  assert.equal(easeOutCubic(1), 1);
});

test("easeOutQuart runs from 0 to 1, faster first", () => {
  assert.equal(easeOutQuart(0), 0);
  assert.equal(easeOutQuart(.5), .9375);
  assert.equal(easeOutQuart(1), 1);
});

test("easeInOutQuad is slow at both ends", () => {
  assert.equal(easeInOutQuad(0), 0);
  assert.equal(easeInOutQuad(.25), .125);
  assert.equal(easeInOutQuad(.5), .5);
  assert.equal(easeInOutQuad(.75), .875);
  assert.equal(easeInOutQuad(1), 1);
});

const EMPTY_BAR = "[" + ".".repeat(24) + "]";
const FULL_BAR = "[" + "#".repeat(24) + "]";

test("loaderState starts at 000 with an empty bar", () => {
  assert.deepEqual(loaderState(0), { count: "000", bar: EMPTY_BAR, done: false });
});

test("loaderState clamps time before the start to the first frame", () => {
  assert.deepEqual(loaderState(-100), { count: "000", bar: EMPTY_BAR, done: false });
});

test("loaderState counter and bar follow ease-out-cubic", () => {
  // halfway: ease-out-cubic gives .875
  const s = loaderState(850);
  assert.equal(s.count, "088");
  assert.equal(s.bar, "[" + "#".repeat(21) + "...]");
});

test("loaderState ends at 100 with a full bar after 1.7s", () => {
  assert.deepEqual(loaderState(1700), { count: "100", bar: FULL_BAR, done: true });
});

test("loaderState stays on the final frame after 1.7s", () => {
  assert.deepEqual(loaderState(5000), { count: "100", bar: FULL_BAR, done: true });
});

test("formatCount groups thousands the en-GB way", () => {
  assert.equal(formatCount(1080), "1,080");
  assert.equal(formatCount(0), "0");
});

test("formatCount rounds to a whole number", () => {
  assert.equal(formatCount(1079.6), "1,080");
});

const text = lines => lines.map(l => l.map(s => s.text).join("")).join("\n");
const doneCells = lines => lines.flat().filter(s => s.state === "held" || s.state === "broke").reduce((n, s) => n + s.text.length, 0);
const BLANK_LINES = [3, 7, 11];
// 15 lines, every row the same segments, a blank line between groups
const every = row => Array.from({ length: 15 }, (_, i) => (BLANK_LINES.includes(i) ? [] : row));
const ALL_PENDING = every([{ state: "pending", text: ".".repeat(30) }]);
const ALL_HELD = every([{ state: "held", text: "#".repeat(30) }]);
// A model's results as study-runs.json has them: 12 rows of 30 runs, "1" held, "0" broke
const HELD = Array.from({ length: 12 }, () => "1".repeat(30));
const MIXED = HELD.map((r, i) => (i === 0 ? "0" + "1".repeat(29) : i === 4 ? "1".repeat(27) + "010" : i === 11 ? "0".repeat(30) : r));

test("runsFrame draws 12 rows of 30 cells in 4 groups of 3", () => {
  const lines = runsFrame(.5, 0, MIXED);
  assert.equal(lines.length, 15);
  lines.forEach((l, i) => assert.equal(l.map(s => s.text).join("").length, BLANK_LINES.includes(i) ? 0 : 30, `line ${i}`));
});

test("runsFrame at 0 shows every cell pending", () => {
  assert.deepEqual(runsFrame(0, 0, MIXED), ALL_PENDING);
});

test("runsFrame clamps progress below 0 to the first frame", () => {
  assert.deepEqual(runsFrame(-1, 0, MIXED), ALL_PENDING);
});

test("runsFrame at 1 shows every run of a model whose rule always held as #", () => {
  for (const model of [0, 1, 2]) assert.deepEqual(runsFrame(1, model, HELD), ALL_HELD, `model ${model}`);
});

test("runsFrame clamps progress above 1 to the final frame", () => {
  assert.deepEqual(runsFrame(2, 2, HELD), ALL_HELD);
});

test("runsFrame at 1 shows each run's own result: # held, x broke", () => {
  const lines = runsFrame(1, 0, MIXED);
  assert.deepEqual(lines[0], [{ state: "broke", text: "x" }, { state: "held", text: "#".repeat(29) }]);
  assert.deepEqual(lines[5], [{ state: "held", text: "#".repeat(27) }, { state: "broke", text: "x" }, { state: "held", text: "#" }, { state: "broke", text: "x" }]);
  assert.deepEqual(lines[14], [{ state: "broke", text: "x".repeat(30) }]);
  assert.equal(text(lines).replace(/[^x]/g, "").length, 33);
});

test("runsFrame at 0.5 has later models behind earlier ones", () => {
  // q = .6, .5, .4, eased with ease-in-out-quad: .68, .5, .32 of 360 runs
  assert.equal(doneCells(runsFrame(.5, 0, MIXED)), 245);
  assert.equal(doneCells(runsFrame(.5, 1, MIXED)), 180);
  assert.equal(doneCells(runsFrame(.5, 2, MIXED)), 115);
});

test("runsFrame marks the run in progress with a current cell", () => {
  // 245 done runs: rows 0-7 full, row 8 (line 10) has 5 done, then the current run
  const lines = runsFrame(.5, 0, HELD);
  assert.deepEqual(lines[9], [{ state: "held", text: "#".repeat(30) }]);
  assert.deepEqual(lines[10], [
    { state: "held", text: "#####" }, { state: "current", text: ">" }, { state: "pending", text: ".".repeat(24) }
  ]);
  assert.deepEqual(lines[12], [{ state: "pending", text: ".".repeat(30) }]);
  assert.equal(text(lines).split(">").length, 2);
});

test("runsFrame shows a done run's result while the grid fills", () => {
  // 180 done runs for model 1: row 6 (line 7 is blank, so line 8) is the first not yet started
  const lines = runsFrame(.5, 1, MIXED);
  assert.deepEqual(lines[0], [{ state: "broke", text: "x" }, { state: "held", text: "#".repeat(29) }]);
  assert.deepEqual(lines[8], [{ state: "pending", text: ".".repeat(30) }]);
});

test("litPercent is -4 when the text top reaches 88% of the viewport", () => {
  assert.equal(litPercent(880, 500, 1000), -4);
});

test("litPercent grows with scroll", () => {
  assert.equal(litPercent(480, 500, 1000), 50);
});

test("litPercent clamps before the text is reached", () => {
  assert.equal(litPercent(2000, 500, 1000), -4);
});

test("litPercent clamps after the text has passed", () => {
  assert.equal(litPercent(-10000, 500, 1000), 104);
});

test("londonTime shows summer time in July", () => {
  assert.equal(londonTime(new Date("2026-07-15T12:34:56Z")), "13:34:56");
});

test("londonTime shows GMT in January, 24h from 00", () => {
  assert.equal(londonTime(new Date("2026-01-15T00:05:09Z")), "00:05:09");
});

test("stripStep moves left by 1.1px per frame at rest", () => {
  assert.ok(near(stripStep(-100, 1000, 0, 1, 1), -101.1));
});

test("stripStep moves twice as far with dt = 2", () => {
  assert.ok(near(stripStep(-100, 1000, 0, 1, 2), -102.2));
});

test("stripStep speeds up with scroll velocity", () => {
  assert.ok(near(stripStep(-100, 1000, 10, 1, 1), -100 - 1.1 - 2.8));
});

test("stripStep caps the velocity at 80", () => {
  assert.ok(near(stripStep(-100, 1000, 200, 1, 1), -100 - 1.1 - 80 * .28));
});

test("stripStep uses the size of a negative velocity", () => {
  assert.ok(near(stripStep(-100, 1000, -10, 1, 1), -100 - 1.1 - 2.8));
});

test("stripStep moves right when scrolling up", () => {
  assert.ok(near(stripStep(-100, 1000, 0, -1, 1), -98.9));
});

test("stripStep wraps past -half back towards 0", () => {
  assert.ok(near(stripStep(-999, 1000, 0, 1, 1), -.1, 1e-6));
});

test("stripStep wraps past 0 back towards -half", () => {
  assert.ok(near(stripStep(-.5, 1000, 0, -1, 1), -999.4, 1e-6));
});

test("stripStep keeps the offset while the half width is unknown", () => {
  assert.equal(stripStep(-100, 0, 0, 1, 1), -100);
  assert.equal(stripStep(-100, -5, 0, 1, 1), -100);
  assert.equal(stripStep(-100, NaN, 0, 1, 1), -100);
});

test("stripSkew leans against the scroll velocity", () => {
  assert.ok(near(stripSkew(10), -1.8));
  assert.ok(near(stripSkew(-10), 1.8));
});

test("stripSkew is clamped to 10 degrees", () => {
  assert.equal(stripSkew(100), -10);
  assert.equal(stripSkew(-100), 10);
});

const VIEWPORT = { w: 1280, h: 800 };

test("previewPos snaps to the pointer plus 28px when there is no current position", () => {
  assert.deepEqual(previewPos({ x: 100, y: 100 }, null, VIEWPORT, 1), { x: 128, y: 128, rot: 0 });
});

test("previewPos keeps the panel inside the right edge", () => {
  assert.equal(previewPos({ x: 1200, y: 100 }, null, VIEWPORT, 1).x, 1280 - 340);
});

test("previewPos keeps the panel inside the bottom edge", () => {
  assert.equal(previewPos({ x: 100, y: 700 }, null, VIEWPORT, 1).y, 800 - 260);
});

test("previewPos follows the target with lerp .14", () => {
  const p = previewPos({ x: 100, y: 100 }, { x: 28, y: 128 }, VIEWPORT, 1);
  assert.ok(near(p.x, 42));
  assert.equal(p.y, 128);
});

test("previewPos follows further with dt = 2", () => {
  assert.ok(near(previewPos({ x: 100, y: 100 }, { x: 28, y: 128 }, VIEWPORT, 2).x, 28 + 100 * (1 - .86 ** 2)));
});

test("previewPos rotates by .04 degree per pixel still to go", () => {
  assert.ok(near(previewPos({ x: 100, y: 100 }, { x: 28, y: 128 }, VIEWPORT, 1).rot, 4));
});

test("previewPos rotation is clamped to 8 degrees", () => {
  assert.equal(previewPos({ x: 100, y: 100 }, { x: -472, y: 128 }, VIEWPORT, 1).rot, 8);
  assert.equal(previewPos({ x: 100, y: 100 }, { x: 728, y: 128 }, VIEWPORT, 1).rot, -8);
});

test("lerp moves k of the way in one frame", () => {
  assert.equal(lerp(0, 100, .25, 1), 25);
});

test("lerp moves as two frames with dt = 2", () => {
  assert.equal(lerp(0, 100, .25, 2), 43.75);
});

test("countFrame starts the count-up at 0", () => {
  assert.equal(countFrame(1080, 0), "0");
});

test("countFrame eases the count out over 2.4s with ease-out-quart", () => {
  assert.equal(countFrame(1080, 1200), "1,013");
});

test("countFrame ends on the formatted target at 2.4s and after", () => {
  assert.equal(countFrame(1080, 2400), "1,080");
  assert.equal(countFrame(1080, 9000), "1,080");
});

test("countFrame stays at 0 before it starts", () => {
  assert.equal(countFrame(1080, -100), "0");
});

test("COUNT_MS is the count-up's 2.4s run", () => {
  assert.equal(COUNT_MS, 2400);
});

test("RUNS_MS is the design's 3s runs grid fill", () => {
  assert.equal(RUNS_MS, 3000);
});

test("inView ignores an intersecting entry below the threshold", () => {
  assert.equal(inView({ isIntersecting: true, intersectionRatio: .2 }, .4), false);
});

test("inView starts an intersecting entry at the threshold", () => {
  assert.equal(inView({ isIntersecting: true, intersectionRatio: .4 }, .4), true);
});

test("inView ignores an entry that is not intersecting", () => {
  assert.equal(inView({ isIntersecting: false, intersectionRatio: 1 }, .4), false);
});

test("decayVelocity loses 10% per frame", () => {
  assert.equal(decayVelocity(10, 1), 9);
});

test("decayVelocity loses 10% twice with dt = 2", () => {
  assert.ok(near(decayVelocity(10, 2), 8.1));
});

test("decayVelocityMs loses 10% per 60fps frame of elapsed time", () => {
  assert.ok(near(decayVelocityMs(10, 1000 / 60), 9));
  assert.ok(near(decayVelocityMs(10, 2000 / 60), 8.1));
});

test("decayVelocityMs keeps the velocity when no time or negative time has passed", () => {
  assert.equal(decayVelocityMs(10, 0), 10);
  assert.equal(decayVelocityMs(10, -50), 10);
});

test("frameDt measures elapsed time in 60fps frames", () => {
  assert.ok(near(frameDt(1000 / 60), 1));
  assert.ok(near(frameDt(1000 / 30), 2));
});

test("frameDt is capped at 3 frames", () => {
  assert.equal(frameDt(500), 3);
});

test("frameDt never goes below 0", () => {
  assert.equal(frameDt(-4), 0);
});

// A fake requestAnimationFrame: `tick(now)` runs the frame the loop asked for.
function fakeFrames() {
  let pending = null, requests = 0;
  return {
    request: fn => { pending = fn; requests++; },
    tick: now => { const fn = pending; pending = null; fn(now); },
    get pending() { return pending !== null; },
    get requests() { return requests; }
  };
}

test("createLoop calls each callback once a frame with dt in frame units and the time", () => {
  const frames = fakeFrames(), calls = [];
  const loop = createLoop(frames.request, () => {});
  loop.add((dt, now) => calls.push([dt, now]));
  frames.tick(1000);
  frames.tick(1000 + 2000 / 60);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], [1, 1000]);
  assert.ok(near(calls[1][0], 2));
});

test("createLoop drops a callback that throws, reports it once and keeps the others running", () => {
  const frames = fakeFrames(), errors = [];
  let good = 0;
  const loop = createLoop(frames.request, e => errors.push(e.message));
  loop.add(() => { throw new Error("boom"); });
  loop.add(() => { good++; });
  frames.tick(0);
  frames.tick(16);
  assert.deepEqual(errors, ["boom"]);
  assert.equal(good, 2);
});

test("createLoop stops asking for frames when no callback is left", () => {
  const frames = fakeFrames(), fn = () => {};
  const loop = createLoop(frames.request, () => {});
  loop.add(fn);
  frames.tick(0);
  loop.remove(fn);
  frames.tick(16);
  assert.equal(frames.pending, false);
});

test("createLoop starts again on add after stopping, with a fresh dt of 1", () => {
  const frames = fakeFrames(), dts = [], fn = () => {};
  const loop = createLoop(frames.request, () => {});
  loop.add(fn);
  frames.tick(0);
  loop.remove(fn);
  frames.tick(16);
  loop.add(dt => dts.push(dt));
  frames.tick(5000);
  assert.deepEqual(dts, [1]);
});

test("createLoop asks for one frame however many callbacks are added", () => {
  const frames = fakeFrames();
  const loop = createLoop(frames.request, () => {});
  loop.add(() => {});
  loop.add(() => {});
  assert.equal(frames.requests, 1);
});

test("createLoop skips a callback removed earlier in the same frame", () => {
  const frames = fakeFrames();
  let ran = false;
  const loop = createLoop(frames.request, () => {});
  const second = () => { ran = true; };
  loop.add(() => loop.remove(second));
  loop.add(second);
  frames.tick(0);
  assert.equal(ran, false);
});

test("createLoop ignores a callback added again after it threw", () => {
  const frames = fakeFrames(), errors = [];
  let calls = 0;
  const bad = () => { calls++; throw new Error("boom"); };
  const loop = createLoop(frames.request, e => errors.push(e.message));
  loop.add(bad);
  loop.add(() => {});
  frames.tick(0);
  loop.add(bad);
  frames.tick(16);
  assert.equal(calls, 1);
  assert.deepEqual(errors, ["boom"]);
});

test("createLoop runs read callbacks before the other callbacks in a frame", () => {
  const frames = fakeFrames(), order = [];
  const loop = createLoop(frames.request, () => {});
  loop.add(() => order.push("write"));
  loop.addRead(() => order.push("read"));
  frames.tick(0);
  assert.deepEqual(order, ["read", "write"]);
});

test("createLoop passes dt and the time to read callbacks", () => {
  const frames = fakeFrames(), calls = [];
  const loop = createLoop(frames.request, () => {});
  loop.addRead((dt, now) => calls.push([dt, now]));
  frames.tick(500);
  assert.deepEqual(calls, [[1, 500]]);
});

test("createLoop stops calling a read callback once it is removed", () => {
  const frames = fakeFrames(), read = () => { reads++; };
  let reads = 0;
  const loop = createLoop(frames.request, () => {});
  loop.add(() => {});
  loop.addRead(read);
  frames.tick(0);
  loop.removeRead(read);
  frames.tick(16);
  assert.equal(reads, 1);
});

test("createLoop stops asking for frames when its last read callback is removed", () => {
  const frames = fakeFrames(), read = () => {};
  const loop = createLoop(frames.request, () => {});
  loop.addRead(read);
  assert.ok(frames.pending);
  frames.tick(0);
  loop.removeRead(read);
  frames.tick(16);
  assert.equal(frames.pending, false);
});

test("createLoop drops a read callback that throws, reports it once and keeps the others running", () => {
  const frames = fakeFrames(), errors = [];
  let reads = 0, writes = 0;
  const bad = () => { reads++; throw new Error("boom"); };
  const loop = createLoop(frames.request, e => errors.push(e.message));
  loop.addRead(bad);
  loop.add(() => { writes++; });
  frames.tick(0);
  loop.addRead(bad);
  frames.tick(16);
  assert.equal(reads, 1);
  assert.equal(writes, 2);
  assert.deepEqual(errors, ["boom"]);
});

// A fake window for afterPaint: frames and idle callbacks run when the test says, timers are recorded.
function fakeWindow(idle) {
  const log = [];
  let frame = null, idleFn = null;
  const win = {
    requestAnimationFrame: fn => { log.push("frame"); frame = fn; },
    setTimeout: (fn, ms) => { log.push(["timeout", ms]); idleFn = fn; }
  };
  if (idle) win.requestIdleCallback = (fn, opts) => { log.push(["idle", opts]); idleFn = fn; };
  return { win, log, frame: () => frame(0), idle: deadline => idleFn(deadline) };
}

test("afterPaint waits for a frame, then for an idle callback with a 1s timeout", () => {
  const w = fakeWindow(true);
  let ran = 0;
  afterPaint(() => { ran++; }, w.win);
  assert.deepEqual(w.log, ["frame"]);
  w.frame();
  assert.deepEqual(w.log, ["frame", ["idle", { timeout: 1000 }]]);
  assert.equal(ran, 0);
  w.idle({});
  assert.equal(ran, 1);
});

test("afterPaint passes the idle deadline on to the callback", () => {
  const w = fakeWindow(true), deadline = { timeRemaining: () => 10 };
  let got;
  afterPaint(d => { got = d; }, w.win);
  w.frame();
  w.idle(deadline);
  assert.equal(got, deadline);
});

test("afterPaint falls back to a 200ms timer after the frame without requestIdleCallback", () => {
  const w = fakeWindow(false);
  let ran = 0;
  afterPaint(() => { ran++; }, w.win);
  w.frame();
  assert.deepEqual(w.log, ["frame", ["timeout", 200]]);
  assert.equal(ran, 0);
  w.idle();
  assert.equal(ran, 1);
});

test("whenIdle runs the callback from an idle callback with a 1s timeout, without waiting for a frame", () => {
  const w = fakeWindow(true);
  let ran = 0;
  whenIdle(() => { ran++; }, w.win);
  assert.deepEqual(w.log, [["idle", { timeout: 1000 }]]);
  w.idle({});
  assert.equal(ran, 1);
});

test("whenIdle falls back to a 0ms timer without requestIdleCallback", () => {
  const w = fakeWindow(false);
  let ran = 0;
  whenIdle(() => { ran++; }, w.win);
  assert.deepEqual(w.log, [["timeout", 0]]);
  w.idle();
  assert.equal(ran, 1);
});

test("loaderKey closes the loader on an ordinary key", () => {
  assert.equal(loaderKey({ key: "Enter" }), "close");
  assert.equal(loaderKey({ key: "a" }), "close");
  assert.equal(loaderKey({ key: "Escape" }), "close");
});

test("loaderKey closes without scrolling on a scroll key", () => {
  for (const key of [" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]) {
    assert.equal(loaderKey({ key }), "close-no-scroll", key);
  }
});

test("loaderKey ignores a modifier key on its own", () => {
  for (const key of ["Meta", "Control", "Alt", "Shift"]) assert.equal(loaderKey({ key }), "ignore", key);
});

test("loaderKey ignores a shortcut with Cmd, Ctrl or Alt held", () => {
  assert.equal(loaderKey({ key: "r", metaKey: true }), "ignore");
  assert.equal(loaderKey({ key: "r", ctrlKey: true }), "ignore");
  assert.equal(loaderKey({ key: "ArrowDown", altKey: true }), "ignore");
});

test("loaderKey still closes with only Shift held", () => {
  assert.equal(loaderKey({ key: "A", shiftKey: true }), "close");
});
