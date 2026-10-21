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

function sessionValue(sessionId: string, sessionEnabled: boolean): ChatSessionContextApi {
  return {
    sessionId,
    resourceId: 'factory-1',
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
  sessionId,
  sessionEnabled,
  children,
}: {
  sessionId: string;
  sessionEnabled: boolean;
  children: ReactNode;
}) {
  const threadId = sessionId === 'session-old' ? ROUTE_THREAD_ID : 'new-session-thread';
  return (
    <ChatSessionContext.Provider value={sessionValue(sessionId, sessionEnabled)}>
      <ChatConnectionContext.Provider value={{ status: 'ready', threadId }}>
        <ChatTranscriptContext.Provider value={transcript}>{children}</ChatTranscriptContext.Provider>
      </ChatConnectionContext.Provider>
    </ChatSessionContext.Provider>
  );
}

function renderRoute(sessionId: string, sessionEnabled: boolean) {
  return (
    <MemoryRouter initialEntries={[`/factories/factory-1/threads/${ROUTE_THREAD_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/threads/:threadId"
          element={
            <Providers sessionId={sessionId} sessionEnabled={sessionEnabled}>
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
  it('preserves the session-change fallback while sandbox readiness is pending', async () => {
    const threadReads: string[] = [];
    const onSwitchThread = vi.fn();

    server.use(
      http.get(`${API}/sessions/:sessionId/threads`, ({ params }) => {
        const sessionId = String(params.sessionId);
        threadReads.push(sessionId);
        return HttpResponse.json({
          threads:
            sessionId === 'session-old'
              ? [{ id: ROUTE_THREAD_ID }]
              : [{ id: LATEST_THREAD_ID, updatedAt: '2026-08-12T00:00:00.000Z' }],
        });
      }),
      http.get(`${API}/sessions/:sessionId/threads/:threadId/messages`, () => HttpResponse.json({ messages: [] })),
      http.get(`${API}/sessions/:sessionId`, ({ params }) =>
        HttpResponse.json({
          controllerId: 'code',
          sessionId: String(params.sessionId),
          threadId: LATEST_THREAD_ID,
        }),
      ),
      http.post(`${API}/sessions/:sessionId/thread`, async ({ request }) => {
        const body = (await request.json()) as { threadId?: string };
        onSwitchThread(body.threadId);
        return HttpResponse.json({ ok: true });
      }),
    );

    const view = renderWithProviders(renderRoute('session-old', true));
    await waitFor(() => expect(threadReads).toContain('session-old'));

    view.rerender(renderRoute('session-new', false));
    await waitFor(() => expect(threadReads).toContain('session-new'));
    expect(screen.getByLabelText('Location').textContent).toBe(`/factories/factory-1/threads/${ROUTE_THREAD_ID}`);

    view.rerender(renderRoute('session-new', true));

    await waitFor(() =>
      expect(screen.getByLabelText('Location').textContent).toBe(`/factories/factory-1/threads/${LATEST_THREAD_ID}`),
    );
    expect(onSwitchThread).toHaveBeenCalledWith(LATEST_THREAD_ID);
    expect(transcript.pushNotice).not.toHaveBeenCalled();
  });
});
