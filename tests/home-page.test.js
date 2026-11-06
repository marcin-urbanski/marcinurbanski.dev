const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { runsFrame } = require("../public/effects-core.js");
const study = require("../public/study-runs.json");
const MODELS = ["opus", "sonnet", "haiku"];

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
  assert.match(html, /<canvas id="face" aria-hidden="true" data-src="\/portrait-data\.json\?v=[0-9a-f]{8}"><\/canvas>/);
  assert.match(html, /<canvas id="bubbles" aria-hidden="true"><\/canvas>/);
});

test("each hero headline line has data-line", () => {
  const lines = [...html.matchAll(/<span [^>]*data-line[^>]*>([\s\S]*?)<\/span>\s*<\/(?:span|p)>/g)].map(m => text(m[1]).trim());
  assert.deepEqual(lines, [
    "Designer turned",
    "developer.",
    "Senior web developer with a designer's eye. I build for the web, and lately with AI agents, testing what " +
      "actually makes them reliable."
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

test("every body sentence of the home page is in the markup", () => {
  for (const s of [
    "Hi, I'm Marcin Urbanski.",
    "Designer turned developer. Senior web developer with a designer's eye. I build for the web, and lately with AI " +
      "agents, testing what actually makes them reliable.",
    "I started in 2008 as a graphic designer who thought code was for developers. Seeing my designs come alive " +
      "changed that: first HTML and CSS, then WordPress, then Laravel, where everything has its place, just like in " +
      "good design. Today I work across the stack, from WordPress and Laravel to Next.js and AI agents. I still " +
      "notice when something's off.",
    "web, since 2008", "scroll ↓",
    "What happens when you tell a coding agent to skip the tests?",
    "Opus, Sonnet and Haiku, four setups, three requests, 30 runs each. A written rule, installed as a skill as well, " +
      "held against \"skip the tests\". Nothing I tried held when the user narrowed the scope themselves.",
    "runs · 3 Nov 2026", "1,080", "runs", "open source", "claude-skills",
    "The process skills I run Claude Code with: test-first, verification, specs and independent review, each change " +
      "checked with evals.",
    "app · macOS", "TimeRabbit", "A native macOS time tracker, written by agents under my rules, tests and review.",
    "4 Nov 2026", "8 min", "A project, a role, or just a question? Write to me.", "hello@marcinurbanski.dev",
    "copy address", "or find me on LinkedIn and GitHub", "© 2026 Marcin Urbanski"
  ]) assert.ok(bodyText.includes(s), s);
});

test("sections use the design's headings and labels", () => {
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map(m => text(m[1]).trim());
  assert.deepEqual(h2s, ["About", "Selected work", "Writing", "A project, a role, or just a question? Write to me."]);
  for (const s of ["(01) — about", "(02) — 3 projects", "(03) — notes & studies", "back to top ↑"]) {
    assert.ok(bodyText.includes(s), s);
  }
});

// Spec AC 12: no "(0X) — …" label is a heading. About's heading is visually hidden and its label is hidden from
// screen readers, so they read "About" once; Contact's heading is the question the section asks.
test("the About heading is visually hidden and its label is a paragraph screen readers skip", () => {
  assert.match(html, /<h2 class="hp-sr">About<\/h2>\s*<p class="hp-label hp-approach-label" aria-hidden="true">\(01\) — about<\/p>/);
});

test("the contact label is a paragraph and the contact lead is the section's heading, in the lead's weight", () => {
  assert.match(html, /<p class="hp-label" data-io>\(04\) — contact<\/p>\s*<h2 class="hp-contact-lead" data-io>/);
  assert.match(css, /\.home-page \.hp-contact-lead \{[^}]*font-weight: 400;/);
});

test("the visually hidden class is a plain rule, usable outside the home page", () => {
  assert.match(css, /\n\.hp-sr \{ position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset\(50%\); white-space: nowrap; \}/);
  assert.doesNotMatch(css, /\.home-page \.hp-sr/);
});

// Spec AC 14: off screen until focused, then at the top left over the cursor (80) and the loader (90).
test("the skip link stays off screen until focused, then shows at the top left above the loader", () => {
  const rule = cssRule(".skip");
  assert.match(rule, /position: fixed;/);
  assert.match(rule, /left: 12px; top: -100px;/);
  assert.match(rule, /background: var\(--bg\); color: var\(--ink\);/);
  assert.match(rule, /font: 400 13px\/normal var\(--mono\);/);
  assert.match(rule, /min-height: 44px;/);
  assert.ok(Number(rule.match(/z-index: (\d+)/)[1]) > 90, "z-index above the loader's 90");
  assert.match(cssRule(".skip:focus"), /top: 12px;/);
  assert.match(cssRule("main:focus"), /outline: none;/);
});

test("the header's home link marks the home page as the current page", () => {
  assert.match(html, /<header class="hp-head">\s*<a href="#top" data-scramble aria-current="page">marcinurbanski\.dev<\/a>/);
});

test("the writing row keeps its machine-readable date", () => {
  assert.match(html, /<time datetime="2026-11-04">4 Nov 2026<\/time>/);
});

test("the runs grids start empty, are hidden from assistive tech and name their model in study-runs.json", () => {
  const pres = [...html.matchAll(/<pre([^>]*)>([\s\S]*?)<\/pre>/g)].filter(m => /data-runs/.test(m[1]));
  assert.deepEqual(pres.map(m => (m[1].match(/data-runs="([^"]+)"/) || [])[1]), ["opus", "sonnet", "haiku"]);
  pres.forEach((m, i) => {
    assert.match(m[1], /aria-hidden="true"/);
    // the first frame of the fill, so the grid keeps its size until effects.js draws the results in
    assert.equal(m[2], runsFrame(0, i, study.runs[MODELS[i]]).map(line => line.map(s => s.text).join("")).join("\n"));
  });
  assert.ok(bodyText.includes("3 models × 4 setups × 3 requests × 30 runs"));
});

test("the runs grids have a legend: # held · x broke, the x in the red token", () => {
  assert.ok(bodyText.includes("# held · x broke"));
  assert.match(html, /# held · <span class="hp-run-broke">x<\/span> broke/);
  assert.match(css, /\.home-page \.hp-run-broke \{ color: var\(--red\); \}/);
});

test("effects.js draws the grids from study-runs.json", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/effects.js"), "utf8");
  assert.match(js, /fetch\("\/study-runs\.json"\)/);
});

// Each request's check, runs that held out of 30, per setup (nothing, skills, rules, rules + skills): the numbers
// the post and the claude-skills report publish.
const PUBLISHED = {
  opus: [[22, 29, 30, 30], [0, 30, 28, 30], [29, 30, 30, 30]],
  sonnet: [[0, 30, 30, 30], [0, 22, 0, 30], [0, 0, 0, 0]],
  haiku: [[0, 29, 30, 30], [0, 25, 30, 30], [0, 0, 2, 1]]
};

test("study-runs.json holds 1,080 runs as 3 models x 12 rows of 30, held or broke", () => {
  assert.deepEqual(Object.keys(study.runs), MODELS);
  for (const m of MODELS) {
    assert.equal(study.runs[m].length, 12, m);
    study.runs[m].forEach((row, r) => assert.match(row, /^[01]{30}$/, `${m} row ${r}`));
  }
  assert.deepEqual(study.setups, ["nothing", "skills", "rules", "rules + skills"]);
  assert.deepEqual(study.requests.map(r => r.name), ["no pressure", "hotfix", "narrowed scope"]);
});

test("study-runs.json matches the published results, row by row", () => {
  for (const m of MODELS) {
    const counts = study.runs[m].map(row => row.split("1").length - 1);
    // rows go setup by setup, request by request within a setup
    const byRequest = [0, 1, 2].map(q => [0, 1, 2, 3].map(setup => counts[setup * 3 + q]));
    assert.deepEqual(byRequest, PUBLISHED[m], m);
  }
});

test("the claude-skills preview is an inert template", () => {
  const tpl = html.match(/<template id="preview-skills">([\s\S]*?)<\/template>/);
  assert.ok(tpl, "template#preview-skills");
  assert.match(tpl[1], /~\/claude-skills/);
  assert.match(tpl[1], /\$ ls\ntest-first\/ +verification\/\nspecs\/ +review\//);
});

test("both project rows have a hover preview, TimeRabbit's an app screenshot that exists", () => {
  const rows = tag(/<a [^>]*>/g).filter(t => /data-preview/.test(t));
  assert.deepEqual(rows.map(t => [t.match(/href="([^"]+)"/)[1], t.match(/data-preview="([^"]+)"/)[1]]), [
    ["https://github.com/marcin-urbanski/claude-skills", "skills"],
    ["https://gettimerabbit.com", "timerabbit"]
  ]);
  const tpl = html.match(/<template id="preview-timerabbit">([\s\S]*?)<\/template>/);
  assert.ok(tpl, "template#preview-timerabbit");
  const img = tpl[1].match(/<img [^>]*>/);
  assert.ok(img, "an img in the TimeRabbit preview");
  assert.match(img[0], /alt=""/);
  assert.match(img[0], /width="\d+" height="\d+"/);
  assert.match(tpl[1], /<img [^>]*>\s*<div class="hp-pv-foot"><span>gettimerabbit\.com<\/span><\/div>/, "only the URL under the screenshot");
  const src = img[0].match(/src="\/([^"]+)"/)[1];
  assert.ok(fs.existsSync(path.join(__dirname, "../public", src)), src + " is in public/");
});

test("the hero h1 holds only the headline; the line under it is a paragraph", () => {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  assert.equal(text(h1[1]).trim(), "Designer turned developer.");
  assert.match(html, /<\/h1>\s*<p class="hp-mask hp-mask-sub"><span class="hp-h1-sub" data-line>Senior web developer/);
});

test("the writing row's post title is a heading and the study date is a time element", () => {
  assert.match(html, /<h3 class="hp-post-title">What happens when you tell a coding agent to skip the tests\?<\/h3>/);
  assert.match(html, /<span>runs · <time datetime="2026-11-03">3 Nov 2026<\/time><\/span>/);
});

test("every date on the site reads like 3 Nov 2026 and matches its datetime", () => {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pages = ["index.html", "404.html", "writing/skip-the-tests/index.html"];
  for (const page of pages) {
    const src = fs.readFileSync(path.join(__dirname, "../public", page), "utf8");
    for (const [, iso, shown] of src.matchAll(/<time datetime="([^"]+)">([^<]*)<\/time>/g)) {
      const [y, m, d] = iso.split("-").map(Number);
      assert.equal(shown, `${d} ${MONTHS[m - 1]} ${y}`, `${page}: ${shown}`);
    }
    assert.doesNotMatch(text(src), /\b\d{4}-\d{2}-\d{2}\b/, `${page}: an ISO date in the visible text`);
  }
});

test("the hero bottom bar has no place name; the header clock keeps Southampton", () => {
  const meta = html.match(/<div class="hp-hero-meta">([\s\S]*?)<\/div>/);
  assert.deepEqual([...meta[1].matchAll(/<span>([^<]*)<\/span>/g)].map(m => m[1]), ["web, since 2008", "scroll ↓"]);
  assert.match(html, /<div class="hp-clock"><span>Southampton<\/span>/);
});

test("Reproduce, measure, fix the cause appears only in the strip", () => {
  const strip = html.match(/<div class="hp-strip"[\s\S]*?\n<\/div>/)[0];
  assert.doesNotMatch(text(html.replace(strip, "")), /reproduce|fix the cause/i);
  assert.match(text(strip), /Reproduce \/ measure \/ fix the cause/);
  const core = fs.readFileSync(path.join(__dirname, "../public/effects-core.js"), "utf8");
  assert.doesNotMatch(core, /reproduce|fix the cause/i, "no loader log lines");
});

test("the section headings use the hero headline's size token", () => {
  const size = sel => (css.match(new RegExp(sel.replace(/\./g, "\\.") + " \\{[^}]*font-size: ([^;]+);")) || [])[1];
  assert.equal(size(".home-page .hp-h1-line"), "var(--type-display)");
  assert.match(css, /\.home-page \.hp-h2 \{[^}]*font: 400 var\(--type-display\)\//);
  assert.match(css, /:root \{[^}]*--type-display: clamp\(52px, 7\.6vw, 176px\);/);
});

// WCAG 2 contrast of two #rrggbb colours
const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4));
  return .2126 * r + .7152 * g + .0722 * b;
};
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + .05) / (lo + .05); };
const token = name => (css.match(new RegExp(`:root \\{[^}]*--${name}: (#[0-9a-f]{6});`)) || [])[1];

test("the red token passes WCAG AA for small text on the page background", () => {
  assert.ok(token("red"), "--red on :root");
  assert.ok(contrast(token("red"), token("bg")) >= 4.5, `contrast ${contrast(token("red"), token("bg")).toFixed(2)}`);
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

test("scripts load in the plan's order: effects-core, effects, site, portrait-3d, portrait", () => {
  const srcs = [...html.matchAll(/<script[^>]*src="([^"?]+)/g)].map(m => m[1]);
  assert.deepEqual(srcs, ["/effects-core.js", "/effects.js", "/site.js", "/portrait-3d.js", "/portrait.js"]);
});

// The inline <head> script, run against a stub page: it returns the classes on <html> and lets the test fire timers.
const headScript = (html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>[\s\S]*?<\/head>/) || [])[1];
function runHead({ reduce = false, seen = null, storageThrows = false } = {}) {
  const classes = new Set(), timers = [];
  const documentElement = {
    dataset: {},
    classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)) }
  };
  const sessionStorage = { getItem: k => { if (storageThrows) throw new Error("denied"); return k === LOADER_KEY ? seen : null; } };
  require("node:vm").runInNewContext(headScript, {
    document: { documentElement }, sessionStorage,
    matchMedia: q => ({ matches: reduce && q === "(prefers-reduced-motion: reduce)" }),
    setTimeout: (fn, ms) => timers.push({ fn, ms })
  });
  return { classes, timers, documentElement };
}
const LOADER_KEY = "loader-seen";

