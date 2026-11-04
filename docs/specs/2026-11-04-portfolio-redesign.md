# Spec: marcinurbanski.dev redesign

Date: 2026-11-04. Design: `docs/design/design_handoff_portfolio_redesign/` (Claude Design handoff export; its
`README.md` holds every value, `Marcin Urbanski.dc.html` the reference behaviour). Fidelity: high.

## Story

As a visitor to marcinurbanski.dev, I get a one-page portfolio with large type and ASCII as its visual idea. It
leads me from who Marcin is to his study, projects, writing and contact. Marcin's own 3D ASCII portrait (from
`feature/portrait-3d`) stays the hero object.

## Scope

Everything in the handoff README, sections 0–8 and "Interactions and behaviour", with one exception: the hero
portrait stays the repo's portrait (`public/portrait.js`: bubbles, jitter, pointer scramble, 3D turn and light).
The design's own portrait (screenshot source, build-in glyphs, scan line, glitch, scroll break-up, cursor push)
is not built. From the design's portrait section only the **headline readability** rule is taken.

## Acceptance criteria

Tokens and type
1. Colours, fonts (Geist, Geist Mono, Newsreader italic) and the type scale match the README tables. They are CSS
   custom properties on `:root`, and the canvases read them from there. No border radius except the cursor.
   1px `--line` dividers, film grain at opacity .07.

Sections (README numbering)
2. **0 Loader:** log lines, a 24-cell bar and a 000→100 counter over 1.7s, a 220ms hold, then a 1s wipe up.
   Clicking skips it, a 2.6s fallback covers throttled frames, and it never shows under reduced motion.
3. **1 Header:** fixed, with nav and a live `HH:MM:SS` Europe/London clock.
4. **2 Hero:** bottom-aligned text stack with line reveals and the greeting scramble, a meta row, the background
   field, and the repo portrait placed as the README says (desktop anchored right and bottom, mobile centred
   at the top). Portrait cells under the headline's line boxes (padded 12px x 10px) drop to a dim level.
5. **3 Approach:** the paragraph lights in reading order as it scrolls, with the README's progress formula.
6. **4 Strip:** endless strip that follows the scroll direction and skews with scroll speed.
7. **5 Work:** featured study with the `1,080` count-up, the runs grid (progress only, never pass/fail) and its
   caption; claude-skills and TimeRabbit rows invert on hover. A hover preview panel follows the cursor on
   desktop: claude-skills shows the terminal, TimeRabbit shows a real app screenshot or no panel until there is one.
8. **6 Writing:** rows with the same inverting hover, kept as hand-written HTML as `DEPLOY.md` describes.
9. **7 Contact** and **8 Footer:** scrambling email, `copy address` that confirms `copied to clipboard`,
   alternative links, and a footer with `back to top ↑`.

Behaviour across the page
10. Text scramble on links, H2s and the email; custom cursor (hidden on `hover: none`); reveal on scroll, once.
11. One animation-frame loop for the whole page; each canvas draws only while it is on screen; DPR capped at 2.
12. Reduced motion: no loader, reveals or scrambles, the approach text fully lit, the runs grid full, the
    canvases drawn once, and the portrait flat (as now).
13. Without JavaScript every section's text and every link are visible and usable.
14. 1280px and 375px: no sideways scroll, no console errors, 60fps on desktop while the hero is on screen.
15. `public/writing/skip-the-tests/` and `public/404.html` take the new tokens and fonts; their layout stays.

## Evidence of success

Cloudflare Web Analytics (already on). Two weeks after launch, compared with the two weeks before:
- The study `/writing/skip-the-tests/` gets at least as many page views per home page view as before.
- Core Web Vitals for `/` stay "good": LCP under 2.5s, CLS under 0.1, INP under 200ms.

No new code is needed for either.

## Reuse

- **Extend** `public/portrait.js` (hero object; position and font change, readability dimming added) and
  `public/portrait-3d.js` with its tests.
