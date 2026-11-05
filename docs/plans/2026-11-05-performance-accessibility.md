# Plan: performance, accessibility and sharing pass

- **Goal:** the spec's 21 acceptance criteria, with no visible change to the design.
- **Spec:** [docs/specs/2026-11-05-performance-accessibility.md](../specs/2026-11-05-performance-accessibility.md)
  (decisions: no JS minifying; measure locally; loader CLS fixed by reserving width, tabular digits only if that
  fails; plan-review answers recorded at the end of the spec).
- **Branch:** `feature/perf-a11y-pass`, one PR. Tasks 1–10.

## Global constraints (every task)

- Read `CODING_STANDARDS.md` first. Static files only, no build step, no npm runtime dependency (rule 1). Colours and
  fonts from `:root` tokens (rule 2). Every animation has a reduced-motion path and runs from the one loop only while
  visible (rule 3). Content in the HTML, readable with JS off; scripts only decorate (rule 4). Pure logic in the dual
  browser/CommonJS files (`public/effects-core.js`, `public/portrait-3d.js`) with tests in `tests/` (rule 5); a pure
  function goes there only when page code calls it.
- **Scratchpad tools** (not in the repo), `SP=/private/tmp/claude-501/-Users-marcinurbanski-Developer-marcinurbanski-dev/3bdeb816-f1c2-45d9-8fea-e6cbaa3c830d/scratchpad`,
  and `export PPT=$(npm root -g)/lighthouse/node_modules/puppeteer-core` before running them:
  - `node $SP/shots.js capture <dir>` then `node $SP/shots.js diff $SP/shots/before <dir>`: full-page screenshots of
    `/`, the post and the 404 at 1280×800 and 412×915, with and without JS, under reduced motion, with the face
    canvas and clock hidden. `shots/before` is `main`. Expected: "all identical" unless a task names a difference.
  - `node $SP/profile.js http://localhost:8788/ 6`: self time per function, mobile emulation, 4× CPU throttle.
    `main`'s portrait total (all portrait.js and portrait-3d.js functions) is about 3,300 ms over 6 s.
  - Lighthouse: `lighthouse http://localhost:8788/ --quiet --chrome-flags="--headless=new" --output=json
    --output-path=<file> --only-categories=performance,accessibility,best-practices,seo`;
    `node $SP/lhsum.js <files>` prints scores, metrics, JS per file, layout shifts and insights.
- The dev server is `wrangler pages dev --port 8788` (normally already running on http://localhost:8788; if not,
  start it in the background and stop it when done). Animated behaviour is checked by eye in a browser at 1280 and
  412 px wide, on a fresh tab (empty `sessionStorage`) and a second load (no loader).
- **Asset versions.** After changing any JS or CSS file, run `node tools/asset-versions.js`; the test "every page
  links each local script and stylesheet at its current version" fails otherwise.
- **Tests:** `node --test tests/` passes after every task. An existing assertion that the spec deliberately changes is
  updated to the new expectation in the same commit and named in the commit body; no other test is weakened or
  deleted. Note `tests/home-page.test.js:367-373` asserts portrait.js never names `requestAnimationFrame`: keep it so.
- **Dependencies:** none added to the project. Offline tools in `tools/` may use what is installed on the machine
  (Chrome at `/Applications/Google Chrome.app`, `sips`, Python 3; `pip3 install --user fonttools brotli` is allowed).
- **No layout reads in loop callbacks** (AC 5): no `getBoundingClientRect`, `getClientRects`, `scrollX`/`scrollY`,
  `innerWidth`/`innerHeight`, `clientWidth`/`clientHeight` or `scrollHeight` inside a function the loop calls each
  frame. Scroll position comes from a variable kept by a passive `scroll` listener; sizes from `measure()`/resize.
  The one exception is a callback registered with the loop's read phase (task 2), which runs before any writer.
- English in code, comments and commits; conventional commit messages, no Co-Authored-By. Match the house style
  (comments say what and why in full sentences, README sections referenced as in existing comments). Update
  README.md / DEPLOY.md and any comment the change makes stale.

## Tasks

### 1. Portrait: compute and draw less

