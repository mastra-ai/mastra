import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { builtinBoardCatalog } from './board-catalog';
import { boardReadHandlers } from './board-reads';

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
  http.get('*/web/status', () => HttpResponse.json({ problems: [] })),
  // Ambient activity poll (sidebar running dots); activity tests override it with `server.use(...)`.
  http.get('*/api/agent-controller/:controllerId/active-runs', () => HttpResponse.json({ runs: [] })),
  http.get('*/web/factory/projects/:id/boards', () => HttpResponse.json(builtinBoardCatalog)),
  // The sidebar and the board page read the intake routes to learn whether the caller may change
  // boards. The ambient caller is a member who may not; board tests override it with `server.use(...)`.
  http.get('*/web/factory/projects/:id/intake-routes', () => HttpResponse.json({ intakeRoutes: [], canEdit: false })),
  http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [] })),
  http.get('*/web/intake/bindings', () => HttpResponse.json({ bindings: [] })),
  // A server without the JIRA_* env group mounts no Jira routes; the ambient
  // 404 mirrors that and the Jira service degrades to a disabled status.
  // Jira-specific tests override these with `server.use(...)`.
  http.get('*/web/jira/status', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  http.get('*/web/jira/projects', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  // incident.io intake is optional; feature tests override this ambient 404.
  http.get('*/web/incidentio/status', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  // A server without Platform machine credentials mounts no platform connect
  // routes; the ambient 404 hides the provider sections. Provider connection
  // tests override these with `server.use(...)`.
  http.get('*/web/integrations/platform/:provider/connections', () =>
    HttpResponse.json({ error: 'not_found' }, { status: 404 }),
  ),
  // Board filters read connection status even when no provider is configured.
  http.get('*/web/github/status', () => HttpResponse.json({ enabled: false, connected: false, installations: [] })),
  // Ambient pull requests: Work and Review both list their linked repositories'
  // open pull requests. Pull-request tests override these with `server.use(...)`.
  http.get('*/web/github/projects/:id/prs', () => HttpResponse.json({ pullRequests: [], nextPage: null })),
  http.get('*/web/gitlab/projects/:id/prs', () => HttpResponse.json({ pullRequests: [], nextPage: null })),
  // GitLab intake is optional; feature tests override these ambient 404s.
  http.get('*/web/gitlab/status', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  http.get('*/web/gitlab/projects', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  http.get('*/web/factory/projects/:id/source-control-connections', () => HttpResponse.json({ connections: [] })),
  // Ambient sandbox environment variables (Manage Factory); variable tests override it with `server.use(...)`.
  http.get('*/web/factory/projects/:id/sandbox-envs', () => HttpResponse.json({ envs: [], writable: true })),
  http.get('*/web/factory/projects/:id/audit', () => HttpResponse.json({ events: [], actors: {} })),
  http.get('*/web/factory/projects/:id/decisions', () => HttpResponse.json({ decisions: [] })),
  // What a test stubs here is the project's cards: the board's paged reads are answered from it.
  http.get('*/web/factory/projects/:id/work-items', () => HttpResponse.json({ workItems: [] })),
  ...boardReadHandlers,
  // Ambient empty board for the draft page's starters and activity; their tests override these with `server.use(...)`.
  http.get('*/web/factory/projects/:id/work-items/starters', () =>
    HttpResponse.json({
      failed: 0,
      changesRequested: 0,
      review: { count: 0 },
      undecided: 0,
      untriaged: 0,
      unplannedBugs: 0,
      stale: 0,
    }),
  ),
  http.get('*/web/factory/projects/:id/work-items/activity', () =>
    HttpResponse.json({ total: 0, createdAt: [], doneAt: [] }),
  ),
  http.get('*/web/github/projects/:projectRepositoryId/worktrees', () => HttpResponse.json({ worktrees: [] })),
);