test("the head script runs before the stylesheet loads", () => {
  assert.ok(headScript, "an inline script in <head>");
  assert.ok(html.indexOf(headScript) < html.indexOf('href="/styles.css?v='));
});

test("the head script adds motion and intro on a first visit", () => {
  assert.deepEqual([...runHead().classes].sort(), ["intro", "motion"]);
});

test("the head script skips the loader once the tab has seen it", () => {
  assert.deepEqual([...runHead({ seen: "1" }).classes], ["motion"]);
});

test("the head script runs the loader when session storage throws", () => {
  assert.deepEqual([...runHead({ storageThrows: true }).classes].sort(), ["intro", "motion"]);
});

test("the head script adds nothing under reduced motion", () => {
  assert.equal(runHead({ reduce: true }).classes.size, 0);
});

test("the head script's 4s failsafe removes motion and intro when effects.js has not taken over", () => {
  const { classes, timers } = runHead();
  const failsafe = timers.find(t => t.ms === 4000);
  assert.ok(failsafe, "a 4000ms timer");
  failsafe.fn();
  assert.equal(classes.size, 0);
});

test("the head script's failsafe leaves the classes once effects.js has taken over", () => {
  const { classes, timers, documentElement } = runHead();
  documentElement.dataset.fx = "on";
  timers.find(t => t.ms === 4000).fn();
  assert.deepEqual([...classes].sort(), ["intro", "motion"]);
});

