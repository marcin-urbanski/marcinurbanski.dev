const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { htmlFiles } = require("../tools/asset-versions.js");

const PUBLIC = path.join(__dirname, "../public");
const LONG_CACHE = "public, max-age=31536000, immutable";

// public/_headers is blocks of a path line followed by indented `Name: value` lines (Cloudflare Pages). Returns
// [{ path, headers: { name: value } }] in file order; header names are kept as written.
function parseHeaders(text) {
  const rules = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) { rules.push({ path: line.trim(), headers: {} }); continue; }
    const [, name, value] = line.match(/^\s+([^:]+):\s*(.*)$/);
    rules.at(-1).headers[name.trim()] = value.trim();
  }
  return rules;
}

// Cloudflare Pages matches a rule against the request's pathname, not its query: a `*` (one per rule) matches any
// characters, slashes included, a `:name` placeholder one path segment, and the whole path must match.
const matches = (rule, pathname) => new RegExp("^" + rule.split("*")
  .map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/:[A-Za-z]\w*/g, "[^/]+"))
  .join(".*") + "$").test(pathname);

const rules = parseHeaders(fs.readFileSync(path.join(PUBLIC, "_headers"), "utf8"));
const cacheRules = rules.filter(r => "Cache-Control" in r.headers);

test("parseHeaders reads path blocks and their indented headers", () => {
  assert.deepEqual(parseHeaders("/*\n  A: 1\n  B: x: y\n\n/rss.xml\n  C: 2\n"),
    [{ path: "/*", headers: { A: "1", B: "x: y" } }, { path: "/rss.xml", headers: { C: "2" } }]);
});

test("matches follows Cloudflare's splat and placeholder rules", () => {
  assert.ok(matches("/*.js", "/effects.js"));
  assert.ok(matches("/*.js", "/writing/a.js"));
  assert.ok(!matches("/*.js", "/study-runs.json"));
  assert.ok(matches("/fonts/*", "/fonts/geist-latin-v5.woff2"));
  assert.ok(matches("/:dir/index.html", "/writing/index.html"));
  assert.ok(!matches("/:dir/index.html", "/writing/a/index.html"));
});

// The URLs of these files change with their content (?v=<hash>, or a version in a font's file name), so a
// browser may keep each one for a year without asking again (spec AC 11).
test("scripts, stylesheets, fonts and the portrait data are cached for a year", () => {
  for (const rule of ["/*.js", "/*.css", "/fonts/*", "/portrait-data.json"]) {
    const found = rules.find(r => r.path === rule);
    assert.ok(found, `${rule} has a rule`);
    assert.equal(found.headers["Cache-Control"], LONG_CACHE, rule);
  }
});

// Each matching rule's value is appended to the first one's, so two Cache-Control rules on one path would send a
// header the browser cannot read reliably.
test("every versioned URL a page links is cached for a year by exactly one rule", () => {
  for (const page of htmlFiles(PUBLIC)) {
    for (const [, url] of fs.readFileSync(page, "utf8").matchAll(/(?:src|href)="(\/[^"?]+)\?v=/g)) {
      const found = cacheRules.filter(r => matches(r.path, url));
      assert.equal(found.length, 1, `${path.relative(PUBLIC, page)}: ${url}`);
      assert.equal(found[0].headers["Cache-Control"], LONG_CACHE, url);
    }
  }
});

// HTML must revalidate so a deploy reaches visitors at once; study-runs.json is fetched without a version and
// images and feeds keep their names, so they keep the default too.
test("no Cache-Control rule matches a page, the runs data, an image or a feed", () => {
  const pages = htmlFiles(PUBLIC).map(p => "/" + path.relative(PUBLIC, p).split(path.sep).join("/"));
  const pretty = pages.map(p => p.replace(/index\.html$/, "")).concat(pages.map(p => p.replace(/\.html$/, "")));
  const others = ["/study-runs.json", "/rss.xml", "/sitemap.xml", "/robots.txt", "/favicon.svg", "/timerabbit-day.webp"];
  for (const url of [...pages, ...pretty, ...others]) {
    assert.deepEqual(cacheRules.filter(r => matches(r.path, url)).map(r => r.path), [], url);
  }
});

test("every path keeps the security headers and the feed keeps its Content-Type", () => {
  assert.deepEqual(rules.find(r => r.path === "/*").headers, {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY"
  });
  assert.equal(rules.find(r => r.path === "/rss.xml").headers["Content-Type"], "application/rss+xml; charset=utf-8");
});
