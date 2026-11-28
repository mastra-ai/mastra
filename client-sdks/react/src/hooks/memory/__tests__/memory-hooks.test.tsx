// @vitest-environment jsdom
import type {
  GetMemoryStatusResponse,
  GetObservationalMemoryResponse,
  ListMemoryThreadMessagesResponse,
} from '@mastra/client-js';
import { QueryClient, QueryClientProvider, dehydrate, hydrate } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { MastraReactProvider } from '../../../mastra-react-provider';
import { useMemoryStatus } from '../use-memory-status';
import { memoryThreadMessagesQueryKeyPrefix, useMemoryThreadMessages } from '../use-memory-thread-messages';
import { useObservationalMemory } from '../use-observational-memory';

const BASE_URL = 'http://localhost:4111';
const ROOT = `${BASE_URL}/api`;

const server = setupServer();

const memoryStatusResponse: GetMemoryStatusResponse = {
  result: true,
  memoryType: 'local',
  observationalMemory: { enabled: true, hasRecord: true },
};

const threadMessagesResponse: ListMemoryThreadMessagesResponse = {
  messages: [
    {
      id: 'msg-1',
      role: 'user',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      content: {
        format: 2,
        content: 'Hello world',
        parts: [{ type: 'text', text: 'Hello world' }],
      },
    },
  ],
  uiMessages: null,
};

const observationalMemoryResponse: GetObservationalMemoryResponse = {
  record: null,
};

function makeWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

