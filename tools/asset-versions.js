// Adds ?v=<hash> to every local script, stylesheet and JSON data URL (src, href or data-src) in the HTML pages in
// public/; part of the deploy command in DEPLOY.md (tests/asset-versions.test.js fails while a page is out of
// date). The HTML is served with max-age=0 but the zone lets browsers keep its assets for 4 hours, so a new hash is
// what makes a returning visitor fetch the new file instead of pairing new HTML with an old script or data.
//
//     node tools/asset-versions.js
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// `hashOf(file)` gets the URL path without its leading slash, e.g. "styles.css".
const versionAssets = (html, hashOf) =>
  html.replace(/((?:src|href)="\/)([^"?]+\.(?:js|css|json))(?:\?v=[^"]*)?"/g, (_, attr, file) => `${attr}${file}?v=${hashOf(file)}"`);

const assetHash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 8);

const htmlFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? htmlFiles(p) : e.name.endsWith(".html") ? [p] : [];
});

if (require.main === module) {
  const root = path.join(__dirname, "../public");
  for (const page of htmlFiles(root)) {
    const html = fs.readFileSync(page, "utf8"), next = versionAssets(html, f => assetHash(path.join(root, f)));
    if (next !== html) { fs.writeFileSync(page, next); console.log("updated", path.relative(root, page)); }
  }
}

module.exports = { versionAssets, assetHash, htmlFiles };
