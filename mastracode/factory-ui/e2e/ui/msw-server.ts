import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { builtinBoardCatalog } from './board-catalog';

interface StubbedCard {
  id: string;
  board?: string | null;
  externalSource?: unknown;
  metadata?: Record<string, unknown> | null;
  sessions?: Record<string, unknown> | null;
  createdAt?: string;
}

/** The plain `/work-items` list the running test stubbed, read through MSW so its handler answers. */
async function readStubbedList(url: string): Promise<{
  workItems: StubbedCard[];
  runningSessionIds?: string[];
  parkedSessionIds?: string[];
}> {
  const listUrl = url.replace(/\/work-items\/.*$/, '/work-items');
  const response = await fetch(listUrl);
  if (!response.ok) throw HttpResponse.json(await response.json().catch(() => ({})), { status: response.status });
  return response.json();
}

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
  http.get('*/web/factory/projects/:id/boards', () => HttpResponse.json(builtinBoardCatalog)),
  http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [] })),
  // A server without the JIRA_* env group mounts no Jira routes; the ambient
  // 404 mirrors that and the Jira service degrades to a disabled status.
  // Jira-specific tests override these with `server.use(...)`.
  http.get('*/web/jira/status', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  http.get('*/web/jira/projects', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  http.get('*/web/jira/issues', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
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
  // Ambient GitHub label routing (read by every board's intake feed); label-routing
  // tests override it with `server.use(...)`.
  http.get('*/web/intake/label-routes', () => HttpResponse.json({ routes: [] })),
  // GitLab intake is optional; feature tests override these ambient 404s.
  http.get('*/web/gitlab/status', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  http.get('*/web/gitlab/projects', () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
  http.get('*/web/factory/projects/:id/source-control-connections', () => HttpResponse.json({ connections: [] })),
  http.get('*/web/factory/projects/:id/audit', () => HttpResponse.json({ events: [], actors: {} })),
  http.get('*/web/factory/projects/:id/decisions', () => HttpResponse.json({ decisions: [] })),
  // The board reads its cards through `/work-items/sync`, card sources and single cards through their own
  // routes. Tests stub the plain list, so these answer from it: every sync is a full one carrying all of
  // the test's cards, sources are those cards' sources, and a single card is looked up in the list.
  http.get('*/web/factory/projects/:id/work-items/sync', async ({ request }) => {
    const list = await readStubbedList(request.url);
    return HttpResponse.json({
      cursor: 'test-cursor',
      reset: true,
      workItems: list.workItems,
      deletedIds: [],
      counts: { total: list.workItems.length, boards: {} },
      runningSessionIds: list.runningSessionIds ?? [],
      parkedSessionIds: list.parkedSessionIds ?? [],
    });
  }),
  http.get('*/web/factory/projects/:id/work-items/sources', async ({ request }) => {
    const list = await readStubbedList(request.url);
    return HttpResponse.json({
      sources: list.workItems.flatMap(item =>
        item.externalSource
          ? [{ board: item.board ?? 'work', externalSource: item.externalSource, metadata: item.metadata ?? {} }]
          : [],
      ),
    });
  }),
  // A test's stubbed list stands in for the briefs: its cards with sessions, and every card's times for activity.
  http.get('*/web/factory/projects/:id/work-items/session-cards', async ({ request }) => {
    const list = await readStubbedList(request.url);
    return HttpResponse.json({
      workItems: list.workItems.filter(item => Object.keys(item.sessions ?? {}).length > 0),
    });
  }),
  http.get('*/web/factory/projects/:id/work-items/activity', async ({ request }) => {
    const { workItems } = await readStubbedList(request.url);
    return HttpResponse.json({
      cameIn: workItems.flatMap(item => (item.createdAt ? [item.createdAt] : [])),
      shipped: [],
    });
  }),
  http.get('*/web/factory/projects/:id/work-items/counts', () => HttpResponse.json({ total: 0, boards: {} })),
  http.get('*/web/factory/projects/:id/work-items/:workItemId', async ({ request, params }) => {
    const list = await readStubbedList(request.url);
    const workItem = list.workItems.find(item => item.id === params.workItemId);
    return workItem
      ? HttpResponse.json({ workItem })
      : HttpResponse.json({ error: 'Work item not found' }, { status: 404 });
  }),
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
