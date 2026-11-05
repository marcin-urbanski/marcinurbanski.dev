# marcinurbanski.dev

Personal site and writing of Marcin Urbanski. Plain HTML, CSS and JS in `public/`, served by Cloudflare Pages.

- `public/index.html`: home page. Its styles are in `public/styles.css`, shared with the posts and the 404 page.
- `public/effects-core.js`: the maths behind the home page effects (loader, scramble, clock, count-up, runs grids,
  strip, cursor, preview panel) and the page's frame loop, with no DOM.
- `public/effects.js`: the home page effects themselves, run from one `requestAnimationFrame` loop. The intro
  loader shows once per tab (`sessionStorage` key `loader-seen`). Under reduced motion every effect shows its
  final state.
- `public/study-runs.json`: the result of each of the study's 1,080 runs, drawn by the home page runs grids.
- `public/site.js`: the contact "copy address" button.
- `public/portrait.js`: the ASCII portrait in the hero and the bubbles that build it.
- `public/portrait-3d.js`: the 3D maths for the portrait (depth map sampling, turning the face, lighting).
- `public/writing/<slug>/`: posts, listed in `public/rss.xml`.
- `tests/`: `node --test tests/` checks the pure logic in `public/`, the copy button and the home page markup.
- `tools/portrait-depth.py`: offline script that builds the portrait's depth map; nothing from it ships.
- `tools/study-runs.py`: offline script that writes `public/study-runs.json` from the study's results in claude-skills.
- `docs/design/`: the design handoff for the home page; `docs/specs/` and `docs/plans/`: its spec and plan.
- `DEPLOY.md`: running locally, deploying, adding a post.