- **Extend** `public/site.js` (copy button), `public/styles.css` (rewritten around the new tokens),
  `public/index.html` (rewritten markup with the same copy and links).
- **New** browser scripts for the page effects (loader, clock, scramble, cursor, reveal, strip, count-up, runs
  grid, preview panel, lit text) as plain files in `public/`. Pure logic (scramble frames, count-up easing,
  runs-grid frames, lit-text progress) lives in a dual browser/CommonJS file tested with `node --test tests/`,
  like `portrait-3d.js`.
- Nothing from the `.dc.html` runtime (`support.js`, React, DCLogic) ships; behaviour is ported into vanilla JS.

## Approach

- Stack unchanged: static files in `public/`, Cloudflare Pages, no build step, no runtime dependencies.
- Google Fonts link changes from Archivo/Fragment Mono to Geist, Geist Mono and Newsreader.
- The design's config flags become constants: accent `#ecebe6`, loader on, hero object = portrait.

## Security

No user input beyond the pointer, scroll and the clipboard write of a fixed address. No new network calls besides
Google Fonts (already used). No personal data beyond what the site shows today. `_headers` unchanged.

## Deeper (not now unless picked)

- Depth from the original photo instead of the drawn portrait, for a more accurate 3D turn.
- Generate the writing list and RSS from one content file with a tiny build step, so a post is added in one place.

## Out of scope

- The design's portrait effects (see Scope), the torus and "field only" hero options, accent switching.
- New copy, new posts, analytics changes.

## Decisions

Approved by Marcin on 2026-11-04 with these defaults.

1. Add `CODING_STANDARDS.md` with these Core rules (yes):
   - Plain static files, no runtime dependency or build step; network only to Google Fonts and Cloudflare.
   - Design values come from `:root` custom properties; no literal colour in CSS rules or JS.
   - Every animation has a reduced-motion path and runs in the one frame loop, only while on screen.
   - Content is in the HTML; scripts only decorate it, so the page works without JS.
   - Logic that can be tested without a browser lives in a dual browser/CommonJS file with `node --test` tests.
2. The loader shows once per browser session, not on every page load (once per session; the design shows it
   every load). Reason: a 3s wait on every visit to the home page costs returning visitors.
3. The portrait's characters switch from Fragment Mono to Geist Mono, like all ASCII in the design (yes).
4. Copy: the design's headings, labels and structure win over today's site ("Selected / work" with
   "(02) — 3 projects"); every link target and body sentence of today's home page stays. Contact's
   "(04) — contact" label is an `<h2>` styled as the label, so every section has a heading. (Marcin, 2026-11-04.)
5. "Once per browser session" for the loader means once per tab (`sessionStorage`): a new tab opened from a
   bookmark shows it again, and the site stays cookie-free. (Marcin, 2026-11-04.)
6. The post's chart bars keep a white hover through one new token, `--ink-bright: #ffffff`, used only there.
   (Marcin, 2026-11-04.)
7. Additions during the build, beyond the design: the loader also closes on any key (not modifier keys or
   shortcuts), and scroll keys that close it do not scroll the page, because it is `aria-hidden` and keyboard
   users cannot click it; the approach label `(01) — approach` is an `<h2>` styled as the label, like contact's,
   so every section has a heading.
8. When the loader runs, the one-shot effects (count-up, runs grid, scroll reveals) start only after it closes, so
   a visitor arriving at `/#work` or `/#contact` sees them; the design starts them behind the loader.
   (Marcin, 2026-11-04.)
9. When the browser refuses clipboard access, the copy button's label briefly reads "press ⌘C to copy" ("press
   Ctrl+C to copy" off macOS) while the hidden address is selected, then returns to "copy address".
   (Marcin, 2026-11-04.)
10. The design's `footCanvasRef` code (an ASCII "URBANSKI" wordmark) has no canvas in the markup and no README
   section: it is left out.
