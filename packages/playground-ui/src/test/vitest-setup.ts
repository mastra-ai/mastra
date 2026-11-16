import type {} from 'vitest/jsdom';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from './msw-server';

// Unmounting leaves library work queued: recharts' store notifies on the next animation frame with a
// 100ms setTimeout fallback, and @hello-pangea/dnd removes its announcer in a setTimeout(0). jsdom is
// torn down right after the last hook, so on a loaded CI worker those callbacks run against a missing
// `cancelAnimationFrame`/`document` and fail the shard with an unhandled error. Drain them first: the
// next jsdom frame runs every rAF callback queued before it, or, if a test left jsdom's frame clock
// stalled, a 100ms timer queued after recharts' own fallback fires after it. A zero-delay timer turn
// then runs the setTimeout(0) callbacks queued before it.
afterAll(async () => {
  if (typeof jsdom === 'undefined') return;
  vi.useRealTimers();
  let frameFallback: ReturnType<typeof setTimeout> | undefined;
  await new Promise(resolve => {
    jsdom.window.requestAnimationFrame(resolve);
    frameFallback = setTimeout(resolve, 100);
  });
  clearTimeout(frameFallback);
  await new Promise(resolve => setTimeout(resolve));
});

// MSW tests await several network round-trips; under a loaded parallel run the 1s
// default for findBy/waitFor is regularly exceeded and tests fail at random.
configure({ asyncUtilTimeout: 3000 });

// Lets manual `act(...)` calls work outside @testing-library/react's helpers.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
