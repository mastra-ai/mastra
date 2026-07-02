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
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

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

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
