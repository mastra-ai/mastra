// Apply the persisted or system theme before paint without requiring inline script execution.
(() => {
  try {
    const stored = localStorage.getItem('mastracode.theme');
    let resolved = 'dark';
    if (stored === 'dark' || stored === 'light') {
      resolved = stored;
    } else if (stored === 'system' && !window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      resolved = 'light';
    }
    document.documentElement.classList.add(resolved);
  } catch {
    document.documentElement.classList.add('dark');
  }
})();
