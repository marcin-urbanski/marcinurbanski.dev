# Performance, accessibility and sharing pass

Date: 2026-11-05. Status: draft for approval.

## Story

Visitors on phones get the home page faster and with less battery drain, screen reader and keyboard users get real
headings, a skip link and a text version of the study grid, and links shared on LinkedIn or Slack show a proper card.
The visual design does not change.

## Baseline (measured 2026-11-05)

Lighthouse 12 CLI, mobile preset, against production, 3 runs (the PSI API quota was exhausted, so these are local CLI
runs, not PSI; the user's PSI run: Perf 94, LCP 1.6 s, SI 4.7 s, CLS 0.087, TBT 50 ms).

| Run | Perf | FCP | LCP | SI | CLS | TBT |
|---|---|---|---|---|---|---|
| 1 | 70 | 2.5 s | 3.4 s | 2.7 s | 0.396 | 0 ms |
| 2 | 73 | 1.9 s | 3.4 s | 2.3 s | 0.352 | 30 ms |
| 3 | 72 | 1.9 s | 3.4 s | 3.1 s | 0.352 | 20 ms |

Script evaluation per file (run 1): effects-core.js 2,834 ms, portrait.js 243 ms, page 160 ms.

What the numbers mean, from a CPU profile (Chrome, mobile emulation, 4x throttling, 6 s from load):

- **effects-core.js does almost nothing itself.** Lighthouse charges every `requestAnimationFrame` callback to the
  file that called `requestAnimationFrame`, which is the page loop in effects-core.js. The time is spent in
  portrait.js: `computeBase` 1,689 ms self (plus `depthAt` 273, `normalAt` 129, `lightFactor` 64), `drawFace` 796,
  bubbles `step` 200. `computeBase` re-lights every face cell, including the rows below the face that are always
  blank, on every frame of the slow sway, and keeps running behind the intro loader where nothing is visible.
- **CLS comes from the intro loader.** 8–9 shifts of about 0.043 each on `.hp-loader-foot`: as the counter's digits
  change width, the bar and the number wrap and unwrap, and the row moves.
- **LCP is the hero text revealed after the loader.** The loader is opaque for 1.7 s + 0.22 s and the headline lines
  only then slide out of their masks, so LCP cannot drop below about 2 s on a first visit without changing the
  intro's design (see "Not fixable without a design change").
- **Render-blocking:** the Google Fonts stylesheet (~775 ms) and the sync scripts at the end of `<body>`.
- **Transfer:** portrait.js is 53 KB brotli (225 KB raw, almost all base64 data); Newsreader italic is 147 KB.
- **Found on the way:** Cloudflare's Email Address Obfuscation rewrites `hello@marcinurbanski.dev` in the served HTML
  into `[email protected]` plus a parser-blocking decoder script. With JavaScript off, the contact address is
  unreadable.

## Acceptance criteria

### Performance

1. **Portrait cost.** The face and the bubbles are not drawn while the intro loader covers the page; `computeBase`
   only visits the cells the face can reach (its bounding box plus a margin), and runs only when the turn or light
   has moved enough to change a sampled point (quantised turn), not on every frame. In the same CPU profile as the
   baseline, portrait functions (`computeBase`, `drawFace`, `step` and portrait-3d.js) take at most 40 % of their
   baseline time.
2. **Start after first paint.** The portrait's `measure()` and first draw, the clock, cursor, preview panel and hover
   scramble set up from `requestIdleCallback` (with a timeout, `setTimeout` fallback) after the first paint. The
   loader, the `motion`/`intro` start states and the hero reveal keep their current timing. No long task over 50 ms
   from site scripts before first contentful paint.
3. **Pause when not visible.** Every per-frame callback runs only while its element is on screen (already true for
   the face, lit text, strip and runs; the bubbles canvas is fixed and always on screen, so its frames stop only
   while the loader covers it and while the tab is hidden). The header clock stops ticking while the tab is hidden
   and catches up when it returns.
4. **Fewer particles on weak devices.** The steady bubble count is scaled down on screens under 860 px (as now) and
   further when `navigator.hardwareConcurrency` is 4 or less; the formula is a pure tested function.
5. **No forced reflows in the frame.** No frame callback reads layout after another callback in the same frame wrote
   styles: the headline line boxes the face dims under are measured on resize, on font load and while the hero
   reveal transition runs, not on every frame. Lighthouse's forced reflow insight lists nothing from site scripts.
6. **Reduced motion.** Under `prefers-reduced-motion: reduce` no frame loop runs at all and no bubbles exist; the face
   is drawn once, flat, in full (its final state, CODING_STANDARDS rule 3), and not redrawn on scroll.
7. **Scripts.** Every `<script src>` on every page has `defer`, in the current order. The only parser-blocking script
   is the inline preloader check in `<head>`.
8. **Fonts.** Geist, Geist Mono and Newsreader italic are served from `/fonts/` as the Latin-subset variable woff2
   files Google Fonts serves today (same axes and ranges), with `@font-face` in styles.css, `font-display: swap`, and
   the OFL licence next to them. Only Geist is preloaded, on the home page. Each family has a metric-matched fallback
   face (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` over a local system font),
   computed by an offline script in `tools/`. No request to `fonts.googleapis.com` or `fonts.gstatic.com` remains,
   and CODING_STANDARDS rule 1 no longer mentions Google Fonts.
9. **CLS.** Lighthouse mobile CLS is at most 0.02 in each of 5 runs. The loader's foot row no longer reflows as the
   counter changes, and the header clock has its width reserved before its first tick.
10. **Portrait data.** The face's brightness and depth grids move out of portrait.js into a separate versioned asset
   that portrait.js fetches after first paint. portrait.js itself is under 15 KB raw. The face looks the same.
11. **Caching.** `public/_headers` gives `/*.js`, `/*.css`, `/fonts/*` and the portrait data asset
   `Cache-Control: public, max-age=31536000, immutable`; HTML keeps revalidating. Every reference to those files
   carries `?v=<hash>` (fonts: a hash or version in the file name), checked by tests/asset-versions.test.js.

### Semantics and accessibility

12. **Headings.** Each section's `<h2>` is its real title: About (visually hidden; the "(01) — about" label is a
   `<p aria-hidden="true">`), "Selected work", "Writing", and in Contact the question "A project, a role, or just a
   question? Write to me." No "(0X) — …" label is a heading. Pixels unchanged.
13. **Study grid.** The runs block is a `<figure>` with a `<figcaption>` holding a text summary of study-runs.json
   (runs where the rule held, overall and per model, per request), written into the HTML so it reads without
   JavaScript; a test fails when the HTML summary and study-runs.json disagree. The ASCII grids and the animated
   counter stay `aria-hidden`. Pixels unchanged.
14. **Skip link.** Every page starts with a "Skip to content" link to `<main id="main" tabindex="-1">`, off screen
   until focused, then visible at the top left in the site's tokens. The custom cursor and the loader do not cover it
   (on a first visit a keypress closes the loader, as now).
15. **aria-current.** Home page: the header's "marcinurbanski.dev" link carries `aria-current="page"`. Post pages:
   the header's "writing" link carries `aria-current="true"` (the section the page belongs to).
16. **No JavaScript.** With JavaScript disabled, every page shows all copy, links and the contact address, with no
   start state hiding anything. The contact address is excluded from Cloudflare's obfuscation with
   `<!--email_off-->` … `<!--/email_off-->`, so the served HTML holds the real address and the decoder script is no
   longer injected.

### SEO and sharing

17. Every page has `og:image` (1200×630 JPEG, absolute URL, with `og:image:width`, `:height` and `:alt`) and
   `twitter:card` = `summary_large_image`. Home: a render of the hero; each post: a render of its title. Images are
   made by an offline script in `tools/` with headless Chrome under reduced motion, never at request time.
18. `apple-touch-icon` (180×180 PNG, opaque, from favicon.svg) on every page.
19. Home page: JSON-LD `Person` (name, url, jobTitle, image, sameAs GitHub and LinkedIn). Post: JSON-LD `BlogPosting`
   (headline, description, datePublished, author as that Person, url/mainEntityOfPage, image). Both valid in
   Google's Rich Results Test / schema.org validator.

### Whole pass

20. **Visual design unchanged.** Full-page screenshots at 1280×800 and 412×915 under reduced motion, before and after,
   differ only inside the portrait canvas (its fill uses `Math.random`) and the clock. The animated home page is
   checked by eye at both widths: loader, hero reveal, face sway, bubbles, strip, runs, preview panel.
21. **Report.** Lighthouse mobile before/after, median of 5 runs each under the same conditions: Perf, LCP, SI, CLS,
   TBT, JS execution time per file. Accessibility, Best Practices and SEO stay at 100.

## Evidence of success

Cloudflare Web Analytics (already on) reports Core Web Vitals from real visitors. Seven days after deploy: CLS p75
at most 0.1 and LCP p75 at most 2.5 s on mobile. On deploy day: a PSI mobile run on production showing CLS ≤ 0.02 and
no render-blocking requests, and LinkedIn Post Inspector showing the card image for the home page and the post.

## Reuse

- **Reuse:** `EffectsCore.createLoop` and `SiteLoop.whileVisible` for every frame callback (no second loop);
  `Portrait3D` for new pure portrait maths; `tools/asset-versions.js` for `?v=` hashes (extended to `defer` scripts
  and the portrait data URL); `.hp-sr` for visually hidden text (moved out of the `.home-page` scope so posts can
  use it); tests in `tests/home-page.test.js`, `tests/post.test.js`, `tests/asset-versions.test.js`.
- **Extend:** the head preloader script stays the one inline script; `tools/study-runs.py` output is the source for
  the summary.
- **New:** `tools/font-metrics.*` (fallback overrides), `tools/og-images.*` (share images), `public/fonts/`,
  `public/portrait-data.*`, `public/og/`, `public/apple-touch-icon.png`.

## Approach

Plain static files, no build step (rule 1). Pure maths goes to effects-core.js / portrait-3d.js with tests (rule 5).
Every visual change is verified by screenshot comparison before and after.

## Security

No user input or new endpoints. JSON-LD is static, written by hand, no data from requests. New offline tools run
only on Marcin's machine. Fonts are OFL and come from the files Google Fonts serves today.

## Not fixable without a design change (will be in the report)

- **LCP on a first visit** is set by the intro: the loader is opaque for about 2 s and the hero text appears after
  it. Options for later: a shorter loader, or the loader only on the first visit per browser instead of per tab.
- **Speed Index** counts the page as visually incomplete while the loader counts and the face keeps moving.
- **Newsreader italic is 147 KB.** Its optical-size axis is most of it; pinning one size would change how the
  italics look.

## Deeper (not now unless picked)

- Real-device check: a WebPageTest run on a Moto G4 from London, before and after, to confirm the lab numbers.
- A Lighthouse CI budget in the deploy command (fails the deploy if CLS > 0.02 or TBT > 200 ms).

## Out of scope

Any visual or copy change; the intro loader's design; a build step or bundler; changing Cloudflare zone settings.

## Decisions needed

1. **Minifying JS.** CODING_STANDARDS rule 1 says no build step, and minifying needs one (sources would no longer be
   the files served). After the portrait data moves out, all JS is about 50 KB raw, about 15 KB brotli; minifying
   would save roughly 4 KB over the wire. *Default: don't minify, report it as declined.*
2. **Where to measure "after".** Local Lighthouse against `wrangler pages dev`, main vs this branch, 5 runs each.
   A Cloudflare Pages preview deploy (`--branch perf`, an unlisted `*.pages.dev` URL) would give real network and
   real headers. *Default: local only; a preview deploy only if you say yes.*
3. **Loader counter digits.** The simplest fix for the loader's CLS is `font-variant-numeric: tabular-nums` on the
   counter (equal-width digits, as the study's counter already uses); while it counts, the digits look slightly
   different. *Default: reserve the row's width instead, so nothing visible changes; tabular digits only if that
   doesn't hold.*

## Answers from the plan review (2026-11-05, defaults taken)

- **AC 3, bubbles behind the loader:** they are not *drawn* while the loader covers the page, but keep moving, so the
  face is as built as today when the loader lifts (stopping them would change what the reveal shows).
- **AC 6, cursor and preview under reduced motion:** covered; they follow the pointer directly from its events with
  no frame callback.
- **AC 8, fonts:** Geist's latin-ext file is self-hosted too (not preloaded), because the post's "zł" uses it today.
- **AC 13, summary:** overall, per model and per request (3 + 3 numbers), printed by `tools/study-runs.py`.
- **AC 10, script size:** portrait.js holds no data (no base64, no `atob`) and is under 22,000 bytes; the size is a guard against data creeping back, not a target (its code alone was about 15 KB, and the after-paint start adds about 5 KB).
- **AC 17, share cards:** on indexable pages (home and posts); the 404 is `noindex` and gets only the touch icon.
