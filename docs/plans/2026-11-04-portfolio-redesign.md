# Plan: marcinurbanski.dev redesign

- **Goal:** rebuild the home page to the Claude Design handoff, keeping Marcin's 3D ASCII portrait as the hero object.
- **Spec:** `docs/specs/2026-11-04-portfolio-redesign.md` (acceptance criteria AC1–AC15 are numbered there).
- **Design:** `docs/design/design_handoff_portfolio_redesign/README.md` (values) and `Marcin Urbanski.dc.html`
  (reference markup with inline styles, and the `class Component` script with every behaviour). The `.dc.html` is a
  reference, not code to copy: its React/DCLogic runtime and `support.js` never ship.
- **Branch:** `feature/portfolio-redesign`, one PR.

## Global constraints

- Follow `CODING_STANDARDS.md` (static files only, tokens from `:root`, reduced motion and visibility, content in
  HTML, pure logic tested). Breaking a rule there is an Important finding.
- Values (colours, sizes, timings, easing) are exactly the README's; where the README is silent, take them from the
  `.dc.html` inline styles and script. Where the design hard-codes a colour, use the token with that value.
- **Tokens with two values in the README** collapse to one: `--ascii-mid: #6b6a64`, `--ascii-dim: #3a3a35`
  (the `#62615b` and `#3d3d38` variants are within a few units and use these tokens).
- **Copy:** the design's copy and structure win (for example "Selected / work" with "(02) — 3 projects"); every
  link target and every body sentence of today's `public/index.html` (on `main`) must still be on the page.
  Internal links stay relative (`/writing/skip-the-tests/`, `/rss.xml`), not the design's absolute URLs. Contact's
  `(04) — contact` label is an `<h2>` styled as the mono label, so every section keeps a heading.
- **Shared stylesheet:** `public/404.html` and `public/writing/skip-the-tests/index.html` use, from
  `public/styles.css`: the element rules for `a`, `footer`, `footer nav` and `footer nav a`, and `header.top`,
  `.home`, `.wrap`, `.name`, `.bio`, `.lost`, `.post*` and `.chart*`. Those rules change only through tokens, and
  the post and 404 keep their current gutter. Home-page styles use new class names scoped under `body.home-page`
  (a class on the home `<body>`), including the new home `<footer>` and gutter.
- **Hooks the scripts use:** the hero section keeps `class="hero"` (with `id="top"`) and `#face`/`#bubbles` keep
  their canvases (`public/portrait.js` looks these up); `#face` is absolute, inset 0 inside the hero at every width.
  Contact keeps `id="mail"` and `id="copy"` (`public/site.js` looks these up). Each hero headline line has
  `data-line` (Task 9 reads their rects).
- **Head script and start states:** a small inline script in `<head>`, when reduced motion is off, adds `motion` to
  `<html>`, and also `intro` when the loader will run (no loader flag in `sessionStorage`; a storage exception means
  "run it"). It also sets a failsafe: after 4s it removes `intro` and `motion` unless `effects.js` has taken over.
  `effects.js` first checks that `window.EffectsCore` exists (if not, it removes `intro` and `motion` and stops),
  runs its setup inside try/catch (on an exception it removes `intro` and `motion`), and sets
  `document.documentElement.dataset.fx = "on"` only after setup has finished. CSS hides or offsets
  things only under `html.motion` / `html.intro`. `effects.js` runs the loader exactly when `html.intro` is present,
  writes the session flag when the loader starts, and removes `intro` when it closes. On every load with motion
  (loader or not) the hero lines slide in and the greeting scrambles, as the design's `intro()` does.
