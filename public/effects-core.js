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

  // The intro loader at `elapsedMs` (.dc.html:372–380): a 000–100 counter and a 24-cell bar eased out over 1.7s.
  const LOADER_MS = 1700, LOADER_CELLS = 24;
  function loaderState(elapsedMs) {
    const p = clamp(elapsedMs / LOADER_MS, 0, 1), k = easeOutCubic(p), filled = Math.round(k * LOADER_CELLS);
    return {
      count: String(Math.round(k * 100)).padStart(3, "0"),
      bar: "[" + "#".repeat(filled) + ".".repeat(LOADER_CELLS - filled) + "]",
      done: p === 1
    };
  }

  const formatCount = n => Math.round(n).toLocaleString("en-GB");

  // The study's counter `elapsedMs` into its count-up (.dc.html:290): 0 to `target` over 2.4s, eased out.
  const COUNT_MS = 2400;
  const countFrame = (target, elapsedMs) => formatCount(target * easeOutQuart(clamp(elapsedMs / COUNT_MS, 0, 1)));

  // One frame of a model's runs grid (.dc.html:309–323) at progress = elapsed / RUNS_MS (the 3s fill): 360 runs
  // as 12 rows of 30 cells (4 setups x 3 requests, a blank line between setups), later models a little behind.
  // `rows` are the model's results from study-runs.json, 12 strings of 30 runs, "1" where the rule held and "0"
  // where it broke; a done run shows # or x. Returns the grid's lines, each a list of
  // { state: "held" | "broke" | "current" | "pending", text } segments for the DOM code to wrap and colour.
  const RUNS_MS = 3000, RUN_ROWS = 12, RUN_COLS = 30;
  function runsFrame(progress, modelIndex, rows) {
    const q = clamp(progress * 1.2 - modelIndex * .1, 0, 1), runs = Math.round(easeInOutQuad(q) * RUN_ROWS * RUN_COLS);
    const lines = [];
    for (let r = 0; r < RUN_ROWS; r++) {
      if (r && r % 3 === 0) lines.push([]);
      const done = clamp(runs - r * RUN_COLS, 0, RUN_COLS), segments = [];
      for (const result of rows[r].slice(0, done)) {
        const [state, glyph] = result === "1" ? ["held", "#"] : ["broke", "x"], last = segments[segments.length - 1];
        if (last && last.state === state) last.text += glyph;
        else segments.push({ state, text: glyph });
      }
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
  // Until the track's half width is known and positive the offset stays put (a NaN offset would stick).
  function stripStep(x, half, velocity, direction, dt) {
    if (!(half > 0)) return x;
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
  // The same decay over `ms` of wall time (none for a negative span), for velocity kept between frames.
  const decayVelocityMs = (v, ms) => decayVelocity(v, Math.max(0, ms) / (1000 / 60));

  // Elapsed time in 60fps frames, the `dt` every per-frame function takes; capped at 3 after a stall.
  const frameDt = elapsedMs => clamp(elapsedMs / (1000 / 60), 0, 3);

  // The page's one frame loop (window.SiteLoop): callbacks get (dt, now) every frame. Read callbacks (addRead)
  // run first, so one that reads layout does so before any other callback in that frame writes styles. One that
  // throws is dropped for good (adding it again does nothing) and reported once through `onError`; the others keep
  // running. With no callbacks left the loop stops asking for frames, and its first frame after a (re)start has dt 1.
  function createLoop(requestFrame, onError) {
    const reads = new Set(), fns = new Set(), failed = new WeakSet();
    let running = false, last = null;
    function run(set, dt, now) {
      for (const fn of [...set]) {
        if (!set.has(fn)) continue;
        try { fn(dt, now); } catch (e) { set.delete(fn); failed.add(fn); onError(e); }
      }
    }
    function frame(now) {
      const dt = last === null ? 1 : frameDt(now - last);
      last = now;
      run(reads, dt, now);
      run(fns, dt, now);
      if (reads.size || fns.size) requestFrame(frame);
      else { running = false; last = null; }
    }
    const adder = set => fn => { if (failed.has(fn)) return; set.add(fn); if (!running) { running = true; requestFrame(frame); } };
    return {
      add: adder(fns),
      remove(fn) { fns.delete(fn); },
      addRead: adder(reads),
      removeRead(fn) { reads.delete(fn); }
    };
  }

  // `fn` from requestIdleCallback (at most 1s later; `fn` gets its deadline), or after a `fallbackMs` timer where
  // requestIdleCallback is missing. `win` is the window, passed in so tests can fake it.
  function idle(fn, win, fallbackMs) {
    if (win.requestIdleCallback) win.requestIdleCallback(fn, { timeout: 1000 });
    else win.setTimeout(fn, fallbackMs);
  }
  // Runs `fn` once the page has painted and the browser is idle: after the next frame, when idle, or 200ms after
  // that frame where requestIdleCallback is missing.
  function afterPaint(fn, win) { win.requestAnimationFrame(() => idle(fn, win, 200)); }
  // The next step of work already started after paint: when idle, or as a task of its own where
  // requestIdleCallback is missing, so a chain of steps does not wait 200ms between steps.
  function whenIdle(fn, win) { idle(fn, win, 0); }

  // What a keydown does to the intro loader: "close", "close-no-scroll" for a scroll key (the caller also
  // cancels the scroll), or "ignore" for a modifier on its own or a shortcut with Cmd, Ctrl or Alt held.
  const MODIFIERS = ["Meta", "Control", "Alt", "Shift"];
  const SCROLL_KEYS = [" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"];
  function loaderKey(e) {
    if (MODIFIERS.includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return "ignore";
    return SCROLL_KEYS.includes(e.key) ? "close-no-scroll" : "close";
  }

  // Whether an IntersectionObserver entry has `threshold` of its target on screen. Firefox may report
  // isIntersecting below the threshold, so the ratio is checked too.
  const inView = (entry, threshold) => entry.isIntersecting && entry.intersectionRatio >= threshold;

  const api = {
    scrambleText, easeOutCubic, easeOutQuart, easeInOutQuad, loaderState, formatCount, countFrame, runsFrame,
    litPercent, londonTime, stripStep, stripSkew, previewPos, lerp, decayVelocity, decayVelocityMs, frameDt,
    createLoop, afterPaint, whenIdle, loaderKey, inView, COUNT_MS, RUNS_MS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EffectsCore = api;
})(this);
