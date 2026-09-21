import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './msw-server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom does not implement Range.prototype.getClientRects, which CodeMirror's
// measure cycle calls asynchronously after mount. Without this stub the
// resulting TypeError can land inside an unrelated test and fail it.
if (typeof globalThis.Range !== 'undefined' && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => {
    const rects = [] as unknown as DOMRectList;
    (rects as unknown as { item: (index: number) => DOMRect | null }).item = () => null;
    return rects;
  };
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}
