// Helpers shared by the test files. Not a test file itself: node --test tests/ runs only *.test.js.
const assert = require("node:assert/strict");

// The source of one top-level function in `js`, from its declaration to the closing brace at its indent.
const fnSource = (js, name) => {
  const m = js.match(new RegExp("\\n( *)function " + name + "\\([\\s\\S]*?\\n\\1\\}"));
  assert.ok(m, "function " + name);
  return m[0];
};

// Spec AC 19: structured data, read from the page's one JSON-LD script, which sits in <head>.
const jsonLd = html => {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, "one JSON-LD script");
  assert.ok(html.indexOf(blocks[0][0]) < html.indexOf("</head>"), "JSON-LD in <head>");
  return JSON.parse(blocks[0][1]);
};

module.exports = { fnSource, jsonLd };
