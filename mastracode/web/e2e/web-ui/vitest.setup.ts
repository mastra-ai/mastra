import * as matchers from '@testing-library/jest-dom/matchers';

import { cleanup } from '@testing-library/react';
import { expect, afterAll, afterEach, beforeAll } from 'vitest';

// Extend Vitest's `expect` with jest-dom matchers explicitly. We avoid the
// `@testing-library/jest-dom/vitest` auto-register entry because, under pnpm's
// nested store layout, that module re-imports `vitest` from its own install
// path and fails to resolve it.
expect.extend(matchers);

import { server } from './msw-server';

// Start MSW once for the whole suite. Unhandled requests are an error so a
// missing handler surfaces immediately instead of hanging or hitting a real
// network.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers + unmount React trees between tests so cases stay isolated.
// Between unmounting and resetting, drain the event loop so fire-and-forget
// requests kicked off during the test (e.g. `void session.setState(...)` from
// `useProjectSessionSync`) land against this test's handlers instead of
// surfacing as unhandled-request errors after the reset.
afterEach(async () => {
  cleanup();
  await new Promise(resolve => setTimeout(resolve, 0));
  server.resetHandlers();
});

afterAll(() => server.close());

if (!globalThis.localStorage) {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: key => store.get(key) ?? null,
    key: index => Array.from(store.keys())[index] ?? null,
    removeItem: key => store.delete(key),
    setItem: (key, value) => store.set(key, value),
  } as Storage;
}

// jsdom polyfills used by the settings UI.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    disconnect() {}
    observe(_target: Element) {}
    unobserve(_target: Element) {}
  };
}

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

if (!Element.prototype.getAnimations) {
  Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] });
}

// jsdom has no PointerEvent constructor; Base UI's Switch builds one on click.
if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? '';
    }
  } as unknown as typeof window.PointerEvent;
}
