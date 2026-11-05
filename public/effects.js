// The home page runtime: the page's one frame loop (window.SiteLoop), the intro loader, the hero line reveal,
// reveal on scroll, the header clock, the text scramble (window.SiteEffects.scramble), the custom cursor, the
// scroll-lit approach text, the strip, the study's count-up and runs grids, and the work row preview panel. The maths is in effects-core.js. The <head> script in index.html adds
// `motion` (and `intro` while this tab has not seen the loader) to <html>; styles.css keeps start states under
// those classes only, and the head script drops them after 4s unless this file has set data-fx="on".
(() => {
  const root = document.documentElement, core = window.EffectsCore, LOADER_KEY = "loader-seen";
  let loader = null;
  const bail = () => { root.classList.remove("intro", "motion"); if (loader) loader.remove(); };
  if (!core) { bail(); return; }

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  };

  let loop = null;
  const motion = () => root.classList.contains("motion");

  // README "Text scramble": `node`'s text resolves into `to` over `ms`; a new call on the same element replaces
  // the running one. Without motion the text is swapped at once.
  const scrambles = new WeakMap();
  function scramble(node, to, ms = 650) {
    loop.remove(scrambles.get(node));
    if (!motion()) { node.textContent = to; return; }
    const from = node.textContent, start = performance.now();
    const step = (dt, now) => {
      const p = (now - start) / ms;
      node.textContent = core.scrambleText(from, to, p, Math.random);
      if (p >= 1) loop.remove(step);
    };
    scrambles.set(node, step);
    loop.add(step);
  }

  // Links and the email ([data-scramble]) scramble on hover; an H2's [data-scramble-part] lines do too, 700ms
  // each, 90ms apart. Label <h2>s carry neither attribute and stay still. Hover effects are desktop only.
  function setupScramble() {
    const hover = matchMedia("(hover: hover)");
    document.querySelectorAll("[data-scramble]").forEach(node => {
      const text = node.textContent;
      node.addEventListener("mouseenter", () => { if (hover.matches) scramble(node, text); });
    });
    document.querySelectorAll("[data-scramble-group]").forEach(group => {
      const parts = [...group.querySelectorAll("[data-scramble-part]")].map(node => [node, node.textContent]);
      group.addEventListener("mouseenter", () => {
        if (hover.matches) parts.forEach(([node, text], i) => setTimeout(() => scramble(node, text, 700), i * 90));
      });
    });
  }

  // The hero headline lines slide up (styles.css, html.hero-in) and the greeting scrambles in 350ms later.
  function intro() {
    const line = document.querySelector("[data-line]");
    if (line) void getComputedStyle(line).transform;  // commit the start state so the change transitions
    root.classList.add("hero-in");
    const hi = document.querySelector("[data-hi]");
    if (!hi) return;
    const text = hi.textContent;
    hi.textContent = "";
    setTimeout(() => scramble(hi, text, 1000), 350);
  }

  // The header clock: Europe/London HH:MM:SS, every second.
  function setupClock() {
    const clock = document.querySelector("[data-clock]");
    if (!clock) return;
    const tick = () => { clock.textContent = core.londonTime(new Date()); };
    tick();
    setInterval(tick, 1000);
  }

  // README "Custom cursor": a 10px accent square that follows the pointer at .25 and grows to a 56px circle
  // outline (.is-hot) at .2 over links and buttons. Not created on (hover: none). Without motion it snaps.
  // It runs in the loop only until it has caught up with the pointer.
  function setupCursor() {
    if (matchMedia("(hover: none)").matches) return;
    const cursor = el("div", "hp-cursor");
    cursor.setAttribute("aria-hidden", "true");
    document.body.append(cursor);
    const target = { x: 0, y: 0, s: 10 };
    let cur = null;
    const step = dt => {
      const smooth = motion() && cur;
      cur = smooth ? {
        x: core.lerp(cur.x, target.x, .25, dt), y: core.lerp(cur.y, target.y, .25, dt), s: core.lerp(cur.s, target.s, .2, dt)
      } : { ...target };
      if (Math.abs(cur.x - target.x) < .1 && Math.abs(cur.y - target.y) < .1 && Math.abs(cur.s - target.s) < .05) {
        cur = { ...target };
        loop.remove(step);
      }
      cursor.style.width = cursor.style.height = cur.s + "px";
      cursor.style.transform = "translate3d(" + (cur.x - cur.s / 2) + "px," + (cur.y - cur.s / 2) + "px,0)";
    };
    window.addEventListener("pointermove", e => {
      if (e.pointerType === "touch") return;
      target.x = e.clientX;
      target.y = e.clientY;
      loop.add(step);
    }, { passive: true });
    document.addEventListener("mouseover", e => {
      const hot = !!e.target.closest("a, button");
      cursor.classList.toggle("is-hot", hot);
      target.s = hot ? 56 : 10;
      if (cur) loop.add(step);
    });
    // Off the window: hide it at once and snap back on the way in.
    root.addEventListener("mouseleave", () => {
      loop.remove(step);
      cur = null;
      cursor.style.transform = "";
    });
  }

  // [data-io] elements rise in once, when 12% of them is on screen (README "Scroll reveal").
  function setupReveal() {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!core.inView(e, .12)) return;
      io.unobserve(e.target);
      e.target.classList.add("is-in");
    }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll("[data-io]").forEach(node => io.observe(node));
  }

  // README section 3: the approach text lights in reading order as it scrolls through the viewport. styles.css
  // draws the gradient from --ink to --ascii-dim around --lit under .is-lit; this sets --lit while it is on screen.
  function setupLitText() {
    document.querySelectorAll("[data-words]").forEach(node => {
      let last = null;
      const step = () => {
        const r = node.getBoundingClientRect(), pct = core.litPercent(r.top, r.height, window.innerHeight);
        if (pct !== last) node.style.setProperty("--lit", (last = pct) + "%");
      };
      step();
      node.classList.add("is-lit");
      window.SiteLoop.whileVisible(node, step);
    });
  }

  // README section 4: the strip drifts left (or right after scrolling up), faster and skewed while the page
  // scrolls, and wraps at half its width. Scroll velocity loses 10% a frame; it is kept with the time it was
  // last set, so it decays the same while the strip is off screen and its frame is not running.
  function setupStrip() {
    const track = document.querySelector("[data-track]");
    if (!track) return;
    let half = 0, x = 0, vel = 0, velAt = 0, dir = 1, lastY = window.scrollY;
    const measure = () => { half = track.scrollWidth / 2; };
    const velocity = now => core.decayVelocityMs(vel, now - velAt);
    window.addEventListener("scroll", () => {
      const y = window.scrollY, d = y - lastY, now = performance.now();
      lastY = y;
      vel = velocity(now) + d;
      velAt = now;
      if (d) dir = d > 0 ? 1 : -1;
    }, { passive: true });
    window.addEventListener("resize", measure);
    if (document.fonts) document.fonts.ready.then(measure);
    measure();
    window.SiteLoop.whileVisible(track, (dt, now) => {
      if (!(half > 0)) return;
      const v = velocity(now);
      x = core.stripStep(x, half, v, dir, dt);
      track.style.transform = "translate3d(" + x + "px,0,0) skewX(" + core.stripSkew(v) + "deg)";
    });
  }

  // Runs `render(elapsedMs)` from the loop once `threshold` of `node` is on screen, while it stays on screen,
  // until `render` returns true (finished).
  function playOnce(node, threshold, render) {
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => core.inView(e, threshold))) return;
      io.disconnect();
      const start = performance.now();
      const stop = window.SiteLoop.whileVisible(node, (dt, now) => { if (render(now - start)) stop(); });
    }, { threshold });
    io.observe(node);
  }

  // README section 5: the study's counter counts up from 0 over 2.4s once 40% of it is in view. Without motion
  // it keeps the final count the HTML shows.
  function setupCount() {
    document.querySelectorAll("[data-count]").forEach(node => {
      const target = +node.dataset.count;
      node.textContent = core.countFrame(target, 0);
      playOnce(node, .4, ms => {
        node.textContent = core.countFrame(target, ms);
        return ms >= core.COUNT_MS;
      });
    });
  }

  // README section 5: each runs grid shows the study's real runs from study-runs.json, # where the rule held and
  // x where it broke. The HTML holds the empty first frame. With motion each grid fills over 3s once 35% of the
  // block is in view, later models a little behind; without motion it is drawn full at once. Held, broke,
  // current and pending cells are spans that styles.css colours.
  const runsData = fetch("/study-runs.json").then(r => {
    if (!r.ok) throw new Error("study-runs.json: HTTP " + r.status);
    return r.json();
  });
  function setupRuns() {
    const host = document.querySelector("[data-runs-host]"), pres = [...document.querySelectorAll("[data-runs]")];
    if (!host || !pres.length) return;
    runsData.then(data => {
      const render = p => pres.forEach((pre, i) => {
        const frag = document.createDocumentFragment();
        core.runsFrame(p, i, data.runs[pre.dataset.runs]).forEach((line, r) => {
          if (r) frag.append("\n");
          line.forEach(seg => frag.append(el("span", "hp-run-" + seg.state, seg.text)));
        });
        pre.replaceChildren(frag);
      });
      if (!motion()) { render(1); return; }
      render(0);
      playOnce(host, .35, ms => {
        render(ms / core.RUNS_MS);
        return ms >= core.RUNS_MS;
      });
    }).catch(e => console.error(e));
  }

  // README section 5 "Hover preview panel": over a [data-preview] row a 320px panel, cloned from
  // <template id="preview-{name}">, follows the pointer (+28px, kept in the viewport) at .14 and leans into the
  // distance still to go; it fades in and out (styles.css). Desktop only. Without motion it snaps, unrotated.
  function setupPreview() {
    if (!matchMedia("(hover: hover)").matches) return;
    document.querySelectorAll("[data-preview]").forEach(row => {
      const tpl = document.getElementById("preview-" + row.dataset.preview);
      if (!tpl) return;
      const panel = el("div", "hp-pv");
      panel.setAttribute("aria-hidden", "true");
      panel.append(tpl.content.cloneNode(true));
      panel.style.opacity = "0";
      document.body.append(panel);
      const pointer = { x: 0, y: 0 };
      let cur = null;
      const step = dt => {
        cur = core.previewPos(pointer, motion() ? cur : null, { w: window.innerWidth, h: window.innerHeight }, dt);
        panel.style.transform = "translate3d(" + cur.x + "px," + cur.y + "px,0) rotate(" + cur.rot + "deg)";
      };
      const track = e => { pointer.x = e.clientX; pointer.y = e.clientY; };
      row.addEventListener("mouseenter", e => {
        track(e);
        cur = null;
        step(1);
        panel.style.opacity = "1";
        loop.add(step);
      });
      row.addEventListener("mousemove", track);
      row.addEventListener("mouseleave", () => {
        loop.remove(step);
        panel.style.opacity = "0";
      });
    });
  }

  // README section 0: 1.7s of counter and bar, a 220ms hold, then a 1s wipe up. A click or a key (not a
  // modifier or a shortcut) skips it and a 2.6s timer closes it if frames are throttled. Shown once per tab.
  // `onClose` runs as it starts to close.
  function setupLoader(onClose) {
    try { sessionStorage.setItem(LOADER_KEY, "1"); } catch (e) {}
    const bar = el("pre", "hp-loader-bar"), num = el("span", "hp-loader-num");
    const show = state => { num.textContent = state.count; bar.textContent = state.bar; };
    const head = el("div", "hp-loader-row");
    head.append(el("span", "", "marcinurbanski.dev"), el("span", "", "running checks"));
    const foot = el("div", "hp-loader-row hp-loader-foot");
    foot.append(bar, num);
    loader = el("div", "hp-loader");
    loader.setAttribute("aria-hidden", "true");
    loader.append(head, foot);
    show(core.loaderState(0));

    const start = performance.now();
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      loop.remove(step);
      document.removeEventListener("keydown", onKey);
      loader.classList.add("is-out");
      root.classList.remove("intro");
      try { onClose(); } catch (e) { console.error(e); bail(); }
      setTimeout(intro, 250);
      setTimeout(() => loader.remove(), 1100);
    };
    // A modifier or a shortcut leaves it; a scroll key closes it without also scrolling the page.
    const onKey = e => {
      const action = core.loaderKey(e);
      if (action === "ignore") return;
      if (action === "close-no-scroll") e.preventDefault();
      close();
    };
    const step = (dt, now) => {
      const state = core.loaderState(now - start);
      show(state);
      if (state.done) { loop.remove(step); setTimeout(close, 220); }
    };
    loader.addEventListener("click", close, { once: true });
    document.addEventListener("keydown", onKey);
    setTimeout(close, 2600);
    document.body.append(loader);
    loop.add(step);
  }

  try {
    loop = core.createLoop(frame => requestAnimationFrame(frame), e => console.error(e));
    window.SiteLoop = {
      add: loop.add,
      remove: loop.remove,
      // Read callbacks run before the others in each frame, so their layout reads never follow a style write.
      addRead: loop.addRead,
      removeRead: loop.removeRead,
      // Runs `fn` in the loop only while `node` is on screen; the returned function stops it for good.
      whileVisible(node, fn) {
        const io = new IntersectionObserver(entries => {
          if (entries[entries.length - 1].isIntersecting) loop.add(fn); else loop.remove(fn);
        });
        io.observe(node);
        return () => { io.disconnect(); loop.remove(fn); };
      }
    };
    window.SiteEffects = { scramble };
    setupClock();
    setupCursor();
    setupPreview();
    // Without motion nothing plays, but the runs grids still need their results drawn in, full at once.
    if (!motion()) setupRuns();
    if (motion()) {
      setupScramble();
      setupLitText();
      setupStrip();
      // The reveals, count-up and runs grids play once, so with the loader they wait for it to close (spec
      // decision 8): a visitor arriving at /#work sees them instead of finding them done behind the loader.
      const oneShots = () => { setupReveal(); setupCount(); setupRuns(); };
      if (root.classList.contains("intro")) setupLoader(oneShots); else { oneShots(); intro(); }
    }
    root.dataset.fx = "on";
  } catch (e) {
    console.error(e);
    bail();
  }
})();
