# marcinurbanski.dev

Personal site and writing of Marcin Urbanski. Plain HTML, CSS and JS in `public/`, served by Cloudflare Pages.

- `public/index.html`: home page. Its styles are in `public/styles.css`, shared with the posts and the 404 page.
- `public/effects-core.js`: the maths behind the home page effects (loader, scramble, clock, count-up, runs grids,
  strip, cursor, preview panel), the page's frame loop (layout reads go in its read phase, run first in each frame)
  and the after-paint and idle schedulers the portrait starts from, with no DOM.
- `public/effects.js`: the home page effects themselves, run from one `requestAnimationFrame` loop. The intro
  loader shows once per tab (`sessionStorage` key `loader-seen`). Under reduced motion every effect shows its
  final state.
- `public/study-runs.json`: the result of each of the study's 1,080 runs, drawn by the home page runs grids.
- `public/site.js`: the contact "copy address" button.
- `public/portrait.js`: the ASCII portrait in the hero and the bubbles that build it.
- `public/portrait-data.json`: the portrait's 320x393 brightness grid and its depth map at half resolution, as
  base64; portrait.js fetches it after the first paint.
- `public/portrait-3d.js`: the 3D maths for the portrait (depth map sampling, turning the face, lighting).
- `public/fonts/`: Geist (latin and latin-ext), Geist Mono and Newsreader italic (latin), the variable woff2 files
  Google Fonts serves, self-hosted under their licence (`OFL.txt`). A file name carries the gstatic version
  (`geist-latin-v5.woff2`), so a new version is a new file; `@font-face` is at the top of `public/styles.css`.
- `public/writing/<slug>/`: posts, listed in `public/rss.xml`.
- `tests/`: `node --test tests/` checks the pure logic in `public/`, the copy button and the home page markup.
- `tools/portrait-depth.py`: offline script that builds the portrait's depth map into `public/portrait-data.json`;
  `--check` only prints the grid sizes.
- `tools/asset-versions.js`: adds `?v=<hash>` to the script, stylesheet and JSON data URLs in the HTML; part of the
  deploy command in `DEPLOY.md`.
- `tools/font-metrics.py`: offline script that prints the `size-adjust` and `*-override` values for the local
  fallback faces in `public/styles.css` (`pip3 install --user fonttools brotli`, then `python3 tools/font-metrics.py`
  on a Mac); it measures widths over the site's own copy, so re-run it and paste the values when a font file or much
  of the copy changes.
- `tools/study-runs.py`: offline script that writes `public/study-runs.json` from the study's results in claude-skills.
- `docs/design/`: the design handoff for the home page; `docs/specs/` and `docs/plans/`: its spec and plan.
- `DEPLOY.md`: running locally, deploying, adding a post.
