# Handoff: marcinurbanski.dev redesign

## Overview
A one-page portfolio for marcinurbanski.dev. It's dark, built on large type, and uses ASCII as its main visual idea. Sections: intro loader → hero (an ASCII portrait that reacts to the cursor) → approach → scrolling strip → selected work → writing → contact → footer. All copy is from the current live site.

## About the design files
`Marcin Urbanski.dc.html` is a **design reference built in HTML**. It's a working prototype of the intended look and behaviour, not production code. Rebuild it in the site's real stack, or pick a suitable one if there isn't one (e.g. Astro or plain static HTML, CSS and vanilla JS; the page needs no framework).

To view it, open the file in a browser with `support.js` next to it. The markup is a template with inline styles. All the behaviour is in the `class Component` script at the bottom of the file, and that's the source to port the animation code from.

## Fidelity
**High fidelity.** Colours, type, spacing, motion timings and copy are final. Match them exactly.

## Design tokens

### Colours
| Token | Hex | Use |
|---|---|---|
| bg | `#0a0a09` | page, loader, theme-color |
| surface | `#121210` | hover preview panel |
| ink | `#ecebe6` | primary text, bright ASCII |
| muted-1 | `#a3a29c` | body copy, ASCII level 2 |
| muted-2 | `#8a8983` | mono labels and metadata |
| ascii-mid | `#62615b` / `#6b6a64` | ASCII level 1 |
| ascii-dim | `#3a3a35` / `#3d3d38` | ASCII level 0, pending run cells, button borders |
| line | `#262622` | all 1px dividers |
| line-2 | `#2c2c28` | preview panel border |
| accent `--acc` | `#ecebe6` (current default) | italic emphasis, cursor, selection, counters. Other options: `#ff6b2c`, `#c6f432`, `#8fb3ff` |

The accent is one CSS variable (`--acc`) set on the root. The canvases read the same value from JS.

### Typography (Google Fonts)
- **Geist** 300–700: display and body.
- **Geist Mono** 300–500: labels, nav, metadata and all ASCII.
- **Newsreader** italic 300–500 (opsz 6–72): emphasis only (`<em>`).

| Role | Font | Size | Line height | Letter spacing | Weight |
|---|---|---|---|---|---|
| Hero H1 lines | Geist | clamp(52px, 9.6vw, 176px) | .9 | -.05em | 400 |
| Hero sub-line | Geist + Newsreader em | clamp(22px, 2.5vw, 40px) | 1.18 | -.02em | 400 |
| Section H2 | Geist | clamp(60px, 11vw, 200px) | .84 | -.055em | 400 |
| Approach paragraph | Geist | clamp(28px, 3.6vw, 60px) | 1.1 | -.03em | 400 |
| Strip | Geist / Newsreader | clamp(64px, 11vw, 200px) | 1 | -.045em | 400/300 |
| Study title H3 | Geist | clamp(34px, 4.2vw, 68px) | 1 | -.035em | 400 |
| 1,080 counter | Geist | clamp(80px, 10.5vw, 184px) | .82 | -.06em | 300, tabular-nums |
| Work row title | Geist | clamp(38px, 5.2vw, 88px) | .95 | -.045em | 400 |
| Writing row title | Geist | clamp(24px, 2.6vw, 40px) | 1.12 | -.025em | 400 |
| Contact email | Geist | clamp(30px, 6.6vw, 128px) | 1 | -.05em | 400 |
| Contact lead | Geist | clamp(28px, 3.6vw, 60px) | 1.08 | -.03em | 400 |
| Body | Geist | 17–18px | 1.5–1.55 | 0 | 400 |
| Mono labels | Geist Mono | 13px (12px small, 14px hero greeting) | normal | 0 | 400 |
| Loader counter | Geist | clamp(96px, 18vw, 280px) | .78 | -.05em | 300 |

