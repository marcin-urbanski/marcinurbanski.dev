// The contact "copy address" button (README section 7). It copies the constant address, never #mail's text,
// which may be mid-scramble. Its label scrambles to "copied to clipboard" and back after 2s through
// window.SiteEffects.scramble (effects.js), or swaps at once without it or without motion; only the final text
// is announced, from a visually hidden live region. If the clipboard refuses, it selects a visually hidden copy
// of the address for Cmd/Ctrl+C. Works without effects.js.
(() => {
  const ADDRESS = "hello@marcinurbanski.dev", LABEL = "copy address", COPIED = "copied to clipboard";
  const btn = document.getElementById("copy");
  if (!btn) return;
  const hidden = text => {
    const node = document.createElement("span");
    node.className = "hp-sr";
    node.textContent = text;
    return node;
  };
  const address = hidden(ADDRESS), status = hidden("");
  address.setAttribute("aria-hidden", "true");
  status.setAttribute("role", "status");
  btn.after(status, address);

  const label = text => {
    const fx = window.SiteEffects;
    if (fx && document.documentElement.classList.contains("motion")) fx.scramble(btn, text, 500);
    else btn.textContent = text;
  };
  let revert = 0;
  const done = () => {
    label(COPIED);
    status.textContent = COPIED;
    clearTimeout(revert);
    revert = setTimeout(() => { label(LABEL); status.textContent = ""; }, 2000);
  };
  const select = () => {
    const range = document.createRange();
    range.selectNodeContents(address);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };
  btn.addEventListener("click", () => {
    try { navigator.clipboard.writeText(ADDRESS).then(done, select); } catch (e) { select(); }
  });
})();
