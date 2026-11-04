// The maths behind the home page effects (loader, scramble, clock, count-up, runs grid, lit text, strip, cursor
// and preview panel), as in the design's `class Component` (docs/design/.../Marcin Urbanski.dc.html). effects.js
// does the DOM work and calls these; it is also a CommonJS module so `node --test` can check it.
// `dt` is always elapsed time / 16.67ms (one 60fps frame), capped at 3 by the page loop.
(function (root) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // One frame of the text scramble (.dc.html:245–261): character i keeps `from[i]` until its turn at
  // i / len * .65, shows glyphs for .35 of the run (spaces of `to` stay spaces), then settles on `to[i]`.
  // `rand` returns 0 <= r < 1 and picks the glyphs.
  const GLYPHS = "!<>-_\\/[]{}=+*^?#01";
  function scrambleText(from, to, progress, rand) {
    const p = clamp(progress, 0, 1), len = Math.max(from.length, to.length);
    let out = "";
    for (let i = 0; i < len; i++) {
      const turn = (i / len) * .65;
      if (p >= turn + .35) out += to[i] || "";
      else if (p >= turn) out += to[i] === " " ? " " : GLYPHS[(rand() * GLYPHS.length) | 0];
      else out += from[i] || "";
    }
    return out;
  }

  const easeOutCubic = p => 1 - (1 - p) ** 3;
  const easeOutQuart = p => 1 - (1 - p) ** 4;
  const easeInOutQuad = p => (p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

  // The intro loader at `elapsedMs` (.dc.html:372–380): a 000–100 counter and a 24-cell bar eased out over
  // 1.7s, and the log lines printed on linear progress.
  const LOADER_MS = 1700, LOADER_CELLS = 24;
  const LOADER_LINES = ["> reproduce", "> measure", "> fix the cause"];
  function loaderState(elapsedMs) {
    const p = clamp(elapsedMs / LOADER_MS, 0, 1), k = easeOutCubic(p), filled = Math.round(k * LOADER_CELLS);
    return {
      count: String(Math.round(k * 100)).padStart(3, "0"),
      bar: "[" + "#".repeat(filled) + ".".repeat(LOADER_CELLS - filled) + "]",
      lines: LOADER_LINES.slice(0, Math.min(3, Math.floor(p * 3.6))).map(l => l + "  ok"),
      done: p === 1
    };
  }

  const formatCount = n => Math.round(n).toLocaleString("en-GB");

  // One frame of a model's runs grid (.dc.html:309–323): 360 runs as 12 rows of 30 cells (4 setups x 3
  // requests, a blank line between setups), later models a little behind. Returns the grid's lines, each a
  // list of { state: "done" | "current" | "pending", text } segments for the DOM code to wrap and colour.
  const RUN_ROWS = 12, RUN_COLS = 30;
  function runsFrame(progress, modelIndex) {
    const q = clamp(progress * 1.2 - modelIndex * .1, 0, 1), runs = Math.round(easeInOutQuad(q) * RUN_ROWS * RUN_COLS);
    const lines = [];
    for (let r = 0; r < RUN_ROWS; r++) {
      if (r && r % 3 === 0) lines.push([]);
      const done = clamp(runs - r * RUN_COLS, 0, RUN_COLS), segments = [{ state: "done", text: "#".repeat(done) }];
      if (done > 0 && done < RUN_COLS) {
        segments.push({ state: "current", text: ">" }, { state: "pending", text: ".".repeat(RUN_COLS - 1 - done) });
      } else {
        segments.push({ state: "pending", text: ".".repeat(RUN_COLS - done) });
      }
      lines.push(segments.filter(s => s.text));
    }
    return lines;
  }

  // How far the approach paragraph is lit, -4..104 (%), from its rect and the viewport height.
  const litPercent = (rectTop, rectHeight, vh) => clamp((vh * .88 - rectTop) / (rectHeight + vh * .3), 0, 1) * 108 - 4;

  const LONDON = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  const londonTime = date => LONDON.format(date);

  // One frame of the scrolling strip (.dc.html frame()): it drifts 1.1px a frame plus .28 per unit of scroll
  // velocity (|v| capped at 80) in the scroll direction (1 down, -1 up); the offset wraps into (-half, 0].
  function stripStep(x, half, velocity, direction, dt) {
    const next = (x - (1.1 + Math.min(80, Math.abs(velocity)) * .28) * direction * dt) % half;
    return next > 0 ? next - half : next;
  }
  const stripSkew = velocity => clamp(-velocity * .18, -10, 10);

  // Frame-rate independent easing of a towards b by k per frame (.dc.html:437).
  const lerp = (a, b, k, dt) => a + (b - a) * (1 - (1 - k) ** dt);

  // The hover preview panel (.dc.html:452–459): its target is the pointer + 28px, kept inside the viewport
  // (320px panel); it follows at .14 and leans into the distance still to go. With no `current` position
  // (the panel just opened) it snaps to the target.
  function previewPos(pointer, current, viewport, dt) {
    const tx = Math.min(pointer.x + 28, viewport.w - 340), ty = Math.min(pointer.y + 28, viewport.h - 260);
    if (!current) return { x: tx, y: ty, rot: 0 };
    return { x: lerp(current.x, tx, .14, dt), y: lerp(current.y, ty, .14, dt), rot: clamp((tx - current.x) * .04, -8, 8) };
  }

  // Scroll velocity loses 10% a frame (.dc.html:436).
  const decayVelocity = (v, dt) => v * .9 ** dt;

  const api = {
    scrambleText, easeOutCubic, easeOutQuart, easeInOutQuad, loaderState, formatCount, runsFrame, litPercent,
    londonTime, stripStep, stripSkew, previewPos, lerp, decayVelocity
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EffectsCore = api;
})(this);
