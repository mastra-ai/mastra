import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { ChatConnectionContext } from '../../ui/domains/chat/context/ChatConnectionContext';
import { ChatSessionContext } from '../../ui/domains/chat/context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../ui/domains/chat/context/ChatSessionContext';
import { ChatTranscriptContext } from '../../ui/domains/chat/context/ChatTranscriptContext';
import type { ChatTranscriptApi } from '../../ui/domains/chat/context/ChatTranscriptContext';
import { initialTranscript } from '../../ui/domains/chat/services/transcript';
import { useRouteThreadSync } from '../useRouteThreadSync';

const ROUTE_THREAD_ID = 'route-thread';
const LATEST_THREAD_ID = 'latest-thread';
const API = `${TEST_BASE_URL}/api/agent-controller/code`;

const transcript: ChatTranscriptApi = {
  transcript: initialTranscript,
  busy: false,
  phase: 'awaiting',
  initializing: false,
  historyInitializing: false,
  initialHistoryReady: true,
  localUser: vi.fn(),
  failLocalUser: vi.fn(),
  reset: vi.fn(),
  resolvePrompt: vi.fn(),
  clearPending: vi.fn(),
  pushNotice: vi.fn(),
  loadMore: { hasMore: false, isLoading: false },
};

function sessionValue(resourceId: string, sessionEnabled: boolean): ChatSessionContextApi {
  return {
    resourceId,
    sessionEnabled,
    resourceReady: true,
    sandboxReady: sessionEnabled,
    sandboxPreparing: !sessionEnabled,
    resourceEnabled: true,
    baseUrl: TEST_BASE_URL,
    kind: 'factory',
  };
}

function RouteSync() {
  useRouteThreadSync();
  return null;
}

function LocationProbe() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}

function Providers({
  resourceId,
  sessionEnabled,
  children,
}: {
  resourceId: string;
  sessionEnabled: boolean;
  children: ReactNode;
}) {
  const threadId = resourceId === 'resource-old' ? ROUTE_THREAD_ID : 'new-resource-thread';
  return (
    <ChatSessionContext.Provider value={sessionValue(resourceId, sessionEnabled)}>
      <ChatConnectionContext.Provider value={{ status: 'ready', threadId }}>
        <ChatTranscriptContext.Provider value={transcript}>{children}</ChatTranscriptContext.Provider>
      </ChatConnectionContext.Provider>
    </ChatSessionContext.Provider>
  );
}

function renderRoute(resourceId: string, sessionEnabled: boolean) {
  return (
    <MemoryRouter initialEntries={[`/factories/factory-1/threads/${ROUTE_THREAD_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/threads/:threadId"
          element={
            <Providers resourceId={resourceId} sessionEnabled={sessionEnabled}>
              <RouteSync />
              <LocationProbe />
            </Providers>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('useRouteThreadSync', () => {
  it('preserves the scope-change fallback while sandbox readiness is pending', async () => {
    const threadReads: string[] = [];
    const onSwitchThread = vi.fn();

    server.use(
      http.get(`${API}/sessions/:resourceId/threads`, ({ params }) => {
        const resourceId = String(params.resourceId);
        threadReads.push(resourceId);
        return HttpResponse.json({
          threads:
            resourceId === 'resource-old'
              ? [{ id: ROUTE_THREAD_ID }]
              : [{ id: LATEST_THREAD_ID, updatedAt: '2026-08-12T00:00:00.000Z' }],
        });
      }),
      http.get(`${API}/sessions/:resourceId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
      http.get(`${API}/sessions/:resourceId`, ({ params }) =>
        HttpResponse.json({
          controllerId: 'code',
          resourceId: String(params.resourceId),
          threadId: LATEST_THREAD_ID,
        }),
      ),
      http.post(`${API}/sessions/:resourceId/thread`, async ({ request }) => {
        const body = (await request.json()) as { threadId?: string };
        onSwitchThread(body.threadId);
        return HttpResponse.json({ ok: true });
      }),
    );

    const view = renderWithProviders(renderRoute('resource-old', true));
    await waitFor(() => expect(threadReads).toContain('resource-old'));

    view.rerender(renderRoute('resource-new', false));
    await waitFor(() => expect(threadReads).toContain('resource-new'));
    expect(screen.getByLabelText('Location').textContent).toBe(`/factories/factory-1/threads/${ROUTE_THREAD_ID}`);

    view.rerender(renderRoute('resource-new', true));

    await waitFor(() =>
      expect(screen.getByLabelText('Location').textContent).toBe(`/factories/factory-1/threads/${LATEST_THREAD_ID}`),
    );
    expect(onSwitchThread).toHaveBeenCalledWith(LATEST_THREAD_ID);
    expect(transcript.pushNotice).not.toHaveBeenCalled();
  });
});