- **One frame loop:** `effects.js` owns the page's only `requestAnimationFrame` loop, exposed as
  `window.SiteLoop.add(fn)` / `remove(fn)`. Every per-frame effect registers with it: loader, scramble, count-up,
  runs grid, strip, cursor, preview panel, copy label and (Task 8) the portrait. An exception in one callback is
  caught, logged once and that callback removed; the loop keeps running. Callbacks get `dt` = elapsed time /
  16.67ms, capped at 3 (the design's frame unit), and every function that takes `dt` uses that unit. In Tasks 4–7,
  `rg -n requestAnimationFrame public/*.js` shows calls only in `effects.js` (the loop's own) and in
  `public/portrait.js` (its own loop, moved in Task 8); from Task 8 on, only in `effects.js`.
- **Reduced motion:** every effect shows its final state with no motion. In particular the cursor and the preview
  panel follow the pointer without lerp, growth animation or rotation, and a `@media (prefers-reduced-motion:
  reduce)` block removes CSS transitions (row invert, buttons).
- **No literal colours:** from Task 2 on, every done check includes
  `grep -nE ':\s*[^;]*(#[0-9a-fA-F]{3,8}\b|rgba?\()' public/styles.css` (only token definitions) and
  `grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' public/*.js` (no hits; canvases read tokens with `getComputedStyle`)
  and the same grep on `public/index.html` (only `theme-color`).
- Tests: `node --test tests/` with `node:test` and `node:assert/strict`. Model the style on
  `git show feature/portrait-3d:tests/portrait-3d.test.js` (on `main` once PR #2 merges). Browser modules with pure
  logic use the dual pattern of `git show feature/portrait-3d:public/portrait-3d.js` (`(function (root) {…})(this)`
  that sets `window.<Name>` or `module.exports`).
- No new dependency of any kind. Only Google Fonts (Geist 300–700, Geist Mono 300–500, Newsreader italic 300–500,
  opsz 6–72) may be added to the existing fonts link.
- The design's config props become constants: accent `#ecebe6`, loader on, hero object = portrait.
- Small calls the design leaves open: the contact `<h2>` label does not scramble (it is a plain label in the
  design); the film grain is on every page; links keep today's behaviour (no `target="_blank"`); loader log lines are
  the README's (`> reproduce  ok`, two spaces); the writing row keeps `<time datetime="…">`.
- The home gutter is `max(clamp(20px, 3vw, 40px), env(safe-area-inset-left))` (and `-right`), because the page
  uses `viewport-fit=cover`.
- Elements that exist only for effects are created by the script, never hidden by default CSS: the cursor, the
  loader, and the preview panel (its claude-skills content sits in an inert `<template id="preview-skills">` in
  `index.html` that `effects.js` clones into a panel it creates, `aria-hidden="true"`).
- **Script order** at the end of the home `<body>`: `effects-core.js`, `effects.js`, `site.js`, `portrait-3d.js`
  (from PR #2), `portrait.js`.
- `public/portrait.js` and `public/portrait-3d.js` come from PR #2 (`feature/portrait-3d`). Task 8 starts only after
  that PR is merged into `main` and `main` is merged into this branch; Tasks 1–7 do not touch either file.
- Not built: the design's footer wordmark code (`footCanvasRef`, `drawFoot`) and its portrait effects (build-in
  glyphs, scan line, glitch, scroll break-up, cursor push, screenshot source).
- Accessibility: runs-grid `<pre>`s are `aria-hidden="true"` (the caption carries the meaning); a scrambling label
  is never in a live region: only final text is announced, from a visually hidden live region.
- Browser checks are done by the orchestrating session with `wrangler pages dev --port 8788` at 1280x800 and
  375x812, with the console open and once with reduced motion; each task lists its own. Implementers run
  `node --test tests/`, `node --check` on changed JS and the greps above.

## Tasks

### Task 1: tested effect logic

**In short:** the maths behind every page effect, in one tested file, before any of it is wired up.

- Files: new `public/effects-core.js` (dual module, `window.EffectsCore`), new `tests/effects-core.test.js`.
- Functions (names may differ, behaviour may not):
  - `scrambleText(from, to, progress, rand)`: the design's `scramble()` schedule (`.dc.html:245–261`): over
    `max(from.length, to.length)` characters, character i shows `from[i]` until its turn, then glyphs from
    `!<>-_\/[]{}=+*^?#01`, then `to[i]`; spaces kept; progress clamped to [0, 1]; at 1 the result is exactly `to`.
  - `easeOutCubic`, `easeOutQuart`, `easeInOutQuad`.
  - `loaderState(elapsedMs)`: as `.dc.html:372–380`: counter `000`–`100` (3 digits) and the bar `[` + 24 cells +
    `]` filled with `#` follow ease-out-cubic over 1.7s; the printed log lines follow linear progress,
    `min(3, floor(p * 3.6))`.
  - `formatCount(n)`: `en-GB` grouping (`1,080`).
  - `runsFrame(progress, modelIndex)`: the design's `renderRuns` (`.dc.html:309–323`): `q = clamp(p * 1.2 -
    modelIndex * .1, 0, 1)`, eased with ease-in-out-quad, `round(e * 360)` done runs; 12 rows x 30 columns (4 setups
    x 3 requests, a blank line between setups). Returns segments `{ state: "done" | "current" | "pending", text }`
    per line, so the DOM code wraps them in classes and CSS colours them (done `--ink`, current `--acc`, pending
    `--ascii-dim`). At progress 1 every model is fully done.
  - `litPercent(rectTop, rectHeight, vh)`: `clamp((vh * .88 - top) / (height + vh * .3), 0, 1) * 108 - 4`.
  - `londonTime(date)`: `HH:MM:SS`, 24h, Europe/London (via `Intl.DateTimeFormat`).
  - `stripStep(x, half, velocity, direction, dt)` and `stripSkew(velocity)`: the design's strip step and
    `clamp(-vel * .18, -10, 10)` (`.dc.html` `frame()`), the offset wrapped into (-half, 0].
  - `previewPos(pointer, current, viewport, dt)`: the panel's target (+28px, clamped to the viewport as in
    `.dc.html:452–459`), its lerped position (.14) and rotation `clamp(dx * .04, -8, 8)`.
  - `lerp(a, b, k, dt)`: `a + (b - a) * (1 - (1 - k) ** dt)` (`.dc.html:437`), used by the cursor (.25 position,
    .2 size), the panel and anything else that follows the pointer.
  - `decayVelocity(v, dt)`: `v * .9 ** dt` (`.dc.html:436`); the strip caps `|v|` at 80 (`.dc.html:462`).
- Covers: the logic behind AC2, AC3, AC5–AC7, AC9, AC10.
- Tests first: one behaviour per test, each failing on its assertion before the code exists (stub first). Include
  the edges: progress below 0 and above 1; the last frame of each animation equals the final state; `scrambleText`
  from a shorter to a longer string and from empty; `loaderState` log lines at 0.2, 0.5 and 1; `runsFrame` at 0,
  0.5 (later models behind earlier ones) and 1; `londonTime` on a July and a January date; `previewPos` clamped at
  the right and bottom edges; `lerp`, `decayVelocity` and `stripStep` with `dt = 1` and `dt = 2`.
- Done check: `node --test tests/` passes with every new test.

### Task 2: tokens, fonts and grain

**In short:** the whole site switches to the new colours, Geist fonts and film grain; layouts stay as they are.

- Files: `public/styles.css`, the fonts `<link>` in `public/index.html`, `public/404.html` and
  `public/writing/skip-the-tests/index.html`; `theme-color` stays `#0a0a09`.
- `:root` tokens per the README colour table (bg, surface, ink, muted-1, muted-2, ascii-mid, ascii-dim, line,
  line-2, acc), font stacks for Geist, Geist Mono and Newsreader, the main and wipe easings, the home gutter.
- Mapping of the old tokens: `--fg` → `--ink` (keep `--fg` as an alias until Task 8, because `public/portrait.js`
  reads it); `--muted` → `--muted-1` for body text (`.bio`, `.dek`) and `--muted-2` for mono labels and metadata;
  `--dim` → `--ascii-dim`; `--line` → `--line`; `--display` → Geist; `--mono` → Geist Mono. `--block` and
  `--on-block` are removed if `rg` finds no use.
- The post's literal colours: `.post code` background `#171613` → `--surface`; the chart bar hover `#ffffff` →
  `--ink-bright` (a new token, `#ffffff`, used only there).
- Film grain: the `.dc.html` line 23 `body::after` rule.
- Remove every `border-radius`: the copy button (4px), the focus outline (2px) and the post's `code` (4px).
- Covers: AC1, AC15.
- Done check: `node --test tests/` passes; the colour greps. Browser: home, post and 404 render in the new fonts
  and colours with no sideways scroll at 375px, the same gutter and layout as before, and chart bars still brighten
  on hover; the portrait still draws.

### Task 3: home page markup and static styles

**In short:** the home page gets the new sections, type and layout, complete and readable without JavaScript.

- Files: `public/index.html` (rewritten: `<body class="home-page">`; header 1, hero 2, approach 3, strip 4, work 5,
  writing 6, contact 7, footer 8, with ids and anchors as in the design plus the hooks in the global constraints),
  `public/styles.css`.
- Styles: home-only rules under `body.home-page`, from the README and `.dc.html` inline styles, as classes; the
  inverting row hover and the button hovers in CSS under `@media (hover: hover)`; the reduced-motion block that
  removes transitions.
- Delete the old home-only rules: `.hero` layout (keep the class as a hook), `.col`, `.statement`, `.facts`, `.sec`,
  `.num`, `.item`, `.lead`, `.meta`, `.work-grid`, `.writing`, `.rt`, `.mail`, `.contact-*`, and the home parts of
  the 860px media block (`.hero { min-height: 0 }`, `#face { height: 64vh … }`, the mobile `header.top` background
  if only home used it), `.sec-title`, `.sec-title a`, `.statement em` and the 860px `.name` override. Check each
  with `rg` against the post and 404 first.
- Approach paragraph: its CSS default is fully lit (`--ink`); Task 6 adds the dim start from the script.
- Runs grid: the three `<pre>`s hold their final state (all done) in `--ink`, `aria-hidden="true"`.
- The hero text sits over the portrait as in the design; the portrait's placement changes in Task 8.
- The header clock without JS shows `Southampton` only; Task 5 adds the time.
- Preview: `<template id="preview-skills">` with the claude-skills terminal; the TimeRabbit row has none. `#copy`
  loses `aria-live` (Task 7 adds the hidden live region).
- Script tags: keep `site.js` and `portrait.js`; later tasks add theirs in the global order.
- Reuse: today's links, `mailto`, `#mail`, `#copy` and `public/site.js` unchanged.
- Covers: AC2–AC9 (static parts), AC13.
- Done check: `node --test tests/` passes; the colour greps. Browser, JS on: the portrait draws, the console is
  clean, no sideways scroll at 375px. JS off: every section, heading, body sentence and link target from the copy
  rule is present and readable (no transparent or hidden text). Post and 404 unchanged apart from Task 2.

### Task 4: page runtime, loader and reveals

**In short:** one animation loop for the page, with the intro loader, the hero line reveal and reveal on scroll.

- Files: new `public/effects.js`, `public/index.html` (the `<head>` inline script; script tags),
  `public/styles.css` (loader, `html.motion` and `html.intro` start states, reveal start states).
- `SiteLoop` and per-element `IntersectionObserver` visibility, per the global constraints.
- Loader per README section 0, built by the script, per the head-script rules; click skips; 2.6s fallback. Hero
  lines slide up per README section 2 on every load with motion; reveal per "Scroll reveal", once per element.
- Reuse: `EffectsCore` for every calculation.
- Covers: AC2, AC4 (reveals), AC10 (reveal), AC11, AC12 (these parts).
- Done check: `node --test tests/`, `node --check public/effects.js`, the colour greps and the
  `requestAnimationFrame` check. Browser: the loader shows on the first load and not after a reload in the same
  tab; a click skips it; no page flash before it; hero lines slide in after it and also on a reload without it;
  sections reveal once on scroll; with `effects.js` blocked, and separately with `effects-core.js` blocked, the
  whole page is visible within 4s; reduced motion shows
  everything at once with no loader; console clean.

### Task 5: clock, text scramble and cursor

**In short:** the header clock ticks, links, headings and the email scramble on hover, and a custom cursor follows
the pointer.

- Files: `public/effects.js`, `public/styles.css`.
- Clock with `londonTime`, every second. Scramble with `scrambleText` on links with a data attribute, H2 lines
  (700ms, 90ms stagger) and the email, and the hero greeting after the intro. The scramble runner is exposed as
  `window.SiteEffects.scramble(el, to, ms)` for Task 7. Cursor per README "Custom cursor", hidden on
  `(hover: none)`, created by the script, moved with `lerp`; snaps with no lerp or growth animation under reduced
  motion. No scramble under reduced motion.
- Covers: AC3, AC10, AC12 (these parts).
- Done check: the Task 4 commands. Browser: the clock shows London time and ticks; hovering nav, H2s and the email
  scrambles and settles on the right text; the cursor grows over links; no cursor element with touch emulation at
  375px; console clean.

### Task 6: approach lit text and the strip

**In short:** the approach paragraph lights up as you scroll, and the "Reproduce / measure / fix the cause" strip
runs with the scroll.

- Files: `public/effects.js`, `public/styles.css`.
- Lit text: the script adds the dim start, then drives the gradient with `litPercent` from `SiteLoop` while the
  paragraph is on screen (`IntersectionObserver`), colours from tokens; nothing changes under reduced motion (stays fully lit). Strip with `stripStep`, `stripSkew` and `decayVelocity`, only
  while visible; still under reduced motion.
- Covers: AC5, AC6, AC12 (these parts).
- Done check: the Task 4 commands. Browser: the paragraph lights in reading order while scrolling; the strip moves,
  reverses with the scroll direction and skews; both static with reduced motion; console clean.

### Task 7: work section and the copy button

**In short:** the study's 1,080 counter and runs grid animate into view, the claude-skills row gets its hover
preview, and the copy button confirms with a scramble.

- Files: `public/effects.js`, `public/styles.css`, `public/site.js`.
- Count-up at 40% in view over 2.4s with `easeOutQuart` and `formatCount`; runs grid at 35% in view over 3s with
  `runsFrame`, rendered as class-tagged spans. Both start from 0 only when JS runs and show the final state under
  reduced motion.
- Preview panel per README (desktop only, `hover: hover`) with `previewPos`: claude-skills terminal; the TimeRabbit
  row has none; snaps without rotation under reduced motion.
- Copy button (`site.js`): writes the constant `hello@marcinurbanski.dev` (never the email element's text, which may
  be mid-scramble); the selection fallback selects a visually hidden element holding the constant address, not
  `#mail`; its label scrambles to `copied to clipboard` and back after 2s
  through `window.SiteEffects.scramble`, or swaps the text without scrambling when that is missing or under reduced
  motion; the final text is announced from a visually hidden live region.
- Covers: AC7, AC9, AC12 (these parts).
- Done check: the Task 4 commands plus `node --check public/site.js`. Browser: the counter and grid run once when
  scrolled into view and end at 1,080 and full grids; the preview follows the pointer over claude-skills only;
  clicking copy right after hovering the email puts exactly `hello@marcinurbanski.dev` on the clipboard; with
  `effects.js` blocked the copy button still copies; console clean.

### Task 8: portrait placement, font and loop

**In short:** your 3D portrait sits where the design puts it, in Geist Mono, and runs in the page's one loop.

- Precondition: PR #2 merged; `git merge main` into this branch. It conflicts in `public/index.html` (PR #2 adds
  `<script src="/portrait-3d.js">`): keep both sides, in the global script order.
- Files: `public/portrait.js`, `public/portrait-3d.js`, `tests/portrait-3d.test.js`, `public/styles.css` (drop the
  `--fg` alias).
- Placement: new pure `portraitLayout(w, h, asp)` in `portrait-3d.js` returning `{ x, y, pw, ph, fontPx }` with the
  README's formulas and `asp = GW / GH`: desktop `ph = min(h - 120, w * .42 / asp)`, `x = w - pw - max(16, .04 w)`,
  `y = h - ph - 48`; under 760px centred with `y = 64` and `ph = min(h * .6, w * .9 / asp)`; font 7px, 6px under
  1100px, 5.5px under 760px. Cell `0.6em x 1.2em`.
- Font: every `Fragment Mono` in `portrait.js` (face font, bubbles font, the `document.fonts.load` call) becomes
  Geist Mono, and the re-measure runs on `document.fonts.ready`.
- Colour: characters in `--ink` read from `:root`.
- Loop: the portrait's frame work registers with `SiteLoop`; the face draws only while the hero is visible; the
  bubbles canvas keeps running across the page as today. If `window.SiteLoop` is missing (`effects.js` blocked or
  failed), the face is drawn once, as under reduced motion, without bubbles, and nothing throws.
- Bottom fade: the fade and the random target pick are measured from the face's bottom (`y + ph`), not the canvas
  bottom (`FH`), so the face still dissolves into the bubbles at its new size and place.
- Keep: bubbles, jitter, pointer scramble, 3D turn and light, the reduced-motion flat portrait.
- Covers: AC4, AC11, AC12.
- Tests first: `portraitLayout` at 1280x800, 1100x800 (7px), 1099x800 (6px), 760x800 (desktop), 759x800
  (mobile) and 375x812 (position, size, font).
- Done check: `node --test tests/`, `node --check public/portrait.js`, the colour greps and the
  `requestAnimationFrame` check. Browser at 1280 and 375: the portrait sits as specified in Geist Mono, turns in 3D,
  bubbles still rise, the bottom of the face dissolves; with `effects.js` blocked the portrait still draws and the
  console is clean; reduced motion draws it once; `rg -n requestAnimationFrame public/*.js` finds `effects.js` only.

### Task 9: field and headline readability

**In short:** a faint ASCII field fills the hero around your portrait, and the portrait dims where it runs under
the headline.

- Files: `public/portrait.js`, `public/portrait-3d.js`, `tests/portrait-3d.test.js`.
- Field: README section 2 (13px, 10px under 700px; cell `0.6em x 1.22em`; `·` above 1.52, `+` above 1.78) in
  `--ascii-dim`, drawn where the field cell's top-left is not inside a face cell: a cell whose maximum brightness
  over all turns (`reach`, before the random fade pick) is above the draw threshold, so the mask neither flickers
  nor has holes. New pure `fieldChar(col, row, t)` in `portrait-3d.js`.
- Readability: each frame, for each `[data-line]` element make a Range (`document.createRange()`,
  `selectNodeContents(el)`) and read `range.getClientRects()` (one box per rendered text line, as `.dc.html:522`;
  the element's own rects would be full-width blocks), relative to `face.getBoundingClientRect()`, pad 12px x 10px, and draw portrait cells inside them in `--ascii-mid`. New pure
  `inRects(x, y, rects, padX, padY)`. Lines are drawn as runs of one colour (split where the colour changes).
- Covers: AC4, AC11, AC14.
- Tests first: `fieldChar` returns `·`, `+` and nothing at chosen cells and times; `inRects` inside, on the padding
  edge and outside.
- Done check: the Task 8 commands. Browser at 1280 and 375: the field shows around the face and not inside it,
  portrait cells under the headline are dimmer and cells right of "developer." keep full brightness, the headline
  stays readable while it slides in; reduced motion draws the field once and it stays still; a performance trace
  at 1280x800 while the face sways shows no frame over 16.7ms; no sideways scroll at 375px; console clean.

### Task 10: docs

**In short:** README and DEPLOY describe the new files, the tests, the loader behaviour and how to add a post.

- Files: `README.md`, `DEPLOY.md` ("Adding a post", step 2: the new writing-row markup on the home page; run
  `node --test tests/` before deploying; check at 1280 and 375 px).
- Done check: every JS file in `public/` is named in README; DEPLOY's post steps match the new home markup.