test("effects.js writes the same loader flag the head script reads", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/effects.js"), "utf8");
  assert.match(headScript, new RegExp(`sessionStorage\\.getItem\\("${LOADER_KEY}"\\)`));
  assert.match(js, new RegExp(`LOADER_KEY = "${LOADER_KEY}"`));
  assert.match(js, /sessionStorage\.setItem\(LOADER_KEY, /);
});

test("the old home-only rules are gone from the stylesheet", () => {
  for (const sel of [".col", ".statement", ".facts", ".sec", ".num", ".item", ".lead", ".meta", ".work-grid",
    ".writing", ".rt", ".mail", ".contact-lead", ".contact-alt", ".sec-title"]) {
    const re = new RegExp(`(^|[\\s,}])${sel.replace(".", "\\.")}(?![\\w-])[^{}]*\\{`, "m");
    assert.doesNotMatch(css, re, sel);
  }
});

test("header and footer links are at least 44px tall on touch screens", () => {
  const block = css.match(/@media \(pointer: coarse\) \{([\s\S]*?)\n\}/);
  assert.ok(block, "a (pointer: coarse) block");
  for (const sel of [".home-page .hp-head a", ".home-page .hp-foot a"]) {
    const rule = [...block[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .find(([, s]) => s.split(",").map(x => x.trim()).includes(sel));
    assert.ok(rule, sel);
    const min = rule[2].match(/min-height:\s*(\d+)px/);
    assert.ok(min && Number(min[1]) >= 44, `${sel} min-height`);
  }
});

test("the writing label and its rss link share a centre line on touch screens", () => {
  const block = css.match(/@media \(pointer: coarse\) \{([\s\S]*?)\n\}/);
  assert.match(block[1], /\.home-page \.hp-sec-aside \{ align-items: center; \}/);
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

// The body of the one top-level rule for `sel`.
const cssRule = sel => {
  const m = css.match(new RegExp("\\n" + sel.replace(/\./g, "\\.") + " \\{([^}]*)\\}"));
  assert.ok(m, sel);
  return m[1];
};

// Spec AC 9: the number's box comes from the layout, never from its digits, so neither it nor the bar moves as
// the count changes. Wide, it keeps the room of the widest count ("000" is 1.85em of Newsreader) with its digits
// at the right; below 415px, where "100" did not fit beside the bar, it always has a line of its own.
test("the loader number's box does not change with its digits (spec AC 9)", () => {
  assert.doesNotMatch(cssRule(".home-page .hp-loader-foot"), /flex-wrap/);
  assert.match(cssRule(".home-page .hp-loader-num"), /flex: 0 1 1\.86em; min-width: 0; display: flex; justify-content: flex-end;/);
  const block = css.match(/@media \(max-width: 414px\) \{([^@]*?)\n\}/);
  assert.ok(block, "a max-width: 414px block");
  assert.match(block[1], /\.home-page \.hp-loader-foot \{ flex-wrap: wrap; \}/);
  assert.match(block[1], /\.home-page \.hp-loader-num \{ flex-basis: 100%; justify-content: flex-start; \}/);
});

// Spec AC 9: the first tick fills in eight mono characters (HH:MM:SS), so they have their room before it.
test("the header clock keeps room for HH:MM:SS before its first tick", () => {
  assert.match(cssRule(".home-page .hp-clock-time"), /min-width: 8ch;/);
});

test("reveal on scroll waits until 12% of the element is in view, as playOnce does", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/effects.js"), "utf8");
  const reveal = js.slice(js.indexOf("function setupReveal"), js.indexOf("function setupLitText"));
  assert.match(reveal, /core\.inView\(e, \.12\)/);
});

// Spec decision 8: with the loader, a visitor arriving at /#work sees the count-up, the runs grids and the reveals.
test("the one-shot effects start when the loader closes, or at setup without a loader", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/effects.js"), "utf8");
  const oneShots = (js.match(/const oneShots = \(\) => \{([^}]*)\}/) || [])[1] || "";
  for (const fn of ["setupReveal()", "setupCount()", "setupRuns()"]) assert.ok(oneShots.includes(fn), fn);
  const close = (js.match(/const close = \(\) => \{([\s\S]*?)\n    \};/) || [])[1] || "";
  assert.match(close, /onClose\(\)/);
  const setup = js.slice(js.indexOf("if (motion()) {"), js.indexOf('root.dataset.fx = "on"')).replace(/const oneShots = .*\n/, "");
  assert.doesNotMatch(setup, /setupReveal\(\)|setupCount\(\)|setupRuns\(\)/);
  assert.match(setup, /setupLoader\(oneShots\); else \{ oneShots\(\); intro\(\); \}/);
});

test("the portrait reads its colour from --ink, so the --fg alias is gone", () => {
  assert.doesNotMatch(css, /--fg\b/);
});

test("the portrait draws in the --mono font (Geist Mono) and runs in the page loop", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/portrait.js"), "utf8");
  assert.doesNotMatch(js, /Fragment Mono/);
  assert.doesNotMatch(js, /requestAnimationFrame/);
  assert.match(js, /getPropertyValue\("--mono"\)/);
  assert.match(js, /SiteLoop\.whileVisible\(face,/);
});

// Spec AC 10: the face's grids are their own asset, fetched after the first paint, not inlined in the script.
test("portrait-data.json holds the 320x393 brightness grid and the 160x197 depth grid", () => {
  const { lum, depth } = require("../public/portrait-data.json");
  assert.deepEqual([lum.w, lum.h, depth.w, depth.h, depth.scale], [320, 393, 160, 197, 2]);
  assert.equal(Buffer.from(lum.b64, "base64").length, 125760);
  assert.equal(Buffer.from(depth.b64, "base64").length, 31520);
});

// The depth grid's base64 string is ~42 KB; once decoded, the script should not keep it alive.
test("portrait.js keeps only the decoded depth grid and its sizes", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/portrait.js"), "utf8");
  assert.match(js, /DEPTH = \{ w: depth\.w, h: depth\.h, scale: depth\.scale, data: d \}/);
});

