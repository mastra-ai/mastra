import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Shared MSW server for the jsdom web-ui test suite. The global setup
 * (`vitest.setup.ts`) starts it with `onUnhandledRequest: 'error'` so any
 * request that isn't explicitly stubbed fails the test loudly. Register
 * per-test handlers with `server.use(...)`.
 *
 * `/auth/me` has a default handler because the auth state is ambient (read by
 * the user-sessions plumbing wherever the provider stack renders). Auth is
 * reported disabled by default; tests that exercise authenticated flows
 * override it with `server.use(...)`.
 */
export const server = setupServer(
  http.get('*/auth/me', () => HttpResponse.json(null, { status: 404 })),
  // Ambient model catalog for settings pickers; tests with model-specific
  // assertions override it with `server.use(...)`.
  http.get('*/web/config/models', () => HttpResponse.json({ models: [] })),
  // Ambient provider catalog (read by the NewPage credential guard wherever
  // it renders); credential-specific tests override it with `server.use(...)`.
  http.get('*/web/config/providers', () => HttpResponse.json({ providers: [] })),
  // Ambient Jira feature status (read wherever the intake surface renders).
  // 404 mirrors a deployment without the JIRA_* env group — routes not
  // mounted, the service degrades to disabled. Jira tests override it.
  http.get('*/web/jira/status', () => HttpResponse.json(null, { status: 404 })),
  http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [] })),
  http.get('*/web/factory/projects/:id/source-control-connections', () => HttpResponse.json({ connections: [] })),
  http.get('*/web/github/projects/:projectRepositoryId/worktrees', () => HttpResponse.json({ worktrees: [] })),
);