**In short:** the moving face costs well under half the CPU it does now and looks the same.

Files: `public/portrait.js`, `public/portrait-3d.js`, `tests/portrait-3d.test.js`.

- New pure functions in portrait-3d.js, tests first:
  - `coverBounds(cover, cols, rows, margin)` → `{ x0, x1, y0, y1 }` (inclusive-exclusive), the box of the set cells
    grown by `margin` and clipped to the grid; an all-zero mask → an empty box (`x0 === x1`).
  - `turnKey(yaw, pitch, lx, ly, angleStep, lightStep)` → a string; values in the same step map to the same key,
    values a step apart to different keys; plus `quantise(v, step)` (round to the nearest multiple) used for both.
  - `bubbleCount(docH, viewportW, cores)`: `round(min(900, docH / 4) * (vw < 860 ? .6 : 1) * (cores <= 4 ? .6 : 1))`
    when `cores` is a number, otherwise without the last factor (today's value). `spawnAll()` uses it with
    `navigator.hardwareConcurrency`.
- `computeBase(yw, pt, light, box)` visits only cells in `box`. `measure()` passes the full grid box to its nine
  calls (no tenth call: the ninth, front-facing one already gives `base`), builds `cover`, then sets the module's
  `faceBox = coverBounds(cover, cols, rows, 2)`. Every `measure()` (resize too, the `still` path too) recomputes it.
- Quantised turn in `update3d`: angle step `.5 / (GW * RELIEF)` rad (a point at full relief moves
  `(d - .5) * sin(yaw) * GW * RELIEF`, so this is a quarter of a grid point at the face's nearest point); light step
  .01. `computeBase` runs only when `turnKey` changes, and with the quantised values.
- Behind the loader: while `document.documentElement.classList.contains("intro")`, the face's loop callback does not
  call `drawFace`, and the bubbles' loop callback skips the canvas work (clear, `fillText`, any `scrollY` read) but
  keeps moving and settling bubbles, so the face is as built as today when the loader lifts (spec AC 3 as amended).
  No `computeBase` while drawing is skipped. The check sits only in the two loop callbacks, never in `drawFace` or
  the `still` path: if effects.js fails, `intro` stays up to 4 s and the one-time flat draw must still happen.
- Scroll: a passive `scroll` listener keeps `scrollTop`; `drawFace`, `update3d` and `step` use it instead of
  `window.scrollY`.

Done check: tests pass; screenshot diff "all identical"; by eye at 1280 and 412: loader then face build, sway,
pointer turn (desktop), bubbles as on `main`; profile: the sum of all portrait.js and portrait-3d.js functions at most
40 % of `main`'s (≤ ~1,300 ms over 6 s).

### 2. Portrait: start after paint, measure headline boxes off the frame, reduced motion

**In short:** the face starts once the page is up and reads no layout during animation frames.

Files: `public/effects-core.js`, `tests/effects-core.test.js`, `public/portrait.js`.

- New pure-ish helper `afterPaint(fn, win)` in effects-core.js: `win.requestAnimationFrame` then
  `win.requestIdleCallback(fn, { timeout: 1000 })`, or `win.setTimeout(fn, 200)` when `requestIdleCallback` is
  missing. Tests with fake `win` objects for both branches. portrait.js calls `window.EffectsCore.afterPaint` (it never
  names `requestAnimationFrame`); without `window.EffectsCore` it uses `setTimeout(fn, 0)`.
- portrait.js start, split so no idle callback is a long task (TBT must not rise): `afterPaint` → the nine
  `computeBase` reach/front passes spread over separate `afterPaint`/idle callbacks (one pass each, or as many as fit
  in the idle deadline), then cover, `faceBox`, `fieldMask`, `spawnAll`, the first draw and the loop registration.
  On a first visit the loader covers about 2 s, so there is time. The resize handler and the fonts-loaded re-measure
  do nothing until that first measure has run (a later re-measure may run in one piece).
- Loop read phase: `createLoop` gains `addRead(fn)`/`removeRead(fn)`: read callbacks run first in each frame, before
  the normal ones, with the same error handling; tests in effects-core.test.js (order within a frame, removal, a
  throwing read callback dropped once). `window.SiteLoop` exposes them.
- Headline zones and the face box: `measureZones()` reads `face.getBoundingClientRect()` and the line rects; called
  from `measure()`, on resize, and, while the hero reveal runs, as a read-phase callback each frame. Live window:
  on a `transitionrun` on `.hp-hero-text` (listener attached when portrait.js runs, not in the idle start) and in
  `measure()`, collect `line.getAnimations()` of the `[data-line]` elements; if any run, add the read callback until
  `Promise.allSettled(anims.map(a => a.finished))` settles, then remove it and measure once more. A newer reveal
  replaces the older wait. `drawFace` itself reads no layout.
- Reduced motion (`still`): the face is drawn once in full (every row, not only those on screen) after the first
  measure and after fonts load; remove the `scroll` listener that redraws it.

Done check: tests pass; diff "all identical"; by eye: dimming under the headline correct during and after the reveal
on a fresh tab and on a second load (no loader), and after a window resize; reduced motion (DevTools rendering
emulation): face complete, no frames in a Performance recording; one local Lighthouse run: no long task from
portrait.js over 50 ms, TBT not above `main`'s (0–30 ms).

### 3. Portrait data as its own asset

**In short:** the 225 KB face data loads after the page appears instead of inside a script.

Files: `public/portrait.js`, new `public/portrait-data.json`, `public/index.html`, `tools/asset-versions.js`,
`tests/asset-versions.test.js`, `tests/home-page.test.js` (canvas markup test), `tools/portrait-depth.py`, README.md.

- `portrait-data.json` = `{ "lum": { "w": 320, "h": 393, "b64": "…" }, "depth": { "w": 160, "h": 197, "scale": 2,
  "b64": "…" } }`, the exact bytes now inlined. portrait.js takes `GW`/`GH` from it.
- `index.html`: `<canvas id="face" aria-hidden="true" data-src="/portrait-data.json?v=<hash>">`. `versionAssets`
  covers `.json` (its regex already matches inside `data-src="/…"`); it still leaves `/rss.xml`, images, the favicon,
  fonts and external URLs alone. The up-to-date test covers `.json`.
- portrait.js fetches `face.dataset.src` in its `afterPaint` start; every measure/draw entry point (start, resize,
  fonts) waits on that one promise; on a failed fetch it logs once and draws nothing (hero text unaffected).
- `tools/portrait-depth.py` reads `lum.b64` from portrait-data.json and writes `depth` back into it; docstring
  updated. Move its heavy imports (numpy, PIL, transformers) into the function that needs them and add a `--check`
  flag that only reads portrait-data.json, prints the grid sizes and exits. **Never run the full script** (it
  downloads a model and would rewrite the face data).
- portrait.js holds no data and is under 20,000 bytes (spec AC 10 as amended; its code alone is already ~15 KB).

Tests first: `versionAssets` versions `data-src="/x.json"`; decoded `lum` is 125,760 bytes and `depth` 31,520 and they
equal the arrays previously inlined (compare against `git show main:public/portrait.js`, once, in the test-writing
step; the committed test checks sizes and that the canvas's `data-src` is versioned).

Done check: tests pass; `wc -c public/portrait.js` < 20000 and no `atob(` in it; diff "all identical"; face
identical by eye; `python3 tools/portrait-depth.py --check` prints 320×393 and 160×197.

### 4. Scripts deferred, page effects on idle, no layout reads in frames

**In short:** no script holds up the first paint, and frames no longer force layout.

Files: `public/index.html`, `public/effects.js`, `tests/home-page.test.js`, `tests/effects-core.test.js` if pure
logic moves.

- Every `<script src>` on every page gets `defer`, order unchanged. Test: every `<script src>` has `defer`; every
  script without `src` is either the home page's head preloader or `type="application/ld+json"`.
- effects.js: the loader, `intro()`, the reveal/count/runs one-shots, lit text and strip keep their timing.
  `setupClock`, `setupCursor`, `setupPreview` and `setupScramble` run via `core.afterPaint`. `root.dataset.fx = "on"`
  stays synchronous.
- Clock: interval stops on `visibilitychange` to hidden; on visible it ticks at once and restarts.
- Reduced motion (AC 6): when `!motion()`, the cursor and the preview panel set their transform directly in their
  pointer handlers and never call `loop.add`.
- Lit text: no layout read in the frame. Its document top and height are measured on start, resize and
  `document.fonts.ready`; the frame computes `rect.top` as `docTop - scrollTop` from a passive scroll listener, and
  the viewport height from resize. The strip's frame likewise reads no layout (it already measures on resize). Update the comment at
  effects.js:37-38 about label `<h2>`s if task 8 has not.

Done check: tests pass; diff "all identical"; by eye: loader on a fresh tab with no flash of the uncovered page, clock
ticks, cursor and preview on desktop, lit text lights as on `main`; one local Lighthouse run: the forced-reflow insight
lists no site script, and no long task from a site script starts before FCP.

### 5. Self-hosted fonts with matched fallbacks

**In short:** fonts come from the site itself and text doesn't jump when they arrive.

Files: new `public/fonts/` (Geist latin and latin-ext, Geist Mono latin, Newsreader italic latin, `OFL.txt`), new
`tools/font-metrics.py`, `public/styles.css`, the three HTML pages, `CODING_STANDARDS.md` rule 1, README.md, tests.

- Download the woff2 files the current Google Fonts CSS URL serves (the URL in the HTML today, fetched with a current
  Chrome user agent): Latin for all three families, plus Geist's latin-ext (the post's "zł" needs it). Keep axes as
  served. File names carry the gstatic version, e.g. `geist-latin-v5.woff2`, `geist-latin-ext-v5.woff2`.
- `@font-face` at the top of styles.css with Google's `font-weight`/`font-style` ranges and `unicode-range`s,
  `font-display: swap`.
- Fallback faces `"Geist Fallback"` (local Arial), `"Geist Mono Fallback"` (local Menlo, then Courier New),
  `"Newsreader Fallback"` (local Georgia Italic) with `size-adjust`, `ascent-override`, `descent-override`,
  `line-gap-override` printed by `tools/font-metrics.py` (fontTools; proportional faces: average advance over Latin
  lowercase + space vs the local font; mono: advance of "M"; overrides = hhea metrics / unitsPerEm / size-adjust).
  Insert each right after its web font in `--display`/`--mono`/`--serif`. Each fallback `@font-face` carries the same
  `unicode-range` as its web font (other glyphs, like → ↗ ●, fall through to today's stack) and the matching style
  and weight: Newsreader Fallback `font-style: italic` over `local("Georgia Italic")`; Geist Fallback two faces,
  `font-weight: 300 499` over `local("Arial")` and `500 700` over `local("Arial Bold")`; Geist Mono Fallback
  `font-weight: 300 500`.
- Home page only: `<link rel="preload" href="/fonts/geist-latin-v5.woff2" as="font" type="font/woff2" crossorigin>`.
- Remove the Google Fonts `preconnect` and stylesheet links from all pages. CODING_STANDARDS rule 1: "Pages load only
  their own files and what Cloudflare injects (Web Analytics)." Update the test at asset-versions.test.js:19 only if
  it must change (it uses a Google Fonts URL as an example of an external URL; that stays valid).

Tests first: no page references `fonts.googleapis.com` or `fonts.gstatic.com`; every `url(/fonts/…)` in styles.css
exists; the home page preloads exactly the Geist latin file, other pages preload nothing.

Done check: tests pass; diff "all identical" (post included: "ł" is Geist); by eye with DevTools "Slow 4G": text shows
in the fallback at once and barely moves on swap; the portrait still re-measures once Geist Mono is in.

### 6. Layout shift: loader row and clock

**In short:** nothing moves on screen while the page loads.

Files: `public/styles.css`, maybe `public/effects.js`.

- Find each shift with `new PerformanceObserver(l => …).observe({ type: "layout-shift", buffered: true })` in a
  412×823 browser on a fresh tab, and with Lighthouse's `layout-shifts` audit. Fix the loader foot so the bar and the
  number keep their place as digits change: reserve the number's width (e.g. a `min-width` for three digits at its
  font, or a row that never wraps/unwraps between counts), no visible change at rest; only if that cannot hold,
  `font-variant-numeric: tabular-nums` on `.hp-loader-num` (spec decision 3).
- `.hp-clock-time`: `min-width: 8ch` (it is mono) so the first tick, now on idle, doesn't move the header. Expected
  screenshot difference: in `home-*-nojs.png`, the header's "Southampton" and nav shift by the reserved width; nothing
  else.
- Anything else the observer reports, fixed by reserving space, never by hiding content.

Done check: 5 local Lighthouse runs, each CLS ≤ 0.02; diff "all identical" except the stated nojs header; the
loader with motion on (screenshots are under reduced motion and never show it): screenshots at 412 and 1280 wide at
counts about 000, 050 and 100 on `main` and the branch (e.g. by pausing `loaderState` time in DevTools, or
`computer` screenshots at the right moments), the bar and number in the same place and wrapping the same way.

### 7. Long cache for versioned assets

**In short:** returning visitors reuse scripts, styles and fonts for a year without asking the server.

Files: `public/_headers`, `DEPLOY.md`, new `tests/headers.test.js`, `tests/asset-versions.test.js` (the font-name
check, per AC 11), comments at `tools/asset-versions.js:3` and `tests/asset-versions.test.js:30`.

- `_headers`: `/*.js`, `/*.css`, `/fonts/*`, `/portrait-data.json` → `Cache-Control: public, max-age=31536000,
  immutable`. HTML, `/study-runs.json`, images and feeds keep defaults. The existing `/*` security headers stay.
- DEPLOY.md: versioned URLs make this safe; a changed font or image needs a new file name; the zone's Browser Cache
  TTL (4 h) applies only where the origin's max-age is lower; check after deploy with `curl -sI`.

Tests first: parse `_headers`; the four rules set exactly that Cache-Control; no rule that sets Cache-Control matches
`/` or `*.html`; in tests/asset-versions.test.js, every `/fonts/` URL in pages and styles.css has a version in its
file name.

Done check: tests pass; `curl -sI 'http://localhost:8788/effects.js?v=<hash>'` and a font URL show the header,
`curl -sI http://localhost:8788/` does not.

### 8. Headings, skip link, aria-current, address without JS

**In short:** screen readers get real section headings and keyboard users a skip link.

Files: the three HTML pages, `public/styles.css`, `public/effects.js` (stale comment at 37-38),
`tests/home-page.test.js`, `tests/post.test.js`, DEPLOY.md ("Adding a post").

- Headings (AC 12): About: `<h2 class="hp-sr">About</h2>` + the label as `<p class="hp-label hp-approach-label"
  aria-hidden="true">(01) — about</p>`; Contact: the lead becomes `<h2 class="hp-contact-lead" data-io>` (add
  `font-weight: 400`), "(04) — contact" a `<p class="hp-label" data-io>`. h2 test expectation becomes
  `["About", "Selected work", "Writing", "A project, a role, or just a question? Write to me."]`.
- `.hp-sr` becomes a plain `.hp-sr` rule (out of the `.home-page` scope); site.js and its test keep the class.
- Skip link (AC 14) on all three pages, first in `<body>`: `<a class="skip" href="#main">Skip to content</a>`;
  `<main id="main" tabindex="-1">` keeping existing classes. CSS: off screen until `:focus` (no `display:none`,
  no `opacity: 0`; the CSS test at home-page.test.js:337 must stay green), then fixed top-left above the loader
  (z-index > 90), `--bg`/`--ink`, mono 13px, 44px target; `main:focus { outline: none }`.
- aria-current (AC 15): home header "marcinurbanski.dev" `aria-current="page"`; post header "writing"
  `aria-current="true"`.
- Address (AC 16): every literal `hello@marcinurbanski.dev` in a page inside `<!--email_off-->` …
  `<!--/email_off-->`. Test asserts it.
- 404.html: its `<header class="top">` moves out of `<main>` into its own `<div class="wrap">` before it, as the post
  page does, so the skip link skips the nav there too (markup only; the screenshot diff must stay identical).
- Tests over all three pages: the first element in `<body>` is the skip link to `#main`; exactly one
  `<main id="main" tabindex="-1">`; no header nav inside `<main>`; the two `aria-current` values above and no other.

Done check: tests pass; diff "all identical"; keyboard: Tab from the address bar shows the skip link, Enter focuses
main (fresh tab: the Tab closes the loader first, as now); `read_page` / accessibility tree lists the four h2s;
Lighthouse accessibility 100.

### 9. Study grid as a figure with a text summary

**In short:** the runs grid gets a written summary screen readers and no-JS visitors can read.

Files: `public/index.html`, `public/styles.css`, `tools/study-runs.py`, `tests/home-page.test.js`, README.md.

- `.hp-runs` becomes `<figure class="hp-runs" data-runs-host>` (`margin: 0`), `.hp-runs-caption` a `<figcaption>`.
  The visible caption text stays; the legend (`# held · x broke`) and `.hp-count-row` get `aria-hidden="true"`.
- `tools/study-runs.py` also prints the summary; it goes into `<span class="hp-sr">` in the figcaption, exactly:
  "The rule held in N of 1,080 runs. By model: Opus a, Sonnet b, Haiku c of 360. By request: no pressure x, hotfix
  y, narrowed scope z of 360." (numbers formatted as in the page, `1,080`).
- Test: recount from study-runs.json (as the existing test at home-page.test.js:131-138 already counts) and compare
  with the sentence in the HTML. effects.js selectors (`[data-runs-host]`, `[data-runs]`, `[data-count]`) still work.

Done check: tests pass; diff "all identical"; runs animation by eye as on `main`.

### 10. Share cards, touch icon, structured data

**In short:** links to the site and the post show an image card, and Google knows who wrote them.

Files: new `tools/og-images.sh`, new `public/og/home.jpg`, `public/og/skip-the-tests.jpg`,
`public/apple-touch-icon.png`, the three HTML pages, `tests/home-page.test.js` (incl. task 4's script test),
`tests/post.test.js`, DEPLOY.md ("Adding a post": card and JSON-LD).

- `tools/og-images.sh`: headless Chrome `--force-prefers-reduced-motion --hide-scrollbars --window-size=1200,630
  --virtual-time-budget=4000 --screenshot` of `http://localhost:8788/` and each post, `sips -s format jpeg -s
  formatOptions 82` → `public/og/<name>.jpg`; `favicon.svg` rendered 180×180 on `--bg` (opaque) →
  `public/apple-touch-icon.png`, re-encoded without an alpha channel (Chrome screenshots are RGBA; e.g. via a
  24-bit BMP or a JPEG at quality 100 with `sips`, then PNG; check the result's IHDR colour type is 2). Look at each
  image; each under 300 KB.
- Every page: `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`. Home and post (indexable pages, AC 17 as
  amended): `og:image` (absolute), `og:image:width` 1200, `og:image:height` 630, `og:image:alt`, `twitter:card`
  `summary_large_image`.
- JSON-LD `<script type="application/ld+json">` in `<head>`, after the preloader script on the home page: home
  `Person` (`@id` `https://marcinurbanski.dev/#person`, name, url, jobTitle "Senior web developer", image = home card,
  sameAs GitHub and LinkedIn from the page); post `BlogPosting` (headline = h1, description = meta description,
  datePublished `2026-11-04`, author `{ "@type": "Person", "@id": …#person, "name", "url" }`, url and
  mainEntityOfPage = canonical, image = post card).

Tests first: JSON-LD parses and its values match the page's canonical, h1, description and `<time>`; og:image files
are JPEG 1200×630 (SOF marker); apple-touch-icon is a 180×180 PNG with colour type 2 (RGB, no alpha) per IHDR.

Done check: tests pass; diff "all identical"; validator.schema.org shows no errors for both pages (paste the HTML).

## After the tasks (orchestrator)

Lighthouse mobile, 5 runs each on `main` and the branch, both on `wrangler pages dev`, median: Perf, LCP, SI, CLS,
TBT, JS execution per file, forced-reflow insight; Accessibility, Best Practices, SEO at 100. Then the whole-branch
adversarial review and the PR.