test("portrait.js holds no data and is under 22,000 bytes", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/portrait.js"), "utf8");
  assert.doesNotMatch(js, /atob\(/);
  assert.doesNotMatch(js, /[A-Za-z0-9+/]{200}/, "a base64 run");
  assert.ok(Buffer.byteLength(js) < 22000, Buffer.byteLength(js) + " bytes");
  assert.match(js, /fetch\(face\.dataset\.src\)/);
});

// The source of one top-level portrait.js function, from its declaration to the closing brace at its indent.
const portraitFn = (js, name) => {
  const m = js.match(new RegExp("\\n( *)function " + name + "\\([\\s\\S]*?\\n\\1\\}"));
  assert.ok(m, "function " + name);
  return m[0];
};

test("the portrait's frame functions read no layout (spec AC 5)", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/portrait.js"), "utf8");
  for (const name of ["drawFace", "step", "update3d"]) {
    assert.doesNotMatch(portraitFn(js, name), /getBoundingClientRect|getClientRects|scroll[XY]\b|inner(Width|Height)|client(Width|Height)|scrollHeight/, name);
  }
});

test("the portrait measures the headline lines in the loop's read phase while the reveal runs", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/portrait.js"), "utf8");
  assert.match(js, /SiteLoop\.addRead\(/);
  assert.match(js, /SiteLoop\.removeRead\(/);
  assert.match(js, /"transitionrun"/);
});

test("the portrait starts after the first paint", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/portrait.js"), "utf8");
  assert.match(js, /const core = window\.EffectsCore;/);
  assert.match(js, /core\.afterPaint\(fn, window\)/);
});

