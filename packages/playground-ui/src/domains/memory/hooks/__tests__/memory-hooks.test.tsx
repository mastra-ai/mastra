// @vitest-environment jsdom
import type {
  GetMemoryStatusResponse,
  GetObservationalMemoryResponse,
  ListMemoryThreadMessagesResponse,
} from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { useMemoryStatus } from '../use-memory-status';
import { useMemoryThreadMessages } from '../use-memory-thread-messages';
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
};

const observationalMemoryResponse: GetObservationalMemoryResponse = {
  record: null,
};

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

      const { result } = renderHook(() => useMemoryStatus('agent-1', 'thread-1'), { wrapper: makeWrapper() });

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

      const { result } = renderHook(() => useMemoryStatus(undefined, 'thread-1'), { wrapper: makeWrapper() });

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

      const { result } = renderHook(() => useMemoryThreadMessages('thread-1', { page: 2, perPage: 25 }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.messages).toHaveLength(1);
      expect(result.current.data?.messages[0]?.id).toBe('msg-1');
      expect(capturedUrl?.pathname).toBe('/api/memory/threads/thread-1/messages');
      expect(capturedUrl?.searchParams.get('page')).toBe('2');
      expect(capturedUrl?.searchParams.get('perPage')).toBe('25');
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

      const { result } = renderHook(() => useMemoryThreadMessages(undefined), { wrapper: makeWrapper() });

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

      const { result } = renderHook(() => useObservationalMemory('agent-1', 'thread-1', 'resource-1'), {
        wrapper: makeWrapper(),
      });

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

      const { result } = renderHook(() => useObservationalMemory(undefined, 'thread-1'), { wrapper: makeWrapper() });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(result.current.fetchStatus).toBe('idle');
      expect(result.current.isPending).toBe(true);
      expect(onObservational).not.toHaveBeenCalled();
    });
  });
});
