(() => {
  const btn = document.getElementById("copy"), mail = document.getElementById("mail");
  btn.addEventListener("click", () => {
    const done = () => { btn.textContent = "copied"; setTimeout(() => { btn.textContent = "copy address"; }, 1600); };
    const select = () => { const r = document.createRange(); r.selectNodeContents(mail); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); };
    try { navigator.clipboard.writeText(mail.textContent).then(done, select); } catch (e) { select(); }
  });
})();
