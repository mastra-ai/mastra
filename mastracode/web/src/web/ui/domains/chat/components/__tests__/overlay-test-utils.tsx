import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { ChatSessionTestProvider as ChatSessionProvider } from '../../context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';
import { ActiveFactoryProvider } from '../../../workspaces';

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

/** Install real network-boundary responses used by context-backed overlay tests. */
export function useOverlayControllerHandlers() {
  server.use(
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
    <MemoryRouter initialEntries={['/threads/thread-test']}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ActiveFactoryProvider>
              <ChatSessionProvider>
                <OverlaysProvider>{children}</OverlaysProvider>
              </ChatSessionProvider>
            </ActiveFactoryProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}
