// The maths behind a post's contents column: which section the reader is in, how far through the post they are,
// the hash bar and the minutes left. contents.js does the DOM work and calls these; it is also a CommonJS module
// so `node --test` can check it.
(function (root) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Index of the last heading whose top (from the top of the viewport) is at or above `line`; -1 before the first.
  // Once the page can scroll no further (`atEnd`) it is the last heading, which a short last section on a tall
  // screen never brings up to the line, unless the reader jumped to a heading (`jumped`, its index) that is still on
  // screen: a jump to a late section can stop at the page's end too.
  function currentHeading(tops, line, atEnd, jumped) {
    if (atEnd && tops.length) return jumped >= 0 && jumped < tops.length && tops[jumped] >= 0 ? jumped : tops.length - 1;
    let current = -1;
    tops.forEach((top, i) => { if (top <= line) current = i; });
    return current;
  }

  // The share of the post above the reading line `line`, where currentHeading picks the section, so the bar and the
  // lit section agree; 1 once the page can scroll no further (`atEnd`), which a short post or a tall screen reaches
  // before the post's bottom gets to the line. `top` and `height` are the post's bounding box.
  function readingProgress(top, height, line, atEnd) {
    return atEnd ? 1 : clamp((line - top) / height, 0, 1);
  }

  // The bar's read and unread hashes: `cells` in all, the read share rounded to whole cells.
  function readingBar(progress, cells) {
    const on = Math.round(clamp(progress, 0, 1) * cells);
    return { on: "#".repeat(on), off: "#".repeat(cells - on) };
  }

  // Minutes still to read of a post that takes `total` minutes, rounded up.
  function minutesLeft(progress, total) {
    const left = Math.ceil(total * (1 - clamp(progress, 0, 1)));
    return left > 0 ? left + " min left" : "read to the end";
  }

  // Whether the page can scroll no further; 2px of slack for fractional scroll positions.
  function atPageEnd(scrollY, viewport, scrollHeight) {
    return scrollY + viewport >= scrollHeight - 2;
  }

  // The jump to remember after a scroll: a jump that stopped at the page's end is done once the page leaves the end.
  function keptJump(jumped, wasAtEnd, atEnd) {
    return wasAtEnd && !atEnd ? -1 : jumped;
  }

  const api = { currentHeading, atPageEnd, keptJump, readingProgress, readingBar, minutesLeft };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Contents = api;
})(this);
