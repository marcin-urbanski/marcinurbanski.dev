const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { htmlFiles } = require("../tools/asset-versions.js");

const root = path.join(__dirname, "../public");
const posts = htmlFiles(path.join(root, "writing")).map(file => {
  const html = fs.readFileSync(file, "utf8");
  const article = html.slice(html.indexOf("<article"), html.indexOf("</article>"));
  return {
    name: path.relative(root, file),
    href: "/" + path.relative(root, path.dirname(file)) + "/",
    html,
    article,
    title: article.match(/<h1>([^<]*)<\/h1>/)[1],
    date: article.match(/<time datetime="([^"]+)">([^<]+)<\/time>/),
    minutes: Number(article.match(/<span>(\d+) min<\/span><\/p>/)[1])
  };
});
const text = html => html.replace(/<[^>]+>/g, " ");
const words = html => text(html).split(/\s+/).filter(Boolean).length;
const headings = article => [...article.matchAll(/<h([23])( id="([^"]*)")?>([^<]*)<\/h\1>/g)]
  .map(m => ({ level: Number(m[1]), id: m[3], title: m[4], index: m.index }));
const toc = article => {
  const nav = article.match(/<nav class="post-toc" aria-label="Contents">[\s\S]*?<\/nav>/);
  assert.ok(nav, "a contents nav in the article");
  return nav[0];
};

test("there are posts to check", () => {
  assert.ok(posts.length >= 3);
});

test("every section and subsection heading in a post has a unique id", () => {
  for (const { name, article } of posts) {
    const ids = headings(article).map(h => h.id);
    assert.ok(ids.length > 0, name);
    for (const id of ids) assert.match(id || "", /^[a-z0-9]+(-[a-z0-9]+)*$/, name);
    assert.equal(new Set(ids).size, ids.length, name);
  }
});

test("each post's contents link to every heading in order, # for a section and ## for a subsection", () => {
  for (const { name, article } of posts) {
    const links = [...toc(article).matchAll(/<a href="#([^"]+)"><span class="hx" aria-hidden="true">(#+)<\/span><span>([^<]*)<\/span>/g)]
      .map(m => ({ id: m[1], level: m[2].length + 1, title: m[3] }));
    assert.deepEqual(links, headings(article).map(({ id, level, title }) => ({ id, level, title })), name);
  }
});

test("the contents sit right after the summary, in a details element that starts closed", () => {
  for (const { name, article } of posts) {
    assert.match(article, /<p class="dek">[\s\S]*?<\/p>\s*<nav class="post-toc" aria-label="Contents">\s*<details>\s*<summary>/, name);
  }
});

test("the contents summary counts the sections and gives the post's reading time", () => {
  for (const { name, article, minutes } of posts) {
    const sections = headings(article).filter(h => h.level === 2).length;
    assert.match(toc(article), new RegExp(`<summary>contents <span>· ${sections} sections · ${minutes} min</span></summary>`), name);
  }
});

// Where each section starts in the read: the words of the article before its heading at 230 a minute, leaving out
// figures and the contents list itself.
test("each section shows the minute it starts at, from the words before it at 230 a minute", () => {
  const at = n => { const s = Math.round(n / 230 * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  for (const { name, article } of posts) {
    const body = article.replace(/<figure[\s\S]*?<\/figure>/g, "").replace(/<nav class="post-toc"[\s\S]*?<\/nav>/, "");
    const expected = headings(body).filter(h => h.level === 2).map(h => [h.id, at(words(body.slice(0, h.index)))]);
    const shown = [...toc(article).matchAll(/<a href="#([^"]+)">(?:(?!<\/a>)[\s\S])*?<span class="ts">([^<]*)<\/span><\/a>/g)].map(m => [m[1], m[2]]);
    assert.deepEqual(shown, expected, name);
  }
});

test("every post ends with the other posts, newest first, and a link to all writing", () => {
  const byDate = [...posts].sort((a, b) => b.date[1].localeCompare(a.date[1]));
  for (const post of posts) {
    const main = post.html.slice(post.html.indexOf("</article>"), post.html.indexOf("</main>"));
    const section = main.match(/<section class="more-writing" aria-labelledby="more-writing">[\s\S]*?<\/section>/);
    assert.ok(section, post.name);
    assert.match(section[0], /<h2 class="hp-label" id="more-writing">\(more writing\)<\/h2>/, post.name);
    assert.match(section[0], /<a href="\/#writing">all writing →<\/a>/, post.name);
    const rows = [...section[0].matchAll(/<a class="hp-row hp-post" data-plain href="([^"]+)">\s*<time datetime="([^"]+)">([^<]+)<\/time>\s*<h3 class="hp-post-title">([^<]*)<\/h3>\s*<span class="hp-row-meta"><span>(\d+) min<\/span><span>→<\/span><\/span>\s*<\/a>/g)]
      .map(m => [m[1], m[2], m[3], m[4], Number(m[5])]);
    const others = byDate.filter(p => p !== post).map(p => [p.href, p.date[1], p.date[2], p.title, p.minutes]);
    assert.deepEqual(rows, others, post.name);
  }
});

test("every post loads the contents scripts, maths first, both deferred", () => {
  for (const { name, html } of posts) {
    assert.match(html, /<script src="\/contents-core\.js\?v=[0-9a-f]{8}" defer><\/script>\s*<script src="\/contents\.js\?v=[0-9a-f]{8}" defer><\/script>\s*<\/head>/, name);
  }
});
