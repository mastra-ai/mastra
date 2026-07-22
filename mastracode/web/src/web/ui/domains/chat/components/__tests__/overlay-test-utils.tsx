import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const API = `${TEST_BASE_URL}/api/agent-controller/code`;

const OVERLAY_FACTORY_ID = 'p-overlay';
const OVERLAY_PROJECT_REPOSITORY_ID = 'repo-overlay';
const OVERLAY_SESSION_ID = 'session-overlay';

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
    http.post(`${TEST_BASE_URL}/web/github/projects/:projectRepositoryId/ensure`, () =>
      HttpResponse.json({ resourceId: 'test-resource', sandboxId: 'sandbox-overlay', sandboxWorkdir: '/workspace/overlay' }),
    ),
    http.post(`${API}/sessions`, async ({ request }) => {
      const { resourceId } = (await request.json()) as { resourceId: string };
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
    http.get(`${TEST_BASE_URL}/web/fs/list`, () =>
      HttpResponse.json({ root: '/tmp', path: '/tmp', parent: null, entries: [] }),
    ),
    http.put(`${API}/sessions/:resourceId/state`, () => HttpResponse.json({})),
  );
}

export function OverlayTestProviders({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={[`/factories/${OVERLAY_FACTORY_ID}/workspaces/${OVERLAY_SESSION_ID}/threads/thread-test`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
          element={
            <ChatSessionProvider threadId="thread-test">
              <OverlaysProvider>{children}</OverlaysProvider>
            </ChatSessionProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}
