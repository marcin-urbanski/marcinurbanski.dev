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
test("every page links each local script and stylesheet at its current version", () => {
  const pages = htmlFiles(PUBLIC);
  assert.ok(pages.length >= 3, "the home page, 404 and the post");
  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    assert.equal(html, versionAssets(html, f => assetHash(path.join(PUBLIC, f))),
      `${path.relative(PUBLIC, page)} is out of date: run node tools/asset-versions.js`);
    // any other way of writing a local script or stylesheet URL would slip past versionAssets
    for (const [, url] of html.matchAll(/(?:src|href)\s*=\s*["']?([^"'\s>]+\.(?:js|css)(?:\?[^"'\s>]*)?)/g)) {
      if (/^https?:/.test(url)) continue;
      assert.match(url, /^\/[^?]+\?v=[0-9a-f]{8}$/, `${path.relative(PUBLIC, page)}: ${url} is not a versioned /path`);
    }
  }
});
