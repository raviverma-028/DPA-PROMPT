/** Accessible modal: focus moves in, is trapped, Esc closes, focus returns to the opener. */
export function createModal(root, closeBtn) {
  let opener = null;
  const focusables = () => [...root.querySelectorAll('button, [href], select, iframe, [tabindex]:not([tabindex="-1"])')];

  function onKey(e) {
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function open() {
    opener = document.activeElement;
    root.hidden = false;
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
  }
  function close() {
    root.hidden = true;
    document.removeEventListener('keydown', onKey);
    opener?.focus();
  }
  closeBtn.addEventListener('click', close);
  return { open, close };
}
