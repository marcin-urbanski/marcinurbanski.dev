# marcinurbanski.dev

Personal site and writing of Marcin Urbanski. Plain HTML, CSS and JS in `public/`, served by Cloudflare Pages.

- `public/index.html`: home page. The ASCII portrait and its bubbles are in `public/portrait.js`, the maths
  that turns it in 3D in `public/portrait-3d.js` (tests: `node --test tests/`). Its depth map comes from
  `tools/portrait-depth.py`, run once offline.
- `public/writing/<slug>/`: posts, listed in `public/rss.xml`.
- `DEPLOY.md`: running locally, deploying, adding a post.
