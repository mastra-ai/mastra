import type { ListWorkflowRunCountsResponse } from '@mastra/client-js';
import { MastraClientError } from '@mastra/client-js';
import { usePlaygroundStore } from '@mastra/playground-ui/store/playground-store';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import {
  RUN_COUNTS_REFETCH_INTERVAL_MS,
  isRunCountsUnsupported,
  runCountsRefetchInterval,
  useWorkflowsRunCounts,
} from '../use-workflows-run-counts';
import { server } from '@/test/msw-server';

describe('runCountsRefetchInterval', () => {
  describe('when the server does not have the endpoint', () => {
    it('stops polling on a 404 from the client', () => {
      const notFound = new MastraClientError(404, 'Not Found', 'HTTP error! status: 404');

      expect(isRunCountsUnsupported(notFound)).toBe(true);
      expect(runCountsRefetchInterval(notFound)).toBe(false);
    });
  });

  describe('when the failure is transient', () => {
    it('keeps polling on server errors', () => {
      const serverError = new MastraClientError(500, 'Internal Server Error', 'HTTP error! status: 500');

      expect(runCountsRefetchInterval(serverError)).toBe(RUN_COUNTS_REFETCH_INTERVAL_MS);
    });

    it('keeps polling on non-HTTP errors', () => {
      expect(runCountsRefetchInterval(new Error('network down'))).toBe(RUN_COUNTS_REFETCH_INTERVAL_MS);
    });
  });

  describe('when there is no error', () => {
    it('polls at the standard interval', () => {
      expect(runCountsRefetchInterval(null)).toBe(RUN_COUNTS_REFETCH_INTERVAL_MS);
    });
  });
});

describe('useWorkflowsRunCounts', () => {
  let lastQueryClient: QueryClient | undefined;

  const BASE_URL = 'http://localhost:4111';
  const RUN_COUNTS_URL = `${BASE_URL}/api/workflows/run-counts`;

  const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    lastQueryClient = queryClient;
    return ({ children }: { children: ReactNode }) => (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MastraReactProvider>
    );
  };

  describe('when the server aggregates counts', () => {
    it('exposes them keyed by workflow', async () => {
      server.use(
        http.get(RUN_COUNTS_URL, () =>
          HttpResponse.json({
            'weather-workflow': { running: 2, suspended: 1 },
          } satisfies ListWorkflowRunCountsResponse),
        ),
      );

      const { result } = renderHook(() => useWorkflowsRunCounts(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current['weather-workflow']).toEqual({ running: 2, suspended: 1 }));
    });
  });

  describe('when the server does not have the endpoint', () => {
    it('reports no counts rather than undefined', async () => {
      server.use(http.get(RUN_COUNTS_URL, () => new HttpResponse(null, { status: 404 })));

      const { result } = renderHook(() => useWorkflowsRunCounts(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current).toEqual({}));
    });
  });

  describe('before the first response lands', () => {
    it('reports no counts rather than undefined', () => {
      server.use(http.get(RUN_COUNTS_URL, () => HttpResponse.json({})));

      const { result } = renderHook(() => useWorkflowsRunCounts(), { wrapper: createWrapper() });

      expect(result.current).toEqual({});
    });
  });

  describe('the cache entry it writes', () => {
    it('scopes the counts to the request context they were read under', async () => {
      act(() => usePlaygroundStore.setState({ requestContext: { tenant: 'acme' } }));
      const empty: ListWorkflowRunCountsResponse = {};
      server.use(http.get(RUN_COUNTS_URL, () => HttpResponse.json(empty)));

      const { result } = renderHook(() => useWorkflowsRunCounts(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current).toBeDefined());

      await waitFor(() =>
        expect(lastQueryClient!.getQueryData(['workflow-run-counts', { tenant: 'acme' }])).toBeDefined(),
      );
      expect(lastQueryClient!.getQueryData(['workflow-run-counts', {}])).toBeUndefined();

      act(() => usePlaygroundStore.setState({ requestContext: {} }));
    });
  });
});
