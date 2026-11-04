const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/site.js"), "utf8");
const ADDRESS = "hello@marcinurbanski.dev";

// Runs site.js against just enough of a page: the copy button, the email link (mid-scramble), a clipboard that
// accepts or refuses, timers run by hand and an optional window.SiteEffects.
function page({ clipboard = "ok", effects = false, motion = true } = {}) {
  const added = [], copied = [], scrambles = [], timers = [];
  let selected = null;
  const node = tag => ({ tagName: tag, textContent: "", className: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } });
  const btn = Object.assign(node("button"), {
    textContent: "copy address",
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    after(...nodes) { added.push(...nodes); }
  });
  const mail = Object.assign(node("a"), { textContent: "h!ll<_m#rcin" });
  const writeText = text => {
    copied.push(text);
    return clipboard === "ok" ? Promise.resolve() : Promise.reject(new Error("denied"));
  };
  const window = {
    document: {
      documentElement: { classList: { contains: c => c === "motion" && motion } },
      getElementById: id => ({ copy: btn, mail }[id] || null),
      createElement: node,
      createRange: () => ({ selectNodeContents(n) { this.node = n; } })
    },
    navigator: clipboard === "missing" ? {} : { clipboard: { writeText } },
    getSelection: () => ({ removeAllRanges() {}, addRange(r) { selected = r.node; } }),
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    clearTimeout: () => {}
  };
  if (effects) window.SiteEffects = { scramble: (el, to, ms) => { scrambles.push({ el, to, ms }); el.textContent = to; } };
  window.window = window;
  vm.runInNewContext(source, window);
  return {
    btn, added, copied, scrambles, timers,
    get selected() { return selected; },
    status: () => added.find(n => n.attrs.role === "status"),
    async click() { btn.listeners.click(); await new Promise(r => setImmediate(r)); }
  };
}

test("copy writes the constant address, not the email link's current text", async () => {
  const p = page();
  await p.click();
  assert.deepEqual(p.copied, [ADDRESS]);
});

test("copy confirms in the label and turns back after 2s", async () => {
  const p = page();
  await p.click();
  assert.equal(p.btn.textContent, "copied to clipboard");
  const revert = p.timers.find(t => t.ms === 2000);
  assert.ok(revert, "a 2s timer");
  revert.fn();
  assert.equal(p.btn.textContent, "copy address");
});

test("copy scrambles the label through SiteEffects when motion is on", async () => {
  const p = page({ effects: true });
  await p.click();
  assert.deepEqual(p.scrambles.map(s => [s.el, s.to]), [[p.btn, "copied to clipboard"]]);
  p.timers.find(t => t.ms === 2000).fn();
  assert.deepEqual(p.scrambles.map(s => s.to), ["copied to clipboard", "copy address"]);
});

test("copy swaps the label without scrambling when motion is off", async () => {
  const p = page({ effects: true, motion: false });
  await p.click();
  assert.equal(p.scrambles.length, 0);
  assert.equal(p.btn.textContent, "copied to clipboard");
});

test("copy announces only the final text from a visually hidden live region", async () => {
  const p = page({ effects: true });
  const status = p.status();
  assert.ok(status, "a role=status element next to the button");
  assert.equal(status.className, "hp-sr");
  assert.equal(status.textContent, "");
  await p.click();
  assert.equal(status.textContent, "copied to clipboard");
  p.timers.find(t => t.ms === 2000).fn();
  assert.equal(status.textContent, "");
});

test("when the clipboard refuses, copy selects a hidden element holding the constant address", async () => {
  const p = page({ clipboard: "refuse" });
  await p.click();
  assert.ok(p.selected, "something is selected");
  assert.equal(p.selected.textContent, ADDRESS);
  assert.equal(p.selected.className, "hp-sr");
  assert.equal(p.selected.attrs["aria-hidden"], "true");
  assert.equal(p.btn.textContent, "copy address");
});

test("without a clipboard API, copy selects the hidden address", async () => {
  const p = page({ clipboard: "missing" });
  await p.click();
  assert.equal(p.selected.textContent, ADDRESS);
});
