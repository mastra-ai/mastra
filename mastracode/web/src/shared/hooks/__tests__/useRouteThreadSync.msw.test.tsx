import { useQuery } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/web-ui/render';
import { queryKeys } from '../../api/keys';
import { ChatConnectionContext } from '../../../web/ui/domains/chat/context/ChatConnectionContext';
import { ChatSessionContext } from '../../../web/ui/domains/chat/context/ChatSessionContext';
import { ChatTranscriptContext } from '../../../web/ui/domains/chat/context/ChatTranscriptContext';
import type { ChatTranscriptApi } from '../../../web/ui/domains/chat/context/ChatTranscriptContext';
import { initialTranscript } from '../../../web/ui/domains/chat/services/transcript';
import { useRouteThreadSync } from '../useRouteThreadSync';

const controllerId = 'code';
const resourceId = 'resource-route-sync';
const scope = '/sandbox/mastra';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;

function RouteThreadSyncProbe() {
  useRouteThreadSync();
  return null;
}

/**
 * Mirrors the app's connection wiring: the bound thread id comes from the
 * canonical connection-state cache entry, so a successful switch mutation
 * (whose onSuccess writes that entry) converges the effect the same way it
 * does in production.
 */
function TestChatConnectionProvider({ children }: { children: ReactNode }) {
  const stateQuery = useQuery({
    queryKey: queryKeys.agentControllerConnectionState(controllerId, resourceId, scope),
    queryFn: async () => {
      const response = await fetch(sessionUrl);
      const state: { threadId?: string } = await response.json();
      return state;
    },
  });

  return (
    <ChatConnectionContext.Provider value={{ status: 'ready', threadId: stateQuery.data?.threadId }}>
      {children}
    </ChatConnectionContext.Provider>
  );
}

function makeTranscriptStub(pushNotice: ChatTranscriptApi['pushNotice']): ChatTranscriptApi {
  return {
    transcript: initialTranscript,
    busy: false,
    showWorkingIndicator: false,
    localUser: () => undefined,
    reset: () => undefined,
    resolvePrompt: () => undefined,
    clearPending: () => undefined,
    pushNotice,
    loadMore: { hasMore: false, isLoading: false },
  };
}

function renderRouteThreadSync(pushNotice: ChatTranscriptApi['pushNotice']) {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/f1/user/threads/thread-b']}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <ChatSessionContext.Provider
              value={{
                resourceId,
                sessionEnabled: true,
                resourceEnabled: true,
                projectPath: scope,
                baseUrl: TEST_BASE_URL,
                kind: 'user',
              }}
            >
              <TestChatConnectionProvider>
                <ChatTranscriptContext.Provider value={makeTranscriptStub(pushNotice)}>
                  <RouteThreadSyncProbe />
                </ChatTranscriptContext.Provider>
              </TestChatConnectionProvider>
            </ChatSessionContext.Provider>
          }
        />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('useRouteThreadSync', () => {
  it('given a pending switch to the route thread, when the effect re-fires, then no duplicate switch is issued', async () => {
    const threads = [
      { id: 'thread-a', title: 'A', updatedAt: '2026-07-20T00:00:00.000Z' },
      { id: 'thread-b', title: 'B', updatedAt: '2026-07-21T00:00:00.000Z' },
    ];
    let serverThreadId = 'thread-a';
    let threadsRequests = 0;
    let switchRequests = 0;
    let releaseSwitch: () => void = () => {};
    const switchGate = new Promise<void>(resolve => {
      releaseSwitch = resolve;
    });
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: serverThreadId })),
      // Grow the list on refetch: structural sharing would otherwise keep the
      // same data reference and the route-sync effect would not re-run.
      http.get(`${sessionUrl}/threads`, () => {
        threadsRequests += 1;
        const extra =
          threadsRequests > 1
            ? [{ id: `thread-c${threadsRequests}`, title: 'C', updatedAt: '2026-07-22T00:00:00.000Z' }]
            : [];
        return HttpResponse.json({ threads: [...threads, ...extra] });
      }),
      http.post(`${sessionUrl}/thread`, async () => {
        switchRequests += 1;
        await switchGate;
        serverThreadId = 'thread-b';
        return HttpResponse.json({ ok: true });
      }),
    );

    const pushNotice = vi.fn();
    const { client } = renderRouteThreadSync(pushNotice);

    await waitFor(() => expect(switchRequests).toBe(1));

    // Refetching the threads list changes an effect dependency, re-running the
    // route-sync effect while the first switch is still in flight.
    await act(async () => {
      await client.refetchQueries({
        queryKey: queryKeys.agentControllerThreads(controllerId, resourceId, scope),
        exact: true,
      });
    });
    await waitFor(() => expect(threadsRequests).toBeGreaterThanOrEqual(2));
    // Flush the re-run before releasing the in-flight request, then confirm it
    // did not enqueue a second switch mutation behind the serialization scope.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(client.getMutationCache().getAll()).toHaveLength(1);

    releaseSwitch();
    await waitForMutationsIdle(client);
    expect(switchRequests).toBe(1);
    expect(client.getMutationCache().getAll()).toHaveLength(1);
    expect(pushNotice).not.toHaveBeenCalled();
  });
});