### Spacing and shape
- Page gutter: `clamp(20px, 3vw, 40px)` left and right on every section.
- Section vertical padding: roughly `clamp(80–120px, 12–18vh, 160–220px)`; see each section below.
- No border radius anywhere, except the cursor, which becomes a circle on hover. No shadows.
- Dividers: always `1px solid #262622`.
- Film grain: a fixed full-screen SVG `feTurbulence` noise at opacity .07, z-index 70, pointer-events none.
- Main easing: `cubic-bezier(.16,1,.3,1)`. Loader wipe: `cubic-bezier(.76,0,.24,1)`.

## Screens and sections (top to bottom)

### 0. Intro loader (fixed, z 90)
- Full-screen `#0a0a09`. Top row in mono 13px: `marcinurbanski.dev` on the left, `running checks` on the right.
- Bottom left: a log that prints `> reproduce  ok`, `> measure  ok`, `> fix the cause  ok` one line at a time, with a bar under it: `[########................]` (24 cells).
- Bottom right: a large counter `000`→`100`.
- Timing: 1.7s with ease-out-cubic, then a 220ms hold, then the overlay slides `translateY(-100%)` over 1s. Clicking skips it. There's a fallback timeout at 2.6s in case animation frames are throttled.
- Skip it entirely under `prefers-reduced-motion`. Make it optional with a config flag.

