import { flushSync } from 'react-dom';

// flushSync required — the transition captures the DOM synchronously after the callback
export function morph(update: () => void): void {
  const view = document as Document & {
    startViewTransition?: (callback: () => void) => { ready: Promise<void> };
  };
  if (typeof view.startViewTransition !== 'function') {
    update();
    return;
  }
  // hidden tab or overlapping transition rejects `ready` — DOM update still lands
  view.startViewTransition(() => flushSync(update)).ready.catch(() => {});
}