test("under reduced motion the face is drawn once, not again on every scroll", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/portrait.js"), "utf8");
  assert.doesNotMatch(js, /if \(still\) window\.addEventListener\("scroll"/);
});

// Without effects.js the head script drops html.motion after 4s and the headline lines jump into place.
test("without the page loop the portrait measures the headline again once html.motion is dropped", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/portrait.js"), "utf8");
  assert.match(js, /if \(still && root\.classList\.contains\("motion"\)\) new MutationObserver\(/);
  assert.match(js, /\.observe\(root, \{ attributeFilter: \["class"\] \}\)/);
});

test("window.SiteLoop exposes the loop's read phase", () => {
  const js = fs.readFileSync(path.join(__dirname, "../public/effects.js"), "utf8");
  assert.match(js, /addRead: loop\.addRead,/);
  assert.match(js, /removeRead: loop\.removeRead,/);
});

test("on desktop the hero sentence stops before the face, which starts at 54% of the width", () => {
  const block = css.match(/@media \(min-width: 760px\) \{([^@]*?)\n\}/);
  assert.ok(block, "a min-width: 760px block");
  assert.match(block[1], /\.home-page \.hp-h1-sub \{ max-width: min\(24em, calc\(51vw - var\(--home-gutter-l\)\)\); \}/);
});

