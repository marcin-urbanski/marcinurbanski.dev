const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "../public/styles.css"), "utf8");

test("the post meta line is a small label, not paragraph-sized", () => {
  // The meta line is a <p>, so a bare .post-meta rule loses to .post p (18px); it needs .post .post-meta.
  const rule = css.match(/^\.post \.post-meta \{([^}]*)\}/m);
  assert.ok(rule, "expected a .post .post-meta rule");
  assert.match(rule[1], /font: 400 12px\/1\.6 var\(--mono\)/);
});
