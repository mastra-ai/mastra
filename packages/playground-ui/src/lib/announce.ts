let region: HTMLElement | undefined;
let pending: ReturnType<typeof setTimeout> | undefined;

/**
 * Reads `message` out to screen readers without showing it. For feedback that has no place in the page to live in, or
 * that shows as an icon. One region serves the whole app: `aria-live` is what keeps it readable while a modal hides
 * everything else from assistive technology.
 */
export function announce(message: string): void {
  if (typeof document === 'undefined') return;

  if (!region?.isConnected) {
    region = document.createElement('div');
    region.setAttribute('aria-live', 'polite');
    region.dataset.slot = 'announcer';
    region.className = 'sr-only';
    document.body.append(region);
  }

  // Emptied first, so the same message twice is still two changes. The wait lets a region that was just added be
  // noticed before its text changes.
  const target = region;
  target.textContent = '';
  clearTimeout(pending);
  pending = setTimeout(() => {
    target.textContent = message;
    pending = setTimeout(() => {
      target.textContent = '';
    }, 5000);
  }, 100);
}
