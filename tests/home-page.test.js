const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { runsFrame } = require("../public/effects-core.js");

const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../public/styles.css"), "utf8");

// Visible text with JS off: no tags, no template contents, entities decoded, whitespace collapsed.
const text = s => s
  .replace(/<template[\s\S]*?<\/template>/g, " ")
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, "\"")
  .replace(/\s+/g, " ");
const bodyText = text(html.slice(html.indexOf("<body")));
const tag = re => html.match(re);

test("the home body carries the home-page class", () => {
  assert.match(html, /<body class="home-page">/);
});

test("the hero keeps the hooks portrait.js looks up", () => {
  const hero = tag(/<section [^>]*>/g).find(t => /class="[^"]*\bhero\b/.test(t));
  assert.ok(hero, "a section with class hero");
  assert.match(hero, /id="top"/);
  assert.match(html, /<canvas id="face" aria-hidden="true"><\/canvas>/);
  assert.match(html, /<canvas id="bubbles" aria-hidden="true"><\/canvas>/);
});

test("each hero headline line has data-line", () => {
  const lines = [...html.matchAll(/<span [^>]*data-line[^>]*>([\s\S]*?)<\/span>\s*<\/span>/g)].map(m => text(m[1]).trim());
  assert.deepEqual(lines, [
    "Designer turned",
    "developer.",
    "I build my own apps with AI agents and test what actually makes them reliable."
  ]);
});

test("every link target of the previous home page is still linked", () => {
  for (const href of [
    "#work", "#writing", "#contact", "/writing/skip-the-tests/", "https://github.com/marcin-urbanski/claude-skills",
    "https://gettimerabbit.com", "/rss.xml", "mailto:hello@marcinurbanski.dev",
    "https://www.linkedin.com/in/marcin-urbanski-70761424/", "https://github.com/marcin-urbanski"
  ]) assert.ok(html.includes(`href="${href}"`), href);
});

test("internal links stay relative and open in the same tab", () => {
  assert.doesNotMatch(html, /<a [^>]*href="https:\/\/marcinurbanski\.dev/);
  assert.doesNotMatch(html, /target="_blank"/);
});

test("every body sentence of the previous home page is in the markup", () => {
  for (const s of [
    "Hi, I'm Marcin Urbanski.",
    "Designer turned developer. I build my own apps with AI agents and test what actually makes them reliable.",
    "Ten years of graphic and web design, then development: WordPress, WooCommerce and Laravel for UK clients, " +
      "checkout flows and performance work. Now I apply the same habit to agents. Reproduce, measure, fix the cause.",
    "web, since 2008", "Southampton, UK",
    "What happens when you tell a coding agent to skip the tests?",
    "Opus, Sonnet and Haiku, four setups, three requests, 30 runs each. A written rule, installed as a skill as well, " +
      "held against \"skip the tests\". Nothing I tried held when the user narrowed the scope themselves.",
    "study · 2026-11-03", "1,080", "runs", "open source", "claude-skills",
    "The process skills I run Claude Code with: test-first, verification, specs and independent review, each change " +
      "checked with evals.",
    "app · macOS", "TimeRabbit", "A native macOS time tracker, written by agents under my rules, tests and review.",
    "4 Nov 2026", "8 min", "Questions about agents, evals or a project? Write to me.", "hello@marcinurbanski.dev",
    "copy address", "or find me on LinkedIn and GitHub", "© 2026 Marcin Urbanski"
  ]) assert.ok(bodyText.includes(s), s);
});

test("sections use the design's headings and labels", () => {
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => text(m[1]).trim());
  assert.deepEqual(h2s, ["Selected work", "Writing", "(04) — contact"]);
  for (const s of ["(01) — approach", "(02) — 3 projects", "(03) — notes & studies", "back to top ↑"]) {
    assert.ok(bodyText.includes(s), s);
  }
});

test("the writing row keeps its machine-readable date", () => {
  assert.match(html, /<time datetime="2026-11-04">4 Nov 2026<\/time>/);
});

test("the runs grids show their final state and are hidden from assistive tech", () => {
  const pres = [...html.matchAll(/<pre([^>]*)>([\s\S]*?)<\/pre>/g)].filter(m => /data-runs/.test(m[1]));
  assert.equal(pres.length, 3);
  pres.forEach((m, i) => {
    assert.match(m[1], /aria-hidden="true"/);
    assert.equal(m[2], runsFrame(1, i).map(line => line.map(s => s.text).join("")).join("\n"));
  });
  assert.ok(bodyText.includes("3 models × 4 setups × 3 requests × 30 runs"));
});

test("the claude-skills preview is an inert template and TimeRabbit has none", () => {
  const tpl = html.match(/<template id="preview-skills">([\s\S]*?)<\/template>/);
  assert.ok(tpl, "template#preview-skills");
  assert.match(tpl[1], /~\/claude-skills/);
  assert.match(tpl[1], /\$ ls\ntest-first\/ +verification\/\nspecs\/ +review\//);
  const rows = tag(/<a [^>]*>/g).filter(t => /data-preview/.test(t));
  assert.deepEqual(rows.map(t => t.match(/href="([^"]+)"/)[1]), ["https://github.com/marcin-urbanski/claude-skills"]);
});

test("the copy button keeps its id and has no live region yet", () => {
  const btn = tag(/<button [^>]*id="copy"[^>]*>/);
  assert.ok(btn);
  assert.doesNotMatch(btn[0], /aria-live/);
  assert.match(html, /<a [^>]*id="mail"[^>]*href="mailto:hello@marcinurbanski\.dev"/);
});

test("the header clock shows only the place without JS", () => {
  const clock = html.match(/<div class="hp-clock">([\s\S]*?)<\/div>/);
  assert.ok(clock);
  assert.equal(text(clock[1]).trim(), "Southampton");
});

test("the page has no inline styles", () => {
  assert.doesNotMatch(html, /\sstyle=/);
});

test("only site.js and portrait.js are loaded, in that order", () => {
  const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(srcs, ["/site.js", "/portrait.js"]);
});

test("the old home-only rules are gone from the stylesheet", () => {
  for (const sel of [".col", ".statement", ".facts", ".sec", ".num", ".item", ".lead", ".meta", ".work-grid",
    ".writing", ".rt", ".mail", ".contact-lead", ".contact-alt", ".sec-title"]) {
    const re = new RegExp(`(^|[\\s,}])${sel.replace(".", "\\.")}(?![\\w-])[^{}]*\\{`, "m");
    assert.doesNotMatch(css, re, sel);
  }
});

test("the face canvas has one rule: absolute, inset 0 at every width", () => {
  const rules = [...css.matchAll(/#face\s*\{([^}]*)\}/g)].map(m => m[1]);
  assert.equal(rules.length, 1);
  assert.match(rules[0], /position: absolute; inset: 0;/);
});

test("no rule outside the motion start states hides content", () => {
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/html\.(motion|intro)/.test(sel) || /::-webkit-details-marker/.test(sel)) continue;
    assert.doesNotMatch(body, /opacity:\s*0(\.0*)?\s*(;|$)|visibility:\s*hidden|color:\s*transparent|display:\s*none/,
      sel.trim());
  }
});
