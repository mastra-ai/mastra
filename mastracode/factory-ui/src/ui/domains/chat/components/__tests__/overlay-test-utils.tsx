import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../context/ChatSessionTestProvider';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill implements ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe(_target: Element, _options?: ResizeObserverOptions) {}
    unobserve(_target: Element) {}
    disconnect() {}
  }

  globalThis.ResizeObserver = ResizeObserverPolyfill;
}

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const API = `${TEST_BASE_URL}/api/agent-controller/code`;

const OVERLAY_FACTORY_ID = 'p-overlay';
const OVERLAY_PROJECT_REPOSITORY_ID = 'repo-overlay';
const OVERLAY_SESSION_ID = 'session-overlay';

function resourceIdFromRequestBody(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('resourceId' in body)) {
    throw new Error('Expected session request to include a resourceId');
  }
  if (typeof body.resourceId !== 'string') throw new Error('Expected resourceId to be a string');
  return body.resourceId;
}

/** Install real network-boundary responses used by context-backed overlay tests. */
export function useOverlayControllerHandlers() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { userId: 'user-overlay', email: 'overlay@example.com' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: OVERLAY_FACTORY_ID, name: 'Overlay' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-overlay',
            installationId: 'install-overlay',
            repositories: [
              {
                id: OVERLAY_PROJECT_REPOSITORY_ID,
                branch: 'main',
                sandboxWorkdir: '/workspace/overlay',
                repository: { slug: 'org/overlay', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () =>
      HttpResponse.json({
        session: {
          id: 'row-overlay',
          sessionId: OVERLAY_SESSION_ID,
          projectRepositoryId: OVERLAY_PROJECT_REPOSITORY_ID,
          orgId: 'org-overlay',
          userId: 'user-overlay',
          branch: 'overlay-workspace',
          baseBranch: 'main',
          sandboxId: 'sandbox-overlay',
          sandboxWorkdir: '/workspace/overlay',
          materializedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.post(`${API}/sessions`, async ({ request }) => {
      const resourceId = resourceIdFromRequestBody(await request.json());
      return HttpResponse.json({ controllerId: 'code', resourceId, threadId: 'thread-test' });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () =>
      HttpResponse.json({
        models: [
          { id: 'openai/gpt-4o-mini', provider: 'openai', modelName: 'gpt-4o-mini', hasApiKey: true, useCount: 1 },
        ],
      }),
    ),
    http.get(`${API}/sessions/:resourceId`, ({ params }) =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: params.resourceId,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: 'thread-test',
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.get(`${API}/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ categories: { read: 'ask' }, tools: {} }),
    ),
    http.get(`${API}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${API}/sessions/:resourceId/threads/thread-test/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(
      `${API}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/fs/list`, () =>
      HttpResponse.json({ root: '/tmp', path: '/tmp', parent: null, entries: [] }),
    ),
    http.put(`${API}/sessions/:resourceId/state`, () => HttpResponse.json({})),
  );
}

/** Renders where a command navigated and the location it carries back, so tests can assert both. */
function NavigatedPath() {
  const { pathname, state } = useLocation();
  return (
    <span data-testid="navigated-path" data-return-to={JSON.stringify(state)}>
      {pathname}
    </span>
  );
}

export function OverlayTestProviders({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter
      initialEntries={[`/factories/${OVERLAY_FACTORY_ID}/workspaces/${OVERLAY_SESSION_ID}/threads/thread-test`]}
    >
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
          element={
            <MainSidebarProvider storageKey="overlay-test">
              <ChatSessionProvider threadId="thread-test">
                <OverlaysProvider>{children}</OverlaysProvider>
              </ChatSessionProvider>
            </MainSidebarProvider>
          }
        />
        <Route path="*" element={<NavigatedPath />} />
      </Routes>
    </MemoryRouter>
  );
}
