/**
 * A controllable stand-in for the browser's IntersectionObserver.
 *
 * `vitest.setup.ts` installs an inert stub (jsdom has no implementation), which
 * means `useInView` can never report an element as visible — so the "load the
 * next page when the sentinel scrolls into view" wiring is unreachable from a
 * spec. Installing this stub lets a test say *when* the sentinel becomes
 * visible, while the real `useInView` and the real effect still run.
 */
export const installIntersectionObserver = () => {
  const original = globalThis.IntersectionObserver;
  const observers: Array<{ callback: IntersectionObserverCallback; targets: Element[] }> = [];

  class ControllableIntersectionObserver {
    private entry: { callback: IntersectionObserverCallback; targets: Element[] };

    constructor(callback: IntersectionObserverCallback) {
      this.entry = { callback, targets: [] };
      observers.push(this.entry);
    }

    observe(target: Element) {
      this.entry.targets.push(target);
    }

    unobserve() {}
    disconnect() {
      const index = observers.indexOf(this.entry);
      if (index >= 0) observers.splice(index, 1);
    }
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  }

  globalThis.IntersectionObserver = ControllableIntersectionObserver as unknown as typeof IntersectionObserver;

  return {
    /** Reports every observed element as entering (or leaving) the viewport. */
    setIntersecting(isIntersecting: boolean) {
      for (const { callback, targets } of [...observers]) {
        callback(
          targets.map(target => ({ isIntersecting, target }) as IntersectionObserverEntry),
          {} as IntersectionObserver,
        );
      }
    },
    observedCount: () => observers.reduce((total, entry) => total + entry.targets.length, 0),
    restore() {
      globalThis.IntersectionObserver = original;
      observers.length = 0;
    },
  };
};
