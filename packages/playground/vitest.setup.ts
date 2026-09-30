import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from './src/test/msw-server';

vi.mock('@mastra/playground-ui/components/ScrollArea', () => import('@/test/mock-scroll-area'));

// React reads this global to decide whether `act(...)` is supported. Vitest's
// jsdom environment does not set it, so manual `act(...)` calls (outside of
// @testing-library/react's own render helpers) throw "The current testing
// environment is not configured to support act(...)". Setting it here once,
// for every test file, makes the act environment explicit and consistent.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Polyfill matchMedia for jsdom test environment
// playground-store eagerly calls window.matchMedia during module init
if (typeof globalThis.window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom does not implement Element.prototype.scrollTo
if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

// jsdom does not implement Element.prototype.getAnimations, used by Radix UI
// primitives (e.g. Switch) when reconciling presence/animation state, and by
// @base-ui/react's ScrollAreaViewport inside a deferred timer.
if (typeof globalThis.Element !== 'undefined' && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
}

// jsdom does not implement IntersectionObserver, used by useInView (e.g. infinite lists)
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

// jsdom does not implement Range.prototype.getClientRects, which CodeMirror's
// measure cycle calls asynchronously after mount. Depending on scheduling the
// resulting TypeError can land inside an unrelated test and fail it.
if (typeof globalThis.Range !== 'undefined' && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => {
    const rects = [] as unknown as DOMRectList;
    (rects as unknown as { item: (index: number) => DOMRect | null }).item = () => null;
    return rects;
  };
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

// jsdom does not implement ResizeObserver, used by @xyflow/react when rendering the
// workflow graph and by assistant-ui's thread primitives during render.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
