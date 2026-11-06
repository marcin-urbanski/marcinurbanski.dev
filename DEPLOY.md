# marcinurbanski.dev: run and deploy

Cloudflare Pages, static files only (`public/`). No build step, no Functions, no database.

## Run locally

```bash
wrangler pages dev --port 8788    # http://localhost:8788, serves _headers and 404.html like production
```

## Deploy

```bash
node tools/asset-versions.js && node --test tests/ && wrangler pages deploy --branch main
```

`public/_headers` lets browsers keep scripts, stylesheets, fonts and `portrait-data.json` for a year without asking
again (`Cache-Control: public, max-age=31536000, immutable`), while HTML is always revalidated. That is safe because
their URLs change with their content: the `?v=` hash the tool writes into each script, stylesheet and JSON data URL
makes a returning visitor fetch the new file after a deploy, and fonts carry a version in the file name
(`geist-latin-v5.woff2`), so a changed font needs a new file name. Everything else (`study-runs.json`, images, feeds,
the font licence `fonts/OFL.txt`) keeps the zone's Browser Cache TTL of 4 hours, which applies only where the
origin's max-age is lower; an image that changes needs a new file name too. After a deploy, check with
`curl -sI 'https://marcinurbanski.dev/styles.css?v=<hash>'` (the hash from the page source): it shows the year-long
`Cache-Control` and the `/*` security headers, and `curl -sI https://marcinurbanski.dev/` does not show it.

First deploy (2026-11-04): `wrangler pages project create marcinurbanski --production-branch main`, then the steps
below in the Cloudflare dashboard.

1. Workers & Pages → marcinurbanski → Custom domains → add `marcinurbanski.dev`, then `www.marcinurbanski.dev`.
2. Rules → Redirect rule (wildcard pattern): request URL `https://www.marcinurbanski.dev/*` → `https://marcinurbanski.dev/${1}`, 301, keep the query string.
3. Same project → Metrics → Web Analytics → Enable (cookieless; Cloudflare adds the script itself).

Mail: `hello@marcinurbanski.dev` is Cloudflare Email Routing to Marcin's inbox. Its MX and SPF records live in the same
zone; don't add another mail provider's MX records next to them.

## Adding a post

1. Copy `public/writing/skip-the-tests/index.html` to `public/writing/<slug>/index.html` and replace the article.
   Keep what the tests check on every page: the `<a class="skip" href="#main">` skip link first in `<body>`,
   `<main class="wrap" id="main" tabindex="-1">`, `aria-current="true"` on the header's "writing" link, and any
   `hello@marcinurbanski.dev` inside `<!--email_off-->` … `<!--/email_off-->` (Cloudflare's Email Obfuscation would
   otherwise rewrite it into a link that needs JavaScript; local wrangler does not, so only the test shows it).
   In `<head>`, point `og:image` at `https://marcinurbanski.dev/og/<slug>.jpg` and rewrite its `og:image:alt`, and
   update the `<script type="application/ld+json">` BlogPosting: `headline` = the `<h1>`, `description` = the meta
   description, `datePublished` = the `<time datetime>`, `url` and `mainEntityOfPage` = the canonical URL, `image` =
   the card. Keep `author` as it is and never add the e-mail address; the tests compare these with the page.
2. Make the share card: `sh tools/og-images.sh` screenshots the home page and every post at 1200×630 into
   `public/og/` (and remakes the touch icon), from a copy of `public/` it serves itself on port 8789. Look at the new
   card. A changed card keeps its URL (cards are not cached for a year), but social networks cache it for days.
3. In `public/index.html`, copy the `<a class="hp-row hp-post" …>` row in `<section class="hp-writing">` and put
   the copy above the others (newest first). Change its `href`, the `<time>` (both `datetime` and the text), the
   `.hp-post-title` and the reading time in `.hp-row-meta`; keep `data-plain` and `data-io`. Then add the post to
   `public/rss.xml` (newest item first, update `lastBuildDate`) and to `public/sitemap.xml`.
4. Before deploying, run `node --test tests/` and check locally at 1280 px and 375 px: no sideways scroll, chart
   labels readable.
