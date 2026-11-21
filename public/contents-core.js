// The maths behind a post's contents column: which section the reader is in, how far through the post they are,
// the hash bar and the minutes left. contents.js does the DOM work and calls these; it is also a CommonJS module
// so `node --test` can check it.
(function (root) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Index of the last heading whose top (from the top of the viewport) is at or above `line`; -1 before the first.
  // Once the page can scroll no further (`atEnd`) it is the last heading, which a short last section on a tall
  // screen never brings up to the line.
  function currentHeading(tops, line, atEnd) {
    if (atEnd && tops.length) return tops.length - 1;
    let current = -1;
    tops.forEach((top, i) => { if (top <= line) current = i; });
    return current;
  }

  // 0 while the post's top is below the top of the viewport, 1 once its bottom is in view.
  // `top` and `height` are the post's bounding box, `viewport` the window's height.
  function readingProgress(top, height, viewport) {
    const span = height - viewport;
    return span <= 0 ? 1 : clamp(-top / span, 0, 1);
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

  const api = { currentHeading, readingProgress, readingBar, minutesLeft };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Contents = api;
})(this);
