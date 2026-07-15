import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Shared MSW server for the jsdom web-ui test suite. The global setup
 * (`vitest.setup.ts`) starts it with `onUnhandledRequest: 'error'` so any
 * request that isn't explicitly stubbed fails the test loudly. Register
 * per-test handlers with `server.use(...)`.
 *
 * `/auth/me` has a default handler because the auth state is ambient (read by
 * the user-sessions plumbing wherever the provider stack renders): auth is
 * reported disabled — the local-dev default — so user sessions fall back to
 * the fixed local resourceId. Tests that exercise authenticated flows override
 * it with `server.use(...)`.
 */
export const server = setupServer(http.get('*/auth/me', () => HttpResponse.json(null, { status: 404 })));