### 1. Header (fixed, z 50)
- Flex with space-between and wrap; padding `18px gutter 28px`. Background `linear-gradient(#0a0a09 20%, transparent)`.
- Left: `marcinurbanski.dev` (links to #top). Middle nav: `work`, `writing`, `contact`, 24px gap. Right: `Southampton` (muted) plus a live clock `HH:MM:SS` (Europe/London, 24h, tabular-nums, updates every second).
- All links use the text scramble on hover (see Interactions).

### 2. Hero (`#top`, min-height 100svh)
- Content is bottom-aligned (flex column, justify-content flex-end); padding `120px gutter 24px`.
- A full-bleed `<canvas>` sits behind it (aria-hidden), drawing:
  - **Background field:** a sparse Geist Mono grid (13px font, 10px under 700px width; cell = 0.6em × 1.22em). A character is drawn where `sin(col*.09+t*.35)*cos(row*.16-t*.25)+sin((col-row)*.045+t*.18) > 1.52`: `·`, or `+` above 1.78, in `#3a3a35`.
  - **ASCII portrait** (default). See "ASCII portrait" below.
- Text stack:
  1. `Hi, I'm Marcin Urbanski.` in mono 14px, accent colour; it scrambles in about 350ms after the loader closes.
  2. H1: two lines, `Designer turned` / `developer.`
  3. A sub-line inside the H1: `I build my own apps with AI agents and` followed by the em in Newsreader italic, accent colour: `test what actually makes them reliable.`
  - Each line sits in an `overflow:hidden` wrapper and slides up from `translateY(110%)` → 0 over 1.4s, staggered `0.12s + i*0.09s`.
- Bottom meta row: `web, since 2008` · `Southampton, UK` · `scroll ↓`, mono 13px muted, with a top border.

### 3. Approach
- Flex-wrap. Label `(01) — approach` (flex 1 1 200px, mono muted). Paragraph flex 4 1 560px.
- Copy: "Ten years of graphic and web design, then development: WordPress, WooCommerce and Laravel for UK clients, checkout flows and performance work. Now I apply the same habit to agents. *Reproduce, measure, fix the cause.*" The last sentence is in Newsreader italic.
- **Scroll-lit text:** the inline span uses `color:transparent; background-clip:text`, with a `linear-gradient(90deg, #ecebe6 (p-3)%, #3d3d38 (p+3)%)`. Because an inline element's background runs across all its line fragments as one strip, this lights the text in reading order across lines. The progress is `p = clamp((vh*.88 - rect.top)/(rect.height + vh*.3), 0, 1) * 108 - 4`, updated on scroll.

### 4. Scrolling strip
- Full-width, with top and bottom borders, padding `clamp(18px,2.6vw,36px) 0`, aria-hidden.
- Content repeated twice in a row: `Reproduce` / *`measure`* / `fix the cause` /. The `/` is Geist Mono 300 in the accent colour.
- It moves left at about 1.1px/frame plus up to 0.28×|scroll velocity|. The direction follows the last scroll direction. It skews `skewX(clamp(-vel*0.18, ±10deg))`. It wraps at half its scrollWidth.

### 5. Selected work (`#work`)
- Header: H2 with two block lines, `Selected` / `work`. On the right: `(02) — 3 projects`. Bottom border, 28px padding.
- **Featured study (article):** a grid `repeat(auto-fit, minmax(min(100%,440px),1fr))`, gap `clamp(40px,5vw,88px)`, bottom border.
  - Left column: `01` (accent) and `study · 2026-11-03`; the H3 link "What happens when you tell a coding agent to *skip the tests?*"; the description (18px, #a3a29c, max 32em); the button `read the study →` (min-height 52px, padding 0 22px, 1px ink border, mono 13px; on hover: accent background and border, bg-coloured text).
  - Right column: the counter `1,080` + `runs` (accent mono). It counts up from 0 over 2.4s with ease-out-quart once 40% is in view, formatted `en-GB`.
  - **Runs grid:** three `<pre>`s labelled opus / sonnet / haiku. Each is 12 rows × 30 columns (4 setups × 3 requests, with a blank line between setups), in Geist Mono 10px / 1.3. Pending cells are `.` (#3d3d38), done cells `#` (#ecebe6), and the current run is `>` (accent). It fills over 3s once 35% is in view; each model starts 10% later than the previous one. **It only shows progress, not pass/fail results.**
  - Caption: `3 models × 4 setups × 3 requests × 30 runs`.
- **Project rows** (02 claude-skills, 03 TimeRabbit): the whole row is a link; flex-wrap, baseline-aligned, gap 14px 32px; vertical padding `clamp(30px,3.6vw,52px)`; bottom border.
  - Contents: the index (mono, opacity .62), the title, the description (17px, opacity .74, max 30em), and the meta (`open source ↗` / `app · macOS ↗`).
  - On hover the row **inverts**: background `#ecebe6`, text `#0a0a09`, and horizontal padding goes 0 → 24px. Transition: background and colour .5s, padding .6s, all on the main easing. Child colours use `currentColor` plus opacity so they still read when inverted.
  - **Hover preview panel:** fixed, 320px wide, #121210, 1px #2c2c28 border, padding 14px. It follows the cursor at a +28px offset (lerp .14, clamped to the viewport) and rotates by `clamp(dx*0.04, ±8deg)`. Fades in and out over .35s. Desktop only.
    - claude-skills: a terminal reading `~/claude-skills`, then `$ ls`, then `test-first/  verification/  specs/  review/`.
    - TimeRabbit: **placeholder**; replace with a real app screenshot (190px tall), with a caption row `gettimerabbit.com` / `macOS`.

### 6. Writing (`#writing`)
- H2 `Writing`. On the right: `(03) — notes & studies` and an `rss` link.
- Row link (the same inverting hover): `4 Nov 2026` (flex 0 0 120px), the title, `8 min →`.
- Should render from the real posts / RSS data.

### 7. Contact (`#contact`, min-height 90svh, vertically centred)
- `(04) — contact`, then the lead "Questions about agents, evals or a project? *Write to me.*" (the em is accent italic).
- The large `mailto:hello@marcinurbanski.dev` link scrambles on hover; `overflow-wrap:anywhere`; bottom border.
- The `copy address` button (min-height 48px, 1px #3d3d38 border; on hover: accent border and text) copies to the clipboard. Its label scrambles to `copied to clipboard`, then back after 2s.
- "or find me on LinkedIn and GitHub" (links underlined with a 1px #3d3d38 bottom border).

### 8. Footer
- Padding `24px gutter`, top border. One mono row: `© 2026 Marcin Urbanski` · GitHub / LinkedIn / RSS · `back to top ↑`.

## ASCII portrait (hero)
- Source: `assets/portrait-ascii.png` (1458×1970), a screenshot of the portrait on the current site. **Better:** render it from the original photo and drop the screenshot step.
- Crop `sx=120, sy=60, w=1250, h=1880` (aspect ≈ .665). Mask the screenshot's nav (source x>1120, y<120) and the bottom strip (y>1935) to black.
- Size and position:
  - Desktop: `ph = min(h-120, w*.42/asp)`, anchored right (`x = w - pw - max(16, 4%w)`) and bottom (`y = h - ph - 48`).
  - Mobile (<760px): centred, `y = 64`, `ph = min(h*.6, w*.9/asp)`.
- Font: Geist Mono 7px (6px under 1100px wide, 5.5px on mobile); cell 0.6em × 1.2em.
- Build:
  - Sample each cell 4×4 and average the luminance.
  - Subtract a 0.05 background floor and normalise by the 96th percentile of non-zero cells.
  - Apply `v^0.7`; skip cells with `v < .07`.
  - Character: `ramp[round(v*(len-1))]`, with ramp `" .,:;^Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"`.
  - Colour level: >.72 `#ecebe6`, >.46 `#a3a29c`, >.24 `#6b6a64`, else `#3a3a35`.
- Animation:
  - **Build-in:** starts 450ms after intro. Each cell appears at `row/rows*1.1 + rand*0.6` s and shows a random glyph from `<>/\{}[]01#$%&*=+` in the accent colour for 220ms before its final character.
  - **Cursor:** within a 110px radius (60px on mobile), cells push outward by `(1-d/R)²*26px` and switch to random accent glyphs with probability `(1-d/R)*0.9`. It follows the real pointer only, with lerp .16 and no idle wandering.
  - **Scan line:** a horizontal band that lifts cells one brightness level, moving `((t*.09)%1.4-.2)*ph`.
  - **Glitch:** when `sin(1.7t)*sin(.63t) > .93`, a 3-row band shifts 3 cells to the right.
  - **Scroll break-up:** with `sp = scrollY/heroHeight`, cells drop out when `rand2 < sp*1.3-.15`, drift `x += (rand1-.5)*sp*220` and `y -= rand2*sp*160`.
  - **Readability:** any portrait cell inside the client rects of the headline text lines (`Range.getClientRects()` per line, padded 12px horizontally and 10px vertically) drops to a dim colour level.
- Alternative hero objects (config): `torus` (a donut.c-style rotating ASCII torus that tilts with the cursor and spins faster on scroll) or `field only`.

## Interactions and behaviour
- **Text scramble** (links, H2s, email): on mouseenter, each character resolves left to right over ~650ms (700ms for H2s, with a 90ms stagger between lines), cycling through `!<>-_\/[]{}=+*^?#01`. Spaces are kept. Clamp progress to [0,1], because an animation-frame timestamp can be earlier than the start time.
- **Custom cursor:** a fixed 10px accent square, lerp .25. Over `a`/`button` it grows to a 56px circle outline (transparent fill, 1px accent border). Hidden on `(hover: none)`. The native cursor stays visible.
- **Scroll reveal** (`[data-io]`): starts at opacity 0 and translateY(48px); at 12% visibility (rootMargin -6% bottom) it goes to opacity 1 over 1.1s and transform none over 1.3s, both on the main easing. Runs once.
- **Performance:** a single animation-frame loop. Canvases draw only while their IntersectionObserver reports them visible. Resize on `ResizeObserver` (debounced 60ms) and on `document.fonts.ready`. DPR capped at 2. Guard against 0×0 layout before measuring.
- **Reduced motion:** no loader, no reveals or scrambles, the approach text fully lit, the runs grid full, and static canvases drawn once.
- **Responsive:** everything uses fluid clamp() sizes and flex-wrap or auto-fit grids. The only breakpoints are inside the JS (700px and 760px for canvas sizing). Hover effects are desktop only.

## State
No app state. Only local UI state: the copy-button label, the hover preview's target, and pointer and scroll velocity for the animations. The writing list and work entries should come from content files or RSS.

## Assets
- `assets/portrait-ascii.png`: the user's ASCII portrait screenshot from the current site (used as luminance source).
- TimeRabbit app screenshot: **needed** (placeholder at the moment).
- Fonts: Google Fonts (Geist, Geist Mono, Newsreader).

## Files
- `Marcin Urbanski.dc.html`: the full design (template plus the `Component` logic class with every animation).
- `support.js`: the runtime needed only to open the reference file in a browser.
- `assets/portrait-ascii.png`: the portrait source.
