import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { attentionKindSummaries } from './attention';
import { builtinBoardCatalog } from './board-catalog';

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
  // Ambient GitLab status: the Intake section probes it wherever settings
  // render. Reported as absent by default (no GitLab integration registered),
  // so that section stays hidden; GitLab tests override it with `server.use(...)`.
  http.get('*/web/gitlab/status', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  // Experimental surfaces stay hidden unless a test explicitly enables them.
  http.get('*/web/config/features', () => HttpResponse.json({ knowledge: false })),
  // Ambient activity poll (sidebar running dots); activity tests override it with `server.use(...)`.
  http.get('*/api/agent-controller/:controllerId/active-runs', () => HttpResponse.json({ runs: [] })),
  http.get('*/web/factory/projects/:id/boards', () => HttpResponse.json(builtinBoardCatalog)),
  http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [] })),
  // Ambient GitHub label routing (read by every board's intake feed); label-routing
  // tests override it with `server.use(...)`.
  http.get('*/web/intake/label-routes', () => HttpResponse.json({ routes: [] })),
  http.get('*/web/factory/projects/:id/source-control-connections', () => HttpResponse.json({ connections: [] })),
  http.get('*/web/factory/projects/:id/audit', () => HttpResponse.json({ events: [], actors: {} })),
  http.get('*/web/factory/projects/:id/attention', () =>
    HttpResponse.json({ items: [], kinds: attentionKindSummaries([]), hasMore: false }),
  ),
  http.get('*/web/factory/projects/:id/decisions', () => HttpResponse.json({ decisions: [] })),
  http.get('*/web/factory/projects/:id/work-items', () => HttpResponse.json({ workItems: [] })),
  http.get('*/web/factory/projects/:id/mention-roster', () => HttpResponse.json({ members: [] })),
  // Ambient feed stream: `FactoryLayout` mounts it on every routed surface. It
  // must never close — a closing stream puts every test into the retry loop.
  http.get(
    '*/web/factory/projects/:id/feed-events',
    () =>
      new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
        headers: { 'content-type': 'text/event-stream' },
      }),
  ),
  http.get('*/web/factory/work-items/:workItemId/comments', () => HttpResponse.json({ comments: [] })),
  http.get('*/web/github/projects/:projectRepositoryId/worktrees', () => HttpResponse.json({ worktrees: [] })),
);
