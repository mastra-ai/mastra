import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useThreads } from '../use-memory';
import { makeThread, makeThreadsResponse } from './fixtures/threads';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useThreads', () => {
  afterEach(() => {
    cleanup();
  });

  describe('when the agent has threads', () => {
    it('requests only active threads', async () => {
      const onList = vi.fn<(url: URL) => void>();
      server.use(
        http.get(`${BASE_URL}/api/memory/threads`, ({ request }) => {
          onList(new URL(request.url));
          return HttpResponse.json(makeThreadsResponse([makeThread()]));
        }),
      );

      const { result } = renderHook(
        () => useThreads({ resourceId: AGENT_ID, agentId: AGENT_ID, isMemoryEnabled: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(onList.mock.calls[0]![0].searchParams.get('archived')).toBe('false');
    });
  });
});