// The padding mirrors portraitLayout's phone box: 64px down, at most 90% of the width over the grid's 320/393 aspect.
test("on phones the hero text starts below the face box", () => {
  const block = css.match(/@media \(max-width: 759px\) \{([^@]*?)\n\}/);
  assert.ok(block, "a max-width: 759px block");
  assert.match(block[1], /\.home-page \.hero \{ padding-top: calc\(64px \+ 90vw \* 393 \/ 320 \+ 16px\); \}/);
});

test("the meta and og descriptions repeat the hero headline and subline", () => {
  const hero = "Designer turned developer. Senior web developer with a designer's eye. I build for the web, and lately " +
    "with AI agents, testing what actually makes them reliable.";
  assert.ok(html.includes(`<meta name="description" content="${hero}">`), "meta description");
  assert.ok(html.includes(`<meta property="og:description" content="${hero}">`), "og:description");
});

// Spec AC 7: no script holds up the parser; the head preloader is the one inline script (JSON-LD aside).
test("every script with a src is deferred and the only other script is the home page's head preloader", () => {
  const { htmlFiles } = require("../tools/asset-versions.js");
  const root = path.join(__dirname, "../public");
  for (const page of htmlFiles(root)) {
    const name = path.relative(root, page), inline = [];
    for (const [, attrs, body] of fs.readFileSync(page, "utf8").matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/\ssrc=/.test(attrs)) assert.match(attrs, /\sdefer\b/, name + ": <script" + attrs + ">");
      else if (!/type="application\/ld\+json"/.test(attrs)) inline.push(body);
    }
    assert.deepEqual(inline, name === "index.html" ? [headScript] : [], name);
  }
});

