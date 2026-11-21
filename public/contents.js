// A post's contents (contents-core.js has the maths). From 1000px it opens the <details>, which the CSS turns into
// a sticky column, where it also hides the subsections of every section but the current one. On every width it
// marks the link of the heading being read (and its section's link) and adds a hash bar with the minutes left.
// Without it the contents are a plain "+ contents" list with every subsection.
(() => {
  const C = window.Contents, nav = document.querySelector(".post-toc"), post = document.querySelector(".post");
  if (!C || !nav || !post) return;
  const details = nav.querySelector("details");
  const links = [...nav.querySelectorAll("a[href^='#']")];
  const heads = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1))));
  if (!details || !links.length || heads.some(h => !h)) return;
  const minutes = Number((details.querySelector("summary").textContent.match(/(\d+) min/) || [0, 0])[1]);
  const CELLS = 20, LINE = 120;

  // Each link's section: the nearest top-level item at or before it.
  const sections = [...nav.querySelectorAll(":scope > details > ol > li")];
  const sectionOf = links.map(a => sections.findIndex(li => li.contains(a)));
  const sectionLink = sections.map(li => links.indexOf(li.querySelector("a")));

  const bar = document.createElement("p");
  bar.className = "post-toc-bar";
  bar.setAttribute("aria-hidden", "true");
  bar.innerHTML = '<span class="post-toc-hashes"><span class="on"></span><span class="off"></span></span>' +
    '<span class="post-toc-meta"><span></span><span></span></span>';
  details.append(bar);
  const [on, off] = bar.querySelectorAll(".post-toc-hashes span"), [pct, left] = bar.querySelectorAll(".post-toc-meta span");

  const wide = matchMedia("(min-width: 1000px)");
  // The heading the reader last jumped to (a contents link or the address's #), until they scroll by hand.
  const indexOf = hash => links.findIndex(a => a.hash === hash);
  let jumped = indexOf(location.hash), frame = 0;
  const update = () => {
    frame = 0;
    const box = post.getBoundingClientRect(), p = C.readingProgress(box.top, box.height, innerHeight);
    const atEnd = C.atPageEnd(scrollY, innerHeight, document.documentElement.scrollHeight);
    const i = C.currentHeading(heads.map(h => h.getBoundingClientRect().top), LINE, atEnd, jumped);
    const s = i < 0 ? -1 : sectionOf[i];
    links.forEach((a, j) => {
      a.classList.toggle("is-on", j === i || j === sectionLink[s]);
      if (j === i) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
    // Only the sticky column folds subsections away; the narrow list sits above the text and keeps them all.
    sections.forEach((li, k) => { const sub = li.querySelector("ol"); if (sub) sub.hidden = wide.matches && k !== s; });
    const cells = C.readingBar(p, CELLS);
    on.textContent = cells.on;
    off.textContent = cells.off;
    pct.textContent = Math.round(p * 100) + "%";
    left.textContent = C.minutesLeft(p, minutes);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  const jump = hash => { jumped = indexOf(hash); schedule(); };
  nav.addEventListener("click", e => {
    const a = e.target.closest("a[href^='#']");
    // A modified click opens a new tab or window and leaves this page where it is.
    if (a && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) jump(a.hash);
  });
  addEventListener("hashchange", () => jump(location.hash));
  const byHand = () => { if (jumped >= 0) { jumped = -1; schedule(); } };
  addEventListener("wheel", byHand, { passive: true });
  addEventListener("touchmove", byHand, { passive: true });
  const SCROLL_KEYS = [" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"];
  addEventListener("keydown", e => { if (SCROLL_KEYS.includes(e.key)) byHand(); });
  const fit = () => { if (wide.matches) details.open = true; schedule(); };
  wide.addEventListener("change", fit);
  fit();
})();
