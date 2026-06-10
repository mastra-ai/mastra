import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './src/test/msw-server';

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

// jsdom does not implement Element.prototype.getAnimations, which @base-ui/react's
// ScrollAreaViewport iterates over inside a deferred timer.
if (typeof globalThis.Element !== 'undefined' && !Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => [];
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

// jsdom does not implement ResizeObserver, which assistant-ui's thread
// primitives observe during render.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
