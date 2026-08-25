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
  // Experimental surfaces stay hidden unless a test explicitly enables them.
  http.get('*/web/config/features', () => HttpResponse.json({ knowledge: false })),
  // Ambient activity poll (sidebar running dots); activity tests override it with `server.use(...)`.
  http.get('*/api/agent-controller/:controllerId/active-runs', () => HttpResponse.json({ runs: [] })),
  http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [] })),
  http.get('*/web/factory/projects/:id/source-control-connections', () => HttpResponse.json({ connections: [] })),
  http.get('*/web/factory/projects/:id/audit', () => HttpResponse.json({ events: [], actors: {} })),
  http.get('*/web/factory/projects/:id/attention', () =>
    HttpResponse.json({
      items: [],
      openCount: 0,
      approvalCount: 0,
      badgeCount: 0,
      unreadCount: 0,
      hasMore: false,
      latestOccurrenceKey: null,
      latestOccurrenceAt: null,
      latestOccurrenceUnread: false,
    }),
  ),
  http.get('*/web/factory/projects/:id/decisions', () => HttpResponse.json({ decisions: [] })),
  http.get('*/web/factory/projects/:id/work-items', () => HttpResponse.json({ workItems: [] })),
  http.get('*/web/github/projects/:projectRepositoryId/worktrees', () => HttpResponse.json({ worktrees: [] })),
);
