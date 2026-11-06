// The ASCII portrait in the hero and the bubbles that rise from the page to build it.
(() => {
  // Marcin's face, cropped from his portrait: a GW x GH (320x393) brightness grid, background already 0, and its
  // depth (0 far .. 1 near) from tools/portrait-depth.py, one sample every 2 grid points. Both come from
  // portrait-data.json (the face canvas's data-src), fetched after the first paint (spec AC 10).
  let LUM, DEPTH, GW, GH, ANGLE_STEP;
  const RAMP = " .'`,:;-~+=<>i!lI?/|)(1}{][rcvunxzjftLCJUYXZO0Qoahkbdpqwm*WMB8&%$#@";
  const BUB = ".:oO0";
  // Under reduced motion, or without the page loop (effects.js blocked or failed), the face is drawn once, flat,
  // without bubbles.
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.SiteLoop;
  const rootStyle = getComputedStyle(document.documentElement);
  const INK = rootStyle.getPropertyValue("--ink").trim(), MONO = rootStyle.getPropertyValue("--mono").trim();
  const MID = rootStyle.getPropertyValue("--ascii-mid").trim(), DIM = rootStyle.getPropertyValue("--ascii-dim").trim();
  const hero = document.querySelector(".hero");
  const face = document.getElementById("face"), fctx = face.getContext("2d"), heroText = document.querySelector(".hp-hero-text");
  // README "ASCII portrait", readability: face cells under a headline line, padded 12 x 10px, draw dimmer.
  // A Range gives one box per rendered text line; the element's own box would be a full-width block.
  const lineEls = document.querySelectorAll("[data-line]"), range = document.createRange(), zones = [];
  const bub = document.getElementById("bubbles"), bctx = bub.getContext("2d");

  let dpr, fs, cw, ch, FW, FH, cols, rows, c0, base, filled, glow, jitter, targets;
  let VW, VH, docH, heroTop, pointer = null, scrollTop = window.scrollY;
  // README "Background field": its font, cell, size, the cells the face covers (fmask) and one reused row.
  let ffs, fcw, fch, fcols, frows, fmask, frow;

  // 3D: the face turns a little towards the pointer (near points move more than far ones) and a soft light
  // follows it; after a few still seconds, and on touch screens, it sways slowly. Characters stay as above.
  const { sourcePoint, normalAt, lightFactor, ease, toEdge, portraitLayout, faceFade, fieldChar, cellInZones, fieldMask, coverBounds, quantise, turnKey, bubbleCount } = window.Portrait3D;
  const YAW = .17, PITCH = .1, RELIEF = .3, LIGHT = .55;   // max turn (rad), depth as share of face width, light strength
  // The turn and the light are recomputed only in these steps. A point at full relief moves
  // (d - .5) * sin(yaw) * GW * RELIEF grid points, so one angle step moves the face's nearest point a quarter of a
  // grid point; a light step of .01 changes brightness by well under one character of the ramp.
  const LIGHT_STEP = .01;                                 // ANGLE_STEP = .5 / (GW * RELIEF), set with the grids
  const FRONT = [0, 0, 1];
  let S, OX, OY, PH, faceBox, yaw = 0, pitch = 0, lx = 0, ly = 0, movedAt = -1e9, built = "";

  // Brightness of the face cells in `box` for a turn and a light: find the grid point drawn there, then sample
  // brightness around it as the flat portrait does. Cells outside the box keep their last value.
  function computeBase(yw, pt, light, box) {
    const Z = GW * RELIEF, shx = Math.sin(yw) * Z, shy = -Math.sin(pt) * Z;
    for (let y = box.y0; y < box.y1; y++) for (let x = Math.max(c0, box.x0); x < box.x1; x++) {
      const gx = ((x + .5) * cw - OX) / S, gy = ((y + .5) * ch - OY) / S;
      const [sx, sy] = sourcePoint(DEPTH, gx, gy, shx, shy), dx = sx - gx, dy = sy - gy;
      let t = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) {
        const px = Math.floor((x * cw + (i + .5) * cw / 3 - OX) / S + dx), py = Math.floor((y * ch + (j + .5) * ch / 4 - OY) / S + dy);
        if (px >= 0 && py >= 0 && px < GW && py < GH) t += LUM[py * GW + px] / 252;
      }
      const fade = faceFade((y + .5) * ch, OY + PH, PH);  // the bottom dissolves into bubbles instead of a hard edge
      let b = Math.min(1, (t / 12) * 1.15) ** 2 * (.45 + .55 * fade);
      if (b > 0 && light !== FRONT) b = Math.max(0, Math.min(1, b * lightFactor(normalAt(DEPTH, sx, sy), light, LIGHT)));
      base[y * cols + x] = b;
    }
  }

  // build: false while the loader covers the page; the turn and the light keep easing, so the face is mid-sway
  // when it lifts, but base is rebuilt only on the first frame after.
  function update3d(now, dt, build) {
    let ty, tp, tlx, tly;
    if (pointer && now - movedAt < 2.5) {
      const fx = OX + GW * S / 2, fy = heroTop - scrollTop + OY + GH * S / 2;   // face centre on screen
      const nx = toEdge(pointer.x, fx, VW), ny = toEdge(pointer.y, fy, VH);
      ty = nx * YAW; tp = -ny * PITCH; tlx = nx * .9; tly = ny * .9;
    } else {                                              // a slow sway, lit from the upper left
      ty = Math.sin(now * .45) * YAW * .7; tp = Math.sin(now * .31 + 1) * PITCH * .5; tlx = -.35; tly = -.45;
    }
    yaw = ease(yaw, ty, dt); pitch = ease(pitch, tp, dt); lx = ease(lx, tlx, dt); ly = ease(ly, tly, dt);
    if (!build) return;
    const key = turnKey(yaw, pitch, lx, ly, ANGLE_STEP, LIGHT_STEP);
    if (key === built) return;
    built = key;
    const q = v => quantise(v, ANGLE_STEP), ql = v => quantise(v, LIGHT_STEP);
    computeBase(q(yaw), q(pitch), [ql(lx), ql(ly), 1], faceBox);
  }
  // bubbles as parallel arrays
  let N = 0, bx0, by, sy0, vy, age, tgt, ph, amp, wave, chr;
  // The stream follows the face: full while it is forming, a light trickle once it is mostly there.
  let fillFrac = 0, steadyMax = 0, activeSteady = 0, sinceCheck = 0;
  const desired = () => Math.round(steadyMax * Math.max(.08, Math.min(1, (1 - fillFrac) / .35)));
  function updateFill() { let f = 0; for (const k of targets) f += filled[k]; fillFrac = f / targets.length; }

  // The measure as steps: the sizes, one computeBase pass per turn, the front view, then the rest. The first measure
  // runs each step in an idle callback of its own, so none is a long task; later ones run all steps at once.
  function measureSteps() {
    let reach, grid;
    const turns = still ? [] : [[YAW, 0], [-YAW, 0], [0, PITCH], [0, -PITCH], [YAW, PITCH], [YAW, -PITCH], [-YAW, PITCH], [-YAW, -PITCH]];
    return [
      () => { measureSizes(); reach = new Float32Array(cols * rows); grid = { x0: 0, x1: cols, y0: 0, y1: rows }; },
      // Every cell the face covers at its widest turns is a target, so turning almost never clips it; the few
      // dim cells an in-between turn uncovers sit next to a target and fill when it settles.
      ...turns.map(([yw, pt]) => () => {
        computeBase(yw, pt, FRONT, grid);
        for (let k = 0; k < base.length; k++) reach[k] = Math.max(reach[k], base[k]);
      }),
      () => { computeBase(0, 0, FRONT, grid); built = ""; },
      () => measureCover(reach)
    ];
  }
  function measure() { for (const s of measureSteps()) s(); }

  function measureSizes() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    VW = window.innerWidth; VH = window.innerHeight;
    docH = document.documentElement.scrollHeight;
    heroTop = hero.getBoundingClientRect().top + window.scrollY;
    FW = face.clientWidth; FH = face.clientHeight;
    for (const [c, x, w, h] of [[face, fctx, FW, FH], [bub, bctx, VW, VH]]) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // README "ASCII portrait": anchored right and bottom (centred near the top on phones), cell .6em x 1.2em.
    const layout = portraitLayout(FW, FH, GW / GH);
    fs = layout.fontPx;
    fctx.font = fs + "px " + MONO;
    cw = fctx.measureText("M").width; ch = fs * 1.2;
    cols = Math.ceil(FW / cw); rows = Math.ceil(FH / ch);
    S = layout.pw / GW; OX = layout.x; OY = layout.y; PH = layout.ph;
    c0 = Math.max(0, Math.floor((OX - 24) / cw));       // a little room for the face to turn
    base = new Float32Array(cols * rows); glow = new Float32Array(cols * rows);
    jitter = new Int8Array(cols * rows); filled = new Uint8Array(cols * rows);
    targets = [];
  }

  function measureCover(reach) {
    const cover = new Uint8Array(cols * rows);           // cells the face can light at any turn
    for (let y = 0; y < rows; y++) for (let x = c0; x < cols; x++) {
      const fade = faceFade((y + .5) * ch, OY + PH, PH), k = y * cols + x;
      // reach is measured without the light, which brightens a cell by less than 1 + LIGHT: a lower bar
      if (base[k] > .03 || reach[k] > .03 / (1 + LIGHT)) { cover[k] = 1; if (Math.random() < fade) targets.push(k); }
    }
    // Later turns are computed only around the cells the face can reach; outside, base keeps the front values.
    faceBox = coverBounds(cover, cols, rows, 2);
    // The field leaves out every cell whose top-left falls in a face cell, so it never shows through the face.
    ffs = FW < 700 ? 10 : 13;
    fctx.font = ffs + "px " + MONO;
    fcw = fctx.measureText("M").width; fch = ffs * 1.22;
    fcols = Math.ceil(FW / fcw); frows = Math.ceil(FH / fch);
    fmask = fieldMask(cover, cols, rows, cw, ch, fcw, fch, fcols, frows); frow = new Array(fcols);
    // A ghost of the face is there from the first frame; the bubbles bring the rest.
    for (const k of targets) if (still || Math.random() < .4) filled[k] = 1;
    spawnAll();
    measureZones();
    followReveal();
  }

  // README "ASCII portrait", readability: the headline line boxes, relative to the face. Read on every measure
  // and, while the hero reveal slides the lines in, in the loop's read phase, never while drawing.
  function measureZones() {
    const box = face.getBoundingClientRect();
    zones.length = 0;
    for (const el of lineEls) {
      range.selectNodeContents(el);
      for (const z of range.getClientRects()) zones.push({ left: z.left - box.left, top: z.top - box.top, right: z.right - box.left, bottom: z.bottom - box.top });
    }
  }
  // If the lines are moving, measure them each frame until every one of their animations has finished, then once
  // more. A newer reveal replaces the older wait.
  let revealWait = null;
  function followReveal() {
    const anims = [...lineEls].flatMap(el => el.getAnimations());
    if (!anims.length || !window.SiteLoop) return;
    const wait = revealWait = {};
    window.SiteLoop.addRead(measureZones);
    Promise.allSettled(anims.map(a => a.finished)).then(() => {
      if (revealWait !== wait) return;
      revealWait = null;
      window.SiteLoop.removeRead(measureZones);
      measureZones();
    });
  }

  function spawnAll() {
    if (still) { N = 0; return; }
    const steady = bubbleCount(docH, VW, navigator.hardwareConcurrency);
    const build = Math.round(targets.length / 6);     // each bubble settles a small cluster
    N = steady + build; steadyMax = activeSteady = steady;
    bx0 = new Float32Array(N); by = new Float32Array(N); sy0 = new Float32Array(N); vy = new Float32Array(N); age = new Float32Array(N);
    tgt = new Int32Array(N); ph = new Float32Array(N); amp = new Float32Array(N); wave = new Uint8Array(N); chr = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      wave[i] = i >= steady ? 1 : 0;
      respawn(i, wave[i] ? heroTop + FH + Math.random() * VH * .9 : heroTop + FH * .5 + Math.random() * (docH - FH * .5));
    }
  }

  function respawn(i, y) {
    let k = targets[(Math.random() * targets.length) | 0];
    for (let n = 0; n < 12 && filled[k]; n++) k = targets[(Math.random() * targets.length) | 0];   // aim for a gap
    tgt[i] = k;
    bx0[i] = Math.random() * VW;                            // from anywhere across the page
    by[i] = y; sy0[i] = y; age[i] = 0;
    vy[i] = wave[i] ? 260 + Math.random() * 260 : 50 + Math.random() * 90;
    ph[i] = Math.random() * 6.28; amp[i] = 4 + Math.random() * 14;
    chr[i] = (Math.random() * BUB.length) | 0;
  }

  function settle(k) {
    const x = k % cols, y = (k / cols) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < c0 || xx >= cols || yy < 0 || yy >= rows) continue;
      const kk = yy * cols + xx;
      if (base[kk] > .03) filled[kk] = 1;
    }
    glow[k] = 1;
  }

  const cellChar = (k, t) => {
    let i = Math.floor(base[k] * (RAMP.length - 1)) + jitter[k] + Math.round(glow[k] * 8);
    return RAMP[Math.max(1, Math.min(RAMP.length - 1, i))];
  };

  // Under reduced motion the face is drawn once, so every row is drawn, not only those on screen.
  function drawFace(t, dt = 1) {
    const top = heroTop - scrollTop, offScreen = (y0, y1) => !still && (top + y1 < 0 || top + y0 > VH);
    if (offScreen(0, FH)) return;                          // hero scrolled out of view
    if (!still) update3d(t, dt, true);
    fctx.clearRect(0, 0, FW, FH);
    fctx.textBaseline = "top";

    fctx.font = ffs + "px " + MONO; fctx.fillStyle = DIM;
    for (let r = 0; r < frows; r++) {
      if (offScreen(r * fch, (r + 1) * fch)) continue;
      for (let c = 0, k = r * fcols; c < fcols; c++, k++) frow[c] = fmask[k] ? " " : fieldChar(c, r, t) || " ";
      fctx.fillText(frow.join(""), 0, r * fch);
    }

    // Each face row is drawn as runs of one colour, split where a cell moves in or out of a headline line.
    fctx.font = fs + "px " + MONO;
    for (let y = 0; y < rows; y++) {
      if (offScreen(y * ch, (y + 1) * ch)) continue;
      let run = "", runX = c0, colour = null;
      for (let x = c0; x < cols; x++) {
        const k = y * cols + x;
        if (!filled[k] || base[k] < .03) { run += " "; continue; }
        let c = cellChar(k, t);
        if (pointer) {
          const d = Math.hypot((x + .5) * cw - pointer.x, top + (y + .5) * ch - pointer.y);
          if (d < 90) c = RAMP[Math.max(1, Math.min(RAMP.length - 1, RAMP.indexOf(c) + Math.round((Math.random() - .5) * 26 * (1 - d / 90))))];
        }
        const want = cellInZones(x, y, cw, ch, zones, 12, 10) ? MID : INK;
        if (want !== colour) {
          if (colour) { fctx.fillStyle = colour; fctx.fillText(run, runX * cw, y * ch); }
          run = ""; runX = x; colour = want;
        }
        run += c;
      }
      if (colour) { fctx.fillStyle = colour; fctx.fillText(run, runX * cw, y * ch); }
    }
  }

  // draw: false while the loader covers the page; the bubbles still move and settle, so the face is as built
  // when it lifts, but nothing is drawn.
  function step(t, secs, draw) {
    // a few cells drift, a few fade so new bubbles always have somewhere to land
    for (let n = 0; n < targets.length * .01; n++) {
      const k = targets[(Math.random() * targets.length) | 0];
      jitter[k] = Math.max(-3, Math.min(3, jitter[k] + (Math.random() < .5 ? -1 : 1)));
    }
    const fade = targets.length * .001 * secs, fades = Math.floor(fade) + (Math.random() < fade % 1 ? 1 : 0);   // fractional rate, not one per frame
    for (let n = 0; n < fades; n++) filled[targets[(Math.random() * targets.length) | 0]] = 0;
    if ((sinceCheck += secs) > .5) {
      sinceCheck = 0; updateFill();
      for (let i = 0; i < N && activeSteady < desired(); i++) if (wave[i] === 2) { wave[i] = 0; respawn(i, docH + Math.random() * 120); activeSteady++; }
    }
    for (let k = 0; k < glow.length; k++) if (glow[k] > 0) glow[k] = Math.max(0, glow[k] - secs * 2.5);

    const sy = scrollTop;
    if (draw) {
      bctx.clearRect(0, 0, VW, VH);
      bctx.font = fs + 1 + "px " + MONO;
      bctx.textBaseline = "top"; bctx.fillStyle = INK;
    }
    for (let i = 0; i < N; i++) {
      if (wave[i] === 2) continue;                          // build bubble already landed
      age[i] += secs;
      vy[i] = Math.min(520, vy[i] + secs * (wave[i] ? 60 : 22));
      by[i] -= vy[i] * secs;
      const k = tgt[i], tx = (k % cols + .5) * cw, ty = heroTop + ((k / cols | 0) + .5) * ch;
      const dist = by[i] - ty;
      if (dist <= 0) {
        settle(k);
        if (wave[i]) wave[i] = 2;
        else if (activeSteady > desired()) { wave[i] = 2; activeSteady--; }
        else respawn(i, docH + Math.random() * 120);
        continue;
      }
      if (!draw) continue;
      const near = Math.max(0, 1 - dist / 220);             // 0 far below, 1 at the face
      const p = Math.max(0, Math.min(1, 1 - dist / Math.max(1, sy0[i] - ty)));   // share of the climb done
      const x = bx0[i] + (tx - bx0[i]) * p * p + Math.sin(age[i] * 2.4 + ph[i]) * amp[i] * (1 - p);
      const y = by[i] - sy;
      if (y < -12 || y > VH + 12) continue;
      bctx.globalAlpha = .16 + .7 * near;
      if (near <= .8) { bctx.fillText(BUB[chr[i]], x, y); continue; }
      // Close in, it shows its cell's character, dimmed like the face under a headline line.
      const under = cellInZones(k % cols, k / cols | 0, cw, ch, zones, 12, 10);
      if (under) bctx.fillStyle = MID;
      bctx.fillText(cellChar(k, t), x, y);
      if (under) bctx.fillStyle = INK;
    }
    if (draw) bctx.globalAlpha = 1;
  }

  window.addEventListener("pointermove", e => { pointer = { x: e.clientX, y: e.clientY }; if (e.pointerType !== "touch") movedAt = performance.now() / 1000; }, { passive: true });
  document.addEventListener("pointerleave", () => { pointer = null; });
  // Until the first measure has run there is nothing to resize or re-measure; one asked for meanwhile runs it again.
  let ready = false, stale = false, rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (!ready) { stale = true; return; }
      // A phone toolbar showing or hiding changes only the height: resize the bubble layer, keep the face as it is.
      if (window.innerWidth === VW && face.clientHeight === FH) {
        VH = window.innerHeight; docH = document.documentElement.scrollHeight;
        bub.height = Math.round(VH * dpr); bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return;
      }
      measure(); drawFace(0);
    }, 150);
  });
  // Frames read the scroll position from here, not from the layout.
  window.addEventListener("scroll", () => { scrollTop = window.scrollY; }, { passive: true });
  // The hero reveal (effects.js intro) may start before or after the first measure.
  heroText.addEventListener("transitionrun", followReveal);
  // Without the page loop the head script drops html.motion after 4s and the lines jump into place with no
  // transition, so measure them and draw once more then. Under reduced motion html.motion is never set.
  const root = document.documentElement;
  if (still && root.classList.contains("motion")) new MutationObserver((_, obs) => {
    if (root.classList.contains("motion")) return;
    obs.disconnect();
    if (ready) { measureZones(); drawFace(0); }
  }).observe(root, { attributeFilter: ["class"] });

  // The page loop's dt is in 60fps frames; step() takes seconds. The bubbles run across the page, the face
  // draws only while the hero is on screen. While the intro loader covers the page (<html class="intro">)
  // neither canvas is drawn; the check stays here, so the one-time draw after the first measure still happens.
  const covered = () => document.documentElement.classList.contains("intro");
  function run() {
    drawFace(0);
    if (still) return;
    window.SiteLoop.add((dt, now) => step(now / 1000, dt / 60, !covered()));
    window.SiteLoop.whileVisible(face, (dt, now) => {
      if (covered()) update3d(now / 1000, dt, false); else drawFace(now / 1000, dt);
    });
  }

  // Spec AC 2: the face starts after the first paint, its first measure spread over idle callbacks, one step each.
  const core = window.EffectsCore;
  const afterPaint = fn => core ? core.afterPaint(fn, window) : setTimeout(fn, 0);
  const whenIdle = fn => core ? core.whenIdle(fn, window) : setTimeout(fn, 0);
  function firstMeasure(next) {
    stale = false;
    const steps = measureSteps();
    const doStep = () => {
      steps.shift()();
      if (stale) return firstMeasure(whenIdle);
      if (steps.length) return whenIdle(doStep);
      ready = true;
      run();
    };
    next(doStep);
  }
  // The grids arrive as base64, which a data: URL fetch decodes. Until they are in, ready stays false, so a resize
  // or the font arriving waits too. If they fail, the face stays empty; the hero text is in the HTML.
  const bytes = b64 => fetch("data:;base64," + b64).then(r => r.arrayBuffer()).then(b => new Uint8Array(b));
  const loadGrids = () => fetch(face.dataset.src).then(r => {
    if (!r.ok) throw new Error("portrait-data.json: HTTP " + r.status);
    return r.json();
  }).then(({ lum, depth }) => Promise.all([bytes(lum.b64), bytes(depth.b64)]).then(([l, d]) => {
    LUM = l; GW = lum.w; GH = lum.h; ANGLE_STEP = .5 / (GW * RELIEF); DEPTH = { w: depth.w, h: depth.h, scale: depth.scale, data: d };
  }));
  afterPaint(() => loadGrids().then(() => firstMeasure(whenIdle), e => console.error(e)));
  // Re-measure once Geist Mono is in: the cell width comes from the font. During the first measure that matters
  // only once its first step has read the cell width (cw).
  document.fonts.load("7px " + MONO).then(() => document.fonts.ready).then(() => {
    if (ready) { measure(); drawFace(0); } else if (cw) stale = true;
  }, () => {});
})();
