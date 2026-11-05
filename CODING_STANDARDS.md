# Coding standards

Rules the reviewer checks on every diff, on top of its general checklist. Breaking one is at least Important.
Keep this file to 15 rules at most: a new rule replaces or merges an old one, and anything a compiler or test can
enforce goes there instead.

## Core

The few things that are most expensive to get wrong on marcinurbanski.dev.

1. **Static files, nothing to install.** The site is plain HTML, CSS and JS in `public/`, deployed as is by
   `wrangler pages deploy`: no build step, no npm runtime dependency, no framework. Pages load only their own files
   and what Cloudflare injects (Web Analytics). Offline tools in `tools/` may use anything; nothing from them ships.
   *Why:* a build step or a CDN script turns a two-minute deploy into a broken page when it fails.
   (0 findings)
2. **Design values come from `:root`.** Colours, fonts and the accent are CSS custom properties on `:root` in
   `public/styles.css`; rules use `var(--…)` and canvases read them with `getComputedStyle`. No literal colour in a
   CSS rule or in JS, except the tokens' own definitions and `theme-color` in the HTML head. *Why:* the accent is
   meant to change in one place, and a stray hex keeps the old colour on one screen. (0 findings)
3. **Every animation has a reduced-motion path and runs only while visible.** Under `prefers-reduced-motion:
   reduce` the page shows each effect's final state with no motion. Frame work runs from the page's one
   `requestAnimationFrame` loop and only for elements an `IntersectionObserver` reports on screen. *Why:* motion can
   make visitors ill, and an off-screen canvas still drains a phone's battery. (0 findings)
4. **Content is in the HTML; scripts only decorate it.** All copy, links and section structure are in the page's
   markup and readable with JavaScript off. A script may hide something only by adding a class or style itself,
   never through CSS that hides content by default. *Why:* a failed script or a crawler would otherwise see an
   empty page. (0 findings)
5. **Logic that runs without a browser is tested.** Pure calculations (easing, text frames, progress, geometry)
   live in dual browser/CommonJS files in `public/` (like `portrait-3d.js`) and have tests in `tests/` run by
   `node --test tests/`; DOM and canvas code calls them. *Why:* the DOM code has no tests, so logic left inside it
   is checked only by eye. (0 findings)

## From evidence

Each rule has at least two findings, or the user asked for it.
