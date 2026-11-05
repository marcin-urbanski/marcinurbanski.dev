# marcinurbanski.dev: run and deploy

Cloudflare Pages, static files only (`public/`). No build step, no Functions, no database.

## Run locally

```bash
wrangler pages dev --port 8788    # http://localhost:8788, serves _headers and 404.html like production
```

## Deploy

```bash
node tools/asset-versions.js    # after changing any .js or .css: new ?v= hashes in the HTML (the tests check them)
wrangler pages deploy --branch main
```

The zone lets browsers keep JS and CSS for 4 hours, while HTML is always revalidated. The `?v=` hash in each
script and stylesheet URL is what makes a returning visitor fetch the new file after a deploy.

First deploy (2026-11-04): `wrangler pages project create marcinurbanski --production-branch main`, then the steps
below in the Cloudflare dashboard.

1. Workers & Pages → marcinurbanski → Custom domains → add `marcinurbanski.dev`, then `www.marcinurbanski.dev`.
2. Rules → Redirect rule (wildcard pattern): request URL `https://www.marcinurbanski.dev/*` → `https://marcinurbanski.dev/${1}`, 301, keep the query string.
3. Same project → Metrics → Web Analytics → Enable (cookieless; Cloudflare adds the script itself).

Mail: `hello@marcinurbanski.dev` is Cloudflare Email Routing to Marcin's inbox. Its MX and SPF records live in the same
zone; don't add another mail provider's MX records next to them.

## Adding a post

1. Copy `public/writing/skip-the-tests/index.html` to `public/writing/<slug>/index.html` and replace the article.
2. In `public/index.html`, copy the `<a class="hp-row hp-post" …>` row in `<section class="hp-writing">` and put
   the copy above the others (newest first). Change its `href`, the `<time>` (both `datetime` and the text), the
   `.hp-post-title` and the reading time in `.hp-row-meta`; keep `data-plain` and `data-io`. Then add the post to
   `public/rss.xml` (newest item first, update `lastBuildDate`) and to `public/sitemap.xml`.
3. Before deploying, run `node --test tests/` and check locally at 1280 px and 375 px: no sideways scroll, chart
   labels readable.
