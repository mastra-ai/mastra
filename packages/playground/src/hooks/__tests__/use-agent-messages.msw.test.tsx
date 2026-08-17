import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAgentMessages } from '../use-agent-messages';
import {
  authenticatedUser,
  authDisabled,
  builderDisabled,
  emptyAgentProviders,
  emptyBuilderModels,
  emptyMemoryConfig,
  emptyObservationalMemory,
  emptyVoiceSpeakers,
  emptyWorkingMemory,
  latestAgentMessagesPage,
  memoryDisabled,
  olderAgentMessagesPage,
  refreshedLatestAgentMessagesPage,
} from './fixtures/agent-messages';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { BrowserSessionProvider } from '@/domains/agents/context/browser-session-provider';
import { ThreadInputProvider } from '@/domains/conversation';
import { useChatSend } from '@/lib/ai-ui/chat/chat-context';
import { ChatProvider } from '@/lib/ai-ui/chat/chat-provider';
import { Thread } from '@/lib/ai-ui/thread';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-pagination';
const THREAD_ID = 'thread-pagination';

const makeGate = () => {
  let resolve = () => {};
  const promise = new Promise<void>(release => {
    resolve = release;
  });
  return { promise, resolve };
};

const finishStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'finish', payload: {} })}\n\n`));
      controller.close();
    },
  });

const baseChatHandlers = () => [
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json(authenticatedUser)),
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)),
  http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(emptyMemoryConfig)),
  http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
  http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () => HttpResponse.json(emptyWorkingMemory)),
  http.get(`${BASE_URL}/api/memory/observational-memory`, () => HttpResponse.json(emptyObservationalMemory)),
  http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json(emptyAgentProviders)),
  http.get(`${BASE_URL}/api/agents/:agentId/voice/speakers`, () => HttpResponse.json(emptyVoiceSpeakers)),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderDisabled)),
  http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json(emptyBuilderModels)),
];

const createTestQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const MastraQueryProviders = ({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) => (
  <MastraReactProvider baseUrl={BASE_URL}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </MastraReactProvider>
);

const makeWrapper = () => {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <MastraQueryProviders queryClient={queryClient}>{children}</MastraQueryProviders>
  );
};

const LiveTailButton = () => {
  const send = useChatSend();
  return <button onClick={() => send({ message: 'live tail' })}>Send live tail</button>;
};

const PaginatedThread = () => {
  const query = useAgentMessages({ agentId: AGENT_ID, threadId: THREAD_ID, memory: true });

  if (!query.data) return null;

  return (
    <ChatProvider
      agentId={AGENT_ID}
      threadId={THREAD_ID}
      initialMessages={query.data.initialMessages}
      supportsMemory
      settings={{ modelSettings: { chatWithLegacyStream: true } }}
      history={{
        hasMore: Boolean(query.hasNextPage),
        isLoading: query.isFetchingNextPage,
        load: async () => (await query.fetchNextPage()).data?.messages ?? [],
      }}
    >
      <LiveTailButton />
      <button onClick={() => void query.refetch()}>Refresh history</button>
      <Thread agentId={AGENT_ID} threadId={THREAD_ID} hasModelList />
    </ChatProvider>
  );
};

const renderPaginatedThread = () => {
  const queryClient = createTestQueryClient();
  return render(
    <MastraQueryProviders queryClient={queryClient}>
      <MemoryRouter>
        <BrowserSessionProvider agentId={AGENT_ID} threadId={THREAD_ID} enabled={false}>
          <WorkingMemoryProvider agentId={AGENT_ID} threadId={THREAD_ID} resourceId={AGENT_ID}>
            <ThreadInputProvider>
              <PaginatedThread />
            </ThreadInputProvider>
          </WorkingMemoryProvider>
        </BrowserSessionProvider>
      </MemoryRouter>
    </MastraQueryProviders>,
  );
};

const setScrollMetrics = (
  element: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number },
) => {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: metrics.scrollHeight });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: metrics.clientHeight });
  element.scrollTop = metrics.scrollTop;
};

const renderStreamingHistoryScenario = () => {
  const requestedPages = vi.fn<(page: string | null) => void>();
  const olderMessagesGate = makeGate();
  const streamGate = makeGate();
  server.use(
    ...baseChatHandlers(),
    http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, async ({ request }) => {
      const page = new URL(request.url).searchParams.get('page');
      requestedPages(page);
      if (page === '1') await olderMessagesGate.promise;
      return HttpResponse.json(page === '1' ? olderAgentMessagesPage : latestAgentMessagesPage);
    }),
    http.post(`${BASE_URL}/api/agents/${AGENT_ID}/stream`, async () => {
      await streamGate.promise;
      return new HttpResponse(finishStream(), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }),
  );
  renderPaginatedThread();
  return { olderMessagesGate, requestedPages, streamGate };
};

const loadOlderHistoryAtStart = async (
  scenario: ReturnType<typeof renderStreamingHistoryScenario>,
): Promise<HTMLElement> => {
  await screen.findByText('Message 79');
  fireEvent.click(screen.getByRole('button', { name: 'Send live tail' }));
  await screen.findByText('live tail');

  const viewport = document.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
  if (!viewport) throw new Error('Message scroller viewport was not rendered');

  setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
  fireEvent.scroll(viewport);
  setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
  fireEvent.scroll(viewport);
  await waitFor(() => expect(scenario.requestedPages.mock.calls.map(([page]) => page)).toEqual(['0', '1']));
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1600 });
  scenario.olderMessagesGate.resolve();
  await screen.findByText('Message 1');
  return viewport;
};

afterEach(() => cleanup());

describe('useAgentMessages', () => {
  describe('when an existing thread has an older page of persisted messages', () => {
    it('returns one chronological message sequence', async () => {
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, ({ request }) => {
          const page = new URL(request.url).searchParams.get('page');
          return HttpResponse.json(page === '1' ? olderAgentMessagesPage : latestAgentMessagesPage);
        }),
      );

      const { result } = renderHook(() => useAgentMessages({ agentId: AGENT_ID, threadId: THREAD_ID, memory: true }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.data?.messages).toHaveLength(40));

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => expect(result.current.data?.messages).toHaveLength(79));
      expect(result.current.data?.messages.map(message => message.id)).toEqual(
        Array.from({ length: 79 }, (_, index) => `message-${String(index + 1).padStart(3, '0')}`),
      );
    });
  });

  describe('when the reader returns to the start while a local message is still streaming', () => {
    it('shows the older history', async () => {
      const scenario = renderStreamingHistoryScenario();
      try {
        await loadOlderHistoryAtStart(scenario);
        expect(screen.getByText('Message 1')).not.toBeNull();
      } finally {
        scenario.olderMessagesGate.resolve();
        scenario.streamGate.resolve();
      }
    });

    it('keeps the local tail visible', async () => {
      const scenario = renderStreamingHistoryScenario();
      try {
        await loadOlderHistoryAtStart(scenario);
        expect(screen.getByText('live tail')).not.toBeNull();
      } finally {
        scenario.olderMessagesGate.resolve();
        scenario.streamGate.resolve();
      }
    });

    it('preserves the reader position', async () => {
      const scenario = renderStreamingHistoryScenario();
      try {
        const viewport = await loadOlderHistoryAtStart(scenario);
        expect(viewport.scrollTop).toBe(600);
      } finally {
        scenario.olderMessagesGate.resolve();
        scenario.streamGate.resolve();
      }
    });
  });

  describe('when the newest page refreshes after older history was loaded', () => {
    it('keeps the loaded older history visible', async () => {
      let latestPageRequests = 0;
      server.use(
        ...baseChatHandlers(),
        http.get(`${BASE_URL}/api/memory/threads/${THREAD_ID}/messages`, ({ request }) => {
          const page = new URL(request.url).searchParams.get('page');
          if (page === '1') return HttpResponse.json(olderAgentMessagesPage);
          latestPageRequests += 1;
          return HttpResponse.json(latestPageRequests > 1 ? refreshedLatestAgentMessagesPage : latestAgentMessagesPage);
        }),
      );

      renderPaginatedThread();

      await screen.findByText('Message 79');
      const viewport = document.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
      if (!viewport) throw new Error('Message scroller viewport was not rendered');
      setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
      fireEvent.scroll(viewport);
      setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
      fireEvent.scroll(viewport);
      await screen.findByText('Message 1');

      fireEvent.click(screen.getByRole('button', { name: 'Refresh history' }));
      await waitFor(() => expect(latestPageRequests).toBeGreaterThan(1));

      expect(screen.getByText('Message 1')).not.toBeNull();
    });
  });
});
