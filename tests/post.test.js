const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { htmlFiles } = require("../tools/asset-versions.js");
const { jsonLd } = require("./helpers.js");

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

// Spec AC 18: every page names the opaque 180×180 PNG an iPhone puts on its home screen.
test("every page links the apple-touch-icon", () => {
  for (const { name, html } of pages) {
    assert.match(html, /<head>[\s\S]*<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">[\s\S]*<\/head>/, name);
  }
});

// A PNG's IHDR chunk follows the 8-byte signature: width, height, bit depth, then the colour type (2 = RGB, no alpha).
test("the apple-touch-icon is a 180×180 PNG with no alpha channel", () => {
  const png = fs.readFileSync(path.join(__dirname, "../public/apple-touch-icon.png"));
  assert.equal(png.toString("latin1", 1, 4), "PNG");
  assert.equal(png.toString("latin1", 12, 16), "IHDR");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [180, 180]);
  assert.equal(png[25], 2, "colour type");
});

// Spec AC 17: the indexable pages share as a large card; the 404 is noindex and has no card.
const meta = (html, prop) => (html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)">`)) || [])[1];
const posts = pages.map(p => p.name).filter(name => /^writing\/[^/]+\/index\.html$/.test(name));
const cards = Object.fromEntries([["index.html", "home"], ...posts.map(name => [name, name.split("/")[1]])]);

test("the home page and each post have a 1200×630 og:image card with alt text", () => {
  for (const [name, card] of Object.entries(cards)) {
    const html = page(name);
    assert.equal(meta(html, "og:image"), `https://marcinurbanski.dev/og/${card}.jpg`, name);
    assert.equal(meta(html, "og:image:width"), "1200", name);
    assert.equal(meta(html, "og:image:height"), "630", name);
    assert.ok(meta(html, "og:image:alt"), name + ": og:image:alt");
    assert.equal(meta(html, "twitter:card"), "summary_large_image", name);
  }
});

test("the 404 has no share card", () => {
  assert.doesNotMatch(page("404.html"), /og:image|twitter:card/);
});

// A JPEG's size is in its start-of-frame segment (SOF0–SOF15, not DHT/JPG/DAC): height, then width.
const jpegSize = buf => {
  assert.deepEqual([buf[0], buf[1]], [0xff, 0xd8], "JPEG signature");
  for (let i = 2; i < buf.length;) {
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  assert.fail("no SOF marker");
};

test("each og:image file is a JPEG of 1200×630 under 300 KB", () => {
  for (const card of Object.values(cards)) {
    const jpg = fs.readFileSync(path.join(__dirname, `../public/og/${card}.jpg`));
    assert.deepEqual(jpegSize(jpg), [1200, 630], card);
    assert.ok(jpg.length < 300 * 1024, card + ": " + jpg.length + " bytes");
  }
});

test("each post's JSON-LD BlogPosting repeats its h1, description, date, canonical and card", () => {
  assert.ok(posts.includes("writing/skip-the-tests/index.html"));
  for (const name of posts) {
    const html = page(name);
    const ld = jsonLd(html);
    const canonical = html.match(/<link rel="canonical" href="([^"]*)">/)[1];
    assert.equal(ld["@context"], "https://schema.org");
    assert.equal(ld["@type"], "BlogPosting");
    assert.equal(ld.headline, html.match(/<h1>([^<]*)<\/h1>/)[1]);
    assert.equal(ld.description, meta(html, "description"));
    assert.equal(ld.datePublished, html.match(/<time datetime="([^"]*)">/)[1]);
    assert.equal(ld.url, canonical);
    assert.equal(ld.mainEntityOfPage, canonical);
    assert.equal(ld.image, meta(html, "og:image"));
    assert.deepEqual(ld.author, {
      "@type": "Person", "@id": "https://marcinurbanski.dev/#person", name: "Marcin Urbanski", url: "https://marcinurbanski.dev/"
    });
  }
});

test("no page's JSON-LD carries the e-mail address", () => {
  for (const { name, html } of pages) {
    for (const [, body] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotMatch(body, /@marcinurbanski\.dev|mailto:|"email"/, name);
    }
  }
});

// The skip link draws no focus ring of its own: the global a:focus-visible outline marks it once it appears.
test("no .skip rule overrides the global focus outline", () => {
  assert.match(css, /^a:focus-visible \{ outline: 2px solid var\(--ink\); outline-offset: 3px; \}$/m);
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^{}\n]*\.skip\b[^{]*\{[^}]*\}/gm);
  assert.ok(rules.length >= 2, ".skip rules");
  for (const rule of rules) assert.doesNotMatch(rule, /outline/, rule);
});
