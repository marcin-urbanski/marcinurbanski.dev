const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { htmlFiles } = require("../tools/asset-versions.js");

const css = fs.readFileSync(path.join(__dirname, "../public/styles.css"), "utf8");

test("the post meta line is a small label, not paragraph-sized", () => {
  // The meta line is a <p>, so a bare .post-meta rule loses to .post p (18px); it needs .post .post-meta.
  const rule = css.match(/^\.post \.post-meta \{([^}]*)\}/m);
  assert.ok(rule, "expected a .post .post-meta rule");
  assert.match(rule[1], /font: 400 12px\/1\.6 var\(--mono\)/);
});

// Every page: the home page, the 404 and each post.
const pages = htmlFiles(path.join(__dirname, "../public")).map(file => ({
  name: path.relative(path.join(__dirname, "../public"), file), html: fs.readFileSync(file, "utf8")
}));
const page = name => pages.find(p => p.name === name).html;

test("every page starts with a skip link to the main content", () => {
  for (const { name, html } of pages) {
    assert.match(html, /<body[^>]*>\s*<a class="skip" href="#main">Skip to content<\/a>/, name);
  }
});

test("every page has one main, the skip link's focusable target", () => {
  for (const { name, html } of pages) {
    const mains = html.match(/<main\b[^>]*>/g) || [];
    assert.equal(mains.length, 1, name);
    assert.match(mains[0], /\bid="main"/, name);
    assert.match(mains[0], /\btabindex="-1"/, name);
  }
});

test("no page keeps its header nav inside main, so the skip link skips it", () => {
  for (const { name, html } of pages) {
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    assert.doesNotMatch(main, /<header\b|aria-label="Main"/, name);
  }
});

// Spec AC 15: the home page is the current page; a post belongs to the writing section.
test("aria-current marks only the home link on the home page and the writing link on a post", () => {
  const current = html => [...html.matchAll(/<a [^>]*aria-current="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(m => [m[2], m[1]]);
  assert.deepEqual(current(page("index.html")), [["marcinurbanski.dev", "page"]]);
  assert.deepEqual(current(page("writing/skip-the-tests/index.html")), [["writing", "true"]]);
  assert.deepEqual(current(page("404.html")), []);
  for (const { name, html } of pages) {
    assert.equal((html.match(/aria-current/g) || []).length, current(html).length, name);
  }
});

// Spec AC 16: Cloudflare's Email Obfuscation rewrites a bare address into a link to its decoder script, so the
// address reads only with JavaScript. Local wrangler does not do it, so only this test catches a bare one.
test("every contact address on a page is excluded from Cloudflare's email obfuscation", () => {
  for (const { name, html } of pages) {
    const outside = html.replace(/<!--email_off-->[\s\S]*?<!--\/email_off-->/g, "");
    assert.doesNotMatch(outside, /hello@marcinurbanski\.dev/, name);
  }
  assert.match(page("index.html"), /<!--email_off-->[^]*?hello@marcinurbanski\.dev[^]*?<!--\/email_off-->/);
  assert.match(page("writing/skip-the-tests/index.html"), /<!--email_off-->[^]*?hello@marcinurbanski\.dev[^]*?<!--\/email_off-->/);
});
