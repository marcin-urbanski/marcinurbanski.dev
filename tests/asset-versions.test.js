const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { versionAssets, assetHash, htmlFiles } = require("../tools/asset-versions.js");

const PUBLIC = path.join(__dirname, "../public");

test("versionAssets adds ?v=<hash> to local script and stylesheet URLs", () => {
  const html = '<link rel="stylesheet" href="/styles.css">\n<script src="/a.js"></script>';
  assert.equal(versionAssets(html, f => f + "-h"), '<link rel="stylesheet" href="/styles.css?v=styles.css-h">\n<script src="/a.js?v=a.js-h"></script>');
});

test("versionAssets replaces an old version", () => {
  assert.equal(versionAssets('<script src="/a.js?v=0ld"></script>', () => "n3w"), '<script src="/a.js?v=n3w"></script>');
});

test("versionAssets versions a local JSON URL in data-src", () => {
  assert.equal(versionAssets('<canvas id="face" data-src="/data.json"></canvas>', () => "h"), '<canvas id="face" data-src="/data.json?v=h"></canvas>');
});

test("versionAssets leaves other URLs alone", () => {
  const html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist">' +
    '<img src="/shot.webp"><a href="/rss.xml"></a><link rel="icon" href="/favicon.svg">';
  assert.equal(versionAssets(html, () => "x"), html);
});

test("assetHash is the first 8 hex characters of the file's SHA-256", () => {
  const file = path.join(fs.mkdtempSync(path.join(require("node:os").tmpdir(), "assets-")), "abc.js");
  fs.writeFileSync(file, "abc");
  assert.equal(assetHash(file), "ba7816bf");
});

// After a deploy the HTML is fetched fresh (max-age=0) while the zone lets browsers keep JS and CSS for 4 hours,
// so each page must point at URLs that change whenever the file does.
test("every page links each local script, stylesheet and data file at its current version", () => {
  const pages = htmlFiles(PUBLIC);
  assert.ok(pages.length >= 3, "the home page, 404 and the post");
  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    assert.equal(html, versionAssets(html, f => assetHash(path.join(PUBLIC, f))),
      `${path.relative(PUBLIC, page)} is out of date: run node tools/asset-versions.js`);
    // any other way of writing a local script, stylesheet or data URL would slip past versionAssets
    for (const [, url] of html.matchAll(/(?:src|href)\s*=\s*["']?([^"'\s>]+\.(?:json|js|css)(?:\?[^"'\s>]*)?)/g)) {
      if (/^https?:/.test(url)) continue;
      assert.match(url, /^\/[^?]+\?v=[0-9a-f]{8}$/, `${path.relative(PUBLIC, page)}: ${url} is not a versioned /path`);
    }
  }
});

// Fonts are self-hosted (CODING_STANDARDS rule 1), so a page that still names Google Fonts waits on a third party.
test("no page or stylesheet references Google Fonts", () => {
  for (const file of [...htmlFiles(PUBLIC), path.join(PUBLIC, "styles.css")]) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /fonts\.(?:googleapis|gstatic)\.com/, path.relative(PUBLIC, file));
  }
});

// Font files are versioned by name rather than ?v=, so a new font is a new file and a stale cache cannot serve it.
test("every font in styles.css exists under a versioned file name", () => {
  const css = fs.readFileSync(path.join(PUBLIC, "styles.css"), "utf8");
  const urls = [...css.matchAll(/url\((\/fonts\/[^)]+)\)/g)].map(m => m[1]);
  assert.ok(urls.length >= 4, "Geist latin and latin-ext, Geist Mono, Newsreader italic");
  for (const url of urls) {
    assert.match(url, /^\/fonts\/[a-z-]+-v\d+\.woff2$/, url);
    assert.ok(fs.existsSync(path.join(PUBLIC, url)), `${url} is missing`);
  }
});

// Only the home page's first paint needs a font early (the hero headline is Geist); a preload anywhere else
// would compete with the page's own CSS.
test("the home page preloads only the Geist latin font and other pages preload nothing", () => {
  for (const page of htmlFiles(PUBLIC)) {
    const preloads = fs.readFileSync(page, "utf8").match(/<link [^>]*rel="preload"[^>]*>/g) || [];
    const expected = path.relative(PUBLIC, page) === "index.html"
      ? ['<link rel="preload" href="/fonts/geist-latin-v5.woff2" as="font" type="font/woff2" crossorigin>']
      : [];
    assert.deepEqual(preloads, expected, path.relative(PUBLIC, page));
  }
});

// While a web font loads, text shows in a local font scaled to the web font's metrics, so the swap barely moves it.
test("each font token lists a metric-matched fallback right after its web font", () => {
  const css = fs.readFileSync(path.join(PUBLIC, "styles.css"), "utf8");
  for (const [token, family] of [["display", "Geist"], ["mono", "Geist Mono"], ["serif", "Newsreader"]]) {
    assert.match(css, new RegExp(`--${token}: "${family}", "${family} Fallback",`), token);
    const faces = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map(m => m[1])
      .filter(f => f.includes(`font-family: "${family} Fallback"`));
    assert.ok(faces.length > 0, `a ${family} Fallback face`);
    for (const face of faces) {
      for (const prop of ["src: local(", "size-adjust:", "ascent-override:", "descent-override:", "line-gap-override:", "unicode-range:"]) {
        assert.ok(face.includes(prop), `${family} Fallback has ${prop}`);
      }
    }
  }
});
