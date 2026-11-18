/**
 * Studio's infinite lists watch an end-of-list sentinel with the implicit root, which in an iframe is the
 * host's top-level viewport clipped by every ancestor frame. A host that clips the app or scrolls it partly
 * off-screen then hides the sentinel for good and the list stops paging. Rooting those observers at the
 * app's own document measures against the iframe's viewport, which is what the lists mean by "in view".
 */
export function rootObserversAtFrame(): void {
  const Native = window.IntersectionObserver;
  if (!Native || window.top === window) return;

  window.IntersectionObserver = class extends Native {
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      super(callback, { ...options, root: options.root ?? document });
    }
  };
}
