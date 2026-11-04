import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './msw-server';

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
