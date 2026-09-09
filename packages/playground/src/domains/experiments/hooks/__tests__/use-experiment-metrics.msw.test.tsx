import type { GetMetricAggregateArgs, GetMetricAggregateResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useExperimentMetrics } from '../use-experiment-metrics';
import {
  renamedPostgresWithMetrics,
  storageWithoutMetrics,
} from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const EXPERIMENT_ID = 'exp-123';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const tokensAggregate: GetMetricAggregateResponse = { value: 12400, estimatedCost: 0.0123, costUnit: 'USD' };
const avgDurationAggregate: GetMetricAggregateResponse = { value: 1850 };
const countAggregate: GetMetricAggregateResponse = { value: 42 };
const nullAggregate: GetMetricAggregateResponse = { value: null, estimatedCost: null, costUnit: null };

let requests: GetMetricAggregateArgs[] = [];

const useAggregateHandler = (respond: (body: GetMetricAggregateArgs) => GetMetricAggregateResponse) => {
  server.use(
    http.post(`${BASE_URL}/api/observability/metrics/aggregate`, async ({ request }) => {
      const body = (await request.json()) as GetMetricAggregateArgs;
      requests.push(body);
      return HttpResponse.json(respond(body));
    }),
  );
};

const respondByAggregation = (body: GetMetricAggregateArgs): GetMetricAggregateResponse => {
  if (body.aggregation === 'sum') return tokensAggregate;
  if (body.aggregation === 'avg') return avgDurationAggregate;
  return countAggregate;
};

beforeEach(() => {
  requests = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useExperimentMetrics', () => {
  describe('given a metrics-capable observability store', () => {
    beforeEach(() => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(renamedPostgresWithMetrics)));
    });

    it('when called with an experimentId, then it requests aggregates filtered by that experimentId and no time window', async () => {
      useAggregateHandler(respondByAggregation);

      const { result } = renderHook(
        () => useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'completed' }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(requests).toHaveLength(3);
      for (const body of requests) {
        expect(body.filters).toEqual({ experimentId: EXPERIMENT_ID });
        expect(body).not.toHaveProperty('comparePeriod');
      }
      expect(requests.map(r => r.aggregation).sort()).toEqual(['avg', 'count', 'sum']);
    });

    it('when aggregates resolve, then it exposes totalTokens, estimatedCost, costUnit, avgAgentDurationMs and agentRuns', async () => {
      useAggregateHandler(respondByAggregation);

      const { result } = renderHook(
        () => useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'completed' }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.isEnabled).toBe(true);
      expect(result.current.data).toEqual({
        totalTokens: 12400,
        estimatedCost: 0.0123,
        costUnit: 'USD',
        avgAgentDurationMs: 1850,
        agentRuns: 42,
      });
    });

    it('when the store returns null values, then metrics fields are null (not 0)', async () => {
      useAggregateHandler(() => nullAggregate);

      const { result } = renderHook(
        () => useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'completed' }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(result.current.data).toEqual({
        totalTokens: null,
        estimatedCost: null,
        costUnit: null,
        avgAgentDurationMs: null,
        agentRuns: null,
      });
    });

    it('when experimentStatus is running, then it refetches on an interval', async () => {
      useAggregateHandler(respondByAggregation);

      const { result } = renderHook(
        () => useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'running' }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(requests).toHaveLength(3);

      await waitFor(() => expect(requests.length).toBeGreaterThan(3), { timeout: 4000 });
    });

    it('when experimentStatus is completed, then it does not refetch', async () => {
      useAggregateHandler(respondByAggregation);

      const { result } = renderHook(
        () => useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'completed' }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(requests).toHaveLength(3);

      await act(() => new Promise(resolve => setTimeout(resolve, 2500)));
      expect(requests).toHaveLength(3);
    });

    it('when experimentId is undefined, then no request is made and isEnabled is false', async () => {
      useAggregateHandler(respondByAggregation);

      const { result } = renderHook(
        () => useExperimentMetrics({ experimentId: undefined, experimentStatus: 'completed' }),
        { wrapper: makeWrapper() },
      );

      await act(() => new Promise(resolve => setTimeout(resolve, 50)));

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(requests).toHaveLength(0);
    });
  });

  describe('given an observability store that does not support metrics', () => {
    it('when called, then it makes no aggregate request and isEnabled is false', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(storageWithoutMetrics)));
      useAggregateHandler(respondByAggregation);

      const { result } = renderHook(
        () => useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'completed' }),
        { wrapper: makeWrapper() },
      );

      await act(() => new Promise(resolve => setTimeout(resolve, 100)));

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(requests).toHaveLength(0);
    });
  });
});
