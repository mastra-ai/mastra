// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMemoryWithOMStatus } from '../use-memory';
import { omEnabledStatus } from './fixtures/memory-status';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-om';
const RESOURCE_ID = 'resource-om';
const THREAD_ID = 'thread-om';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useMemoryWithOMStatus', () => {
  afterEach(() => {
    cleanup();
  });

  it('sends resourceId and threadId as query params so the server can resolve OM status', async () => {
    const onStatus = vi.fn<(url: URL) => void>();
    server.use(
      http.get(`${BASE_URL}/api/memory/status`, ({ request }) => {
        onStatus(new URL(request.url));
        return HttpResponse.json(omEnabledStatus);
      }),
    );

    const { result } = renderHook(
      () => useMemoryWithOMStatus({ agentId: AGENT_ID, resourceId: RESOURCE_ID, threadId: THREAD_ID }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(result.current.data?.observationalMemory?.enabled).toBe(true);
    });

    // Regression guard: a wrong argument order would drop resourceId/threadId
    // from the wire, leaving OM status undefined and the OM UI hidden.
    expect(onStatus).toHaveBeenCalled();
    const url = onStatus.mock.calls[0]![0];
    expect(url.searchParams.get('agentId')).toBe(AGENT_ID);
    expect(url.searchParams.get('resourceId')).toBe(RESOURCE_ID);
    expect(url.searchParams.get('threadId')).toBe(THREAD_ID);
  });
});
