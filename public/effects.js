// The home page runtime: the page's one frame loop (window.SiteLoop), the intro loader, the hero line reveal and
// reveal on scroll. The maths is in effects-core.js. The <head> script in index.html adds `motion` (and `intro`
// while this tab has not seen the loader) to <html>; styles.css keeps start states under those classes only, and
// the head script drops them after 4s unless this file has set data-fx="on".
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

  // The hero headline lines slide up (styles.css, html.hero-in); later tasks add the greeting scramble here.
  function intro() {
    const line = document.querySelector("[data-line]");
    if (line) void getComputedStyle(line).transform;  // commit the start state so the change transitions
    root.classList.add("hero-in");
  }

  // [data-io] elements rise in once, when 12% of them is on screen (README "Scroll reveal").
  function setupReveal() {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.classList.add("is-in");
    }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll("[data-io]").forEach(node => io.observe(node));
  }

  // README section 0: 1.7s of counter, bar and log, a 220ms hold, then a 1s wipe up. A click skips it and a
  // 2.6s timer closes it if frames are throttled. Shown once per tab.
  function setupLoader(loop) {
    try { sessionStorage.setItem(LOADER_KEY, "1"); } catch (e) {}
    const log = el("pre", "hp-loader-log"), bar = el("pre", "hp-loader-bar"), num = el("span", "hp-loader-num");
    const show = state => { num.textContent = state.count; bar.textContent = state.bar; log.textContent = state.lines.join("\n"); };
    const head = el("div", "hp-loader-row");
    head.append(el("span", "", "marcinurbanski.dev"), el("span", "", "running checks"));
    const logs = el("div", "hp-loader-logs");
    logs.append(log, bar);
    const foot = el("div", "hp-loader-row hp-loader-foot");
    foot.append(logs, num);
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
      loader.classList.add("is-out");
      root.classList.remove("intro");
      setTimeout(intro, 250);
      setTimeout(() => loader.remove(), 1100);
    };
    const step = (dt, now) => {
      const state = core.loaderState(now - start);
      show(state);
      if (state.done) { loop.remove(step); setTimeout(close, 220); }
    };
    loader.addEventListener("click", close, { once: true });
    setTimeout(close, 2600);
    document.body.append(loader);
    loop.add(step);
  }

  try {
    const loop = core.createLoop(frame => requestAnimationFrame(frame), e => console.error(e));
    window.SiteLoop = {
      add: loop.add,
      remove: loop.remove,
      // Runs `fn` in the loop only while `node` is on screen.
      whileVisible(node, fn) {
        new IntersectionObserver(entries => {
          if (entries[entries.length - 1].isIntersecting) loop.add(fn); else loop.remove(fn);
        }).observe(node);
      }
    };
    if (root.classList.contains("motion")) {
      setupReveal();
      if (root.classList.contains("intro")) setupLoader(loop); else intro();
    }
    root.dataset.fx = "on";
  } catch (e) {
    console.error(e);
    bail();
  }
})();