describe('useMemoryStatus', () => {
  describe('when agentId is present', () => {
    it('fetches the memory status and forwards agentId/threadId', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/memory/status`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(memoryStatusResponse);
        }),
      );

      const { result } = renderHook(() => useMemoryStatus({ agentId: 'agent-1', threadId: 'thread-1' }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(memoryStatusResponse);
      expect(capturedUrl?.searchParams.get('agentId')).toBe('agent-1');
      expect(capturedUrl?.searchParams.get('threadId')).toBe('thread-1');
    });
  });

  describe('when agentId is undefined', () => {
    it('stays idle and does not fetch', async () => {
      const onStatus = vi.fn<() => void>();
      server.use(
        http.get(`${ROOT}/memory/status`, () => {
          onStatus();
          return HttpResponse.json(memoryStatusResponse);
        }),
      );

      const { result } = renderHook(() => useMemoryStatus({ agentId: undefined, threadId: 'thread-1' }), {
        wrapper: makeWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.isPending).toBe(true);
      expect(onStatus).not.toHaveBeenCalled();
    });
  });
});

describe('useMemoryThreadMessages', () => {
  describe('when threadId is present', () => {
    it('fetches the messages and forwards page/perPage', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/memory/threads/:threadId/messages`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(threadMessagesResponse);
        }),
      );

      const { result } = renderHook(() => useMemoryThreadMessages({ threadId: 'thread-1', page: 2, perPage: 25 }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.messages).toHaveLength(1);
      expect(result.current.data?.messages[0]?.id).toBe('msg-1');
      expect(capturedUrl?.pathname).toBe('/api/memory/threads/thread-1/messages');
      expect(capturedUrl?.searchParams.get('page')).toBe('2');
      expect(capturedUrl?.searchParams.get('perPage')).toBe('25');
    });

    it('does not show another agent’s messages when switching agents on the same thread', async () => {
      const requestedAgents: string[] = [];
      server.use(
        http.get(`${ROOT}/memory/threads/:threadId/messages`, ({ request }) => {
          const agentId = new URL(request.url).searchParams.get('agentId') ?? '';
          requestedAgents.push(agentId);
          return HttpResponse.json({
            ...threadMessagesResponse,
            messages: threadMessagesResponse.messages.map(message => ({ ...message, id: `message-for-${agentId}` })),
          } satisfies ListMemoryThreadMessagesResponse);
        }),
      );

      const { result, rerender } = renderHook(
        ({ agentId }) => useMemoryThreadMessages({ threadId: 'thread-1', agentId }),
        { wrapper: makeWrapper(), initialProps: { agentId: 'agent-1' } },
      );
      await waitFor(() => expect(result.current.data?.messages[0]?.id).toBe('message-for-agent-1'));

      rerender({ agentId: 'agent-2' });
      await waitFor(() => expect(result.current.data?.messages[0]?.id).toBe('message-for-agent-2'));
      expect(requestedAgents).toContain('agent-1');
      expect(requestedAgents).toContain('agent-2');
    });
    it('refetches all pages for the selected agent without refreshing another agent', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const requests: string[] = [];
      server.use(
        http.get(`${ROOT}/memory/threads/:threadId/messages`, ({ request }) => {
          const params = new URL(request.url).searchParams;
          requests.push(`${params.get('agentId')}:${params.get('page')}`);
          return HttpResponse.json(threadMessagesResponse);
        }),
      );

      const wrapper = makeWrapper(queryClient);
      const firstPage = renderHook(() => useMemoryThreadMessages({ threadId: 'thread-1', agentId: 'agent-1' }), {
        wrapper,
      });
      const secondPage = renderHook(
        () => useMemoryThreadMessages({ threadId: 'thread-1', agentId: 'agent-1', page: 2 }),
        {
          wrapper,
        },
      );
      const otherAgent = renderHook(() => useMemoryThreadMessages({ threadId: 'thread-1', agentId: 'agent-2' }), {
        wrapper,
      });
      await waitFor(() => {
        expect(firstPage.result.current.isSuccess).toBe(true);
        expect(secondPage.result.current.isSuccess).toBe(true);
        expect(otherAgent.result.current.isSuccess).toBe(true);
      });
      const firstPageRequests = requests.filter(request => request === 'agent-1:0').length;
      const secondPageRequests = requests.filter(request => request === 'agent-1:2').length;
      const otherAgentRequests = requests.filter(request => request === 'agent-2:0').length;

      await queryClient.refetchQueries({ queryKey: memoryThreadMessagesQueryKeyPrefix('thread-1', 'agent-1') });
      expect(requests.filter(request => request === 'agent-1:0').length).toBeGreaterThan(firstPageRequests);
      expect(requests.filter(request => request === 'agent-1:2').length).toBeGreaterThan(secondPageRequests);
      expect(requests.filter(request => request === 'agent-2:0')).toHaveLength(otherAgentRequests);
    });

    it('invalidates a global memory page restored from JSON without invalidating an agent page', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      server.use(
        http.get(`${ROOT}/memory/threads/:threadId/messages`, () => HttpResponse.json(threadMessagesResponse)),
      );

      const global = renderHook(() => useMemoryThreadMessages({ threadId: 'thread-1' }), {
        wrapper: makeWrapper(queryClient),
      });
      const agent = renderHook(() => useMemoryThreadMessages({ threadId: 'thread-1', agentId: 'agent-1' }), {
        wrapper: makeWrapper(queryClient),
      });
      await waitFor(() => {
        expect(global.result.current.isSuccess).toBe(true);
        expect(agent.result.current.isSuccess).toBe(true);
      });

      const restored = new QueryClient();
      hydrate(restored, JSON.parse(JSON.stringify(dehydrate(queryClient))));
      await restored.invalidateQueries({ queryKey: memoryThreadMessagesQueryKeyPrefix('thread-1') });

      const globalPage = restored.getQueryCache().findAll({ queryKey: memoryThreadMessagesQueryKeyPrefix('thread-1') });
      expect(globalPage).toHaveLength(1);
      expect(globalPage[0]?.state.isInvalidated).toBe(true);
      const agentPage = restored
        .getQueryCache()
        .findAll({ queryKey: memoryThreadMessagesQueryKeyPrefix('thread-1', 'agent-1') });
      expect(agentPage).toHaveLength(1);
      expect(agentPage[0]?.state.isInvalidated).toBe(false);
    });
  });

  describe('when threadId is undefined', () => {
    it('stays idle and does not fetch', async () => {
      const onMessages = vi.fn<() => void>();
      server.use(
        http.get(`${ROOT}/memory/threads/:threadId/messages`, () => {
          onMessages();
          return HttpResponse.json(threadMessagesResponse);
        }),
      );

      const { result } = renderHook(() => useMemoryThreadMessages({ threadId: undefined }), { wrapper: makeWrapper() });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.isPending).toBe(true);
      expect(onMessages).not.toHaveBeenCalled();
    });
  });
});

describe('useObservationalMemory', () => {
  describe('when agentId and threadId are present', () => {
    it('fetches the observational memory and forwards agentId/threadId', async () => {
      let capturedUrl: URL | undefined;
      server.use(
        http.get(`${ROOT}/memory/observational-memory`, ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json(observationalMemoryResponse);
        }),
      );

      const { result } = renderHook(
        () => useObservationalMemory({ agentId: 'agent-1', threadId: 'thread-1', resourceId: 'resource-1' }),
        {
          wrapper: makeWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(observationalMemoryResponse);
      expect(capturedUrl?.searchParams.get('agentId')).toBe('agent-1');
      expect(capturedUrl?.searchParams.get('threadId')).toBe('thread-1');
      expect(capturedUrl?.searchParams.get('resourceId')).toBe('resource-1');
    });
  });

  describe('when agentId is undefined', () => {
    it('stays idle and does not fetch', async () => {
      const onObservational = vi.fn<() => void>();
      server.use(
        http.get(`${ROOT}/memory/observational-memory`, () => {
          onObservational();
          return HttpResponse.json(observationalMemoryResponse);
        }),
      );

      const { result } = renderHook(() => useObservationalMemory({ agentId: undefined, threadId: 'thread-1' }), {
        wrapper: makeWrapper(),
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.isPending).toBe(true);
      expect(onObservational).not.toHaveBeenCalled();
    });
  });
});