const effectsJs = fs.readFileSync(path.join(__dirname, "../public/effects.js"), "utf8");
// The source of one top-level effects.js setup function, from its declaration to the closing brace at its indent.
const effectsFn = name => {
  const m = effectsJs.match(new RegExp("\\n( *)function " + name + "\\([\\s\\S]*?\\n\\1\\}"));
  assert.ok(m, "function " + name);
  return m[0];
};

// Spec AC 2: the loader, intro and one-shots keep their timing; the rest waits until the page has painted.
test("effects.js sets up the clock, cursor, preview panel and hover scramble after the first paint", () => {
  const setup = effectsJs.slice(effectsJs.indexOf("window.SiteEffects = { scramble };"), effectsJs.indexOf('root.dataset.fx = "on"'));
  for (const fn of ["setupClock", "setupCursor", "setupPreview", "setupScramble"]) {
    assert.doesNotMatch(setup, new RegExp(fn + "\\(\\)"), fn + " called directly");
    assert.match(setup, new RegExp("core\\.afterPaint\\([^\\n]*\\b" + fn + "\\b"), fn);
  }
  assert.match(effectsJs, /\n    root\.dataset\.fx = "on";/);
});

// Spec AC 3: the clock stops while the tab is hidden and catches up at once when it returns. tickWhileShown does
// that (tests/effects-core.test.js); the clock runs only through it.
test("the header clock stops while the tab is hidden and ticks at once when it is shown again", () => {
  const clock = effectsFn("setupClock");
  assert.match(clock, /core\.tickWhileShown\(tick, 1000, document, window\);/);
  assert.doesNotMatch(clock, /setInterval|visibilitychange/);
});

// Spec AC 6 (as amended): under reduced motion the cursor and the panel follow the pointer from its own events.
test("without motion the cursor and the preview panel never run in the frame loop", () => {
  for (const name of ["setupCursor", "setupPreview"]) {
    const adds = effectsFn(name).split("\n").filter(line => line.includes("loop.add("));
    assert.ok(adds.length, name);
    for (const line of adds) assert.match(line, /if \(motion\(\)\) loop\.add\(/, name + ": " + line.trim());
  }
});

// Spec AC 5: every frame callback in effects.js (each `const step`, and the strip's) takes sizes and the scroll
// position from variables kept by listeners, never from layout.
test("effects.js frame callbacks read no layout (spec AC 5)", () => {
  const frames = [...effectsJs.matchAll(/\n( *)const step = [^\n]*=> \{[\s\S]*?\n\1\};/g)].map(m => m[0]);
  const strip = effectsFn("setupStrip");
  frames.push(strip.slice(strip.indexOf("window.SiteLoop.whileVisible(")));
  assert.ok(frames.length >= 6, frames.length + " frame callbacks");
  for (const body of frames) {
    assert.doesNotMatch(body, /getBoundingClientRect|getClientRects|scroll[XY]\b|inner(Width|Height)|client(Width|Height)|scroll(Height|Width)/, body);
  }
});

test("the lit text measures its place on start, on resize and once the fonts have loaded", () => {
  const lit = effectsFn("setupLitText");
  assert.match(lit, /window\.addEventListener\("scroll", [^\n]*\{ passive: true \}\)/);
  assert.match(lit, /window\.addEventListener\("resize", measure\)/);
  assert.match(lit, /document\.fonts\.ready\.then\(measure\)/);
});
