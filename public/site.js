// The contact "copy address" button (README section 7). It copies the constant address, never #mail's text,
// which may be mid-scramble. Its label scrambles to "copied to clipboard" and back after 2s through
// window.SiteEffects.scramble (effects.js), or swaps at once without it or without motion; only the final text
// is announced, from a visually hidden live region. If the clipboard refuses, it selects a visually hidden copy
// of the address and the label says to press Cmd/Ctrl+C, then turns back after 2s (spec decision 9). Works
// without effects.js.
(() => {
  const ADDRESS = "hello@marcinurbanski.dev", LABEL = "copy address", COPIED = "copied to clipboard";
  const mac = /Mac/.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "");
  const HINT = "press " + (mac ? "⌘C" : "Ctrl+C") + " to copy";
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
  const show = text => {
    label(text);
    status.textContent = text;
    clearTimeout(revert);
    revert = setTimeout(() => { label(LABEL); status.textContent = ""; }, 2000);
  };
  const select = () => {
    const range = document.createRange();
    range.selectNodeContents(address);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    show(HINT);
  };
  btn.addEventListener("click", () => {
    try { navigator.clipboard.writeText(ADDRESS).then(() => show(COPIED), select); } catch (e) { select(); }
  });
})();
