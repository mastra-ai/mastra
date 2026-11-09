// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';

import { server } from '../../../test/msw-server';
import { TEST_BASE_URL } from '../../../test/render';
import { useExperimentMetrics } from '../use-experiment-metrics';

const BASE_URL = TEST_BASE_URL;

type GetMetricAggregateArgs = Parameters<MastraClient['getMetricAggregate']>[0];
type GetMetricAggregateResponse = Awaited<ReturnType<MastraClient['getMetricAggregate']>>;
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
  describe('when the observability store supports metrics', () => {
    it('when called with an experimentId, then it requests aggregates filtered by that experimentId and no time window', async () => {
      useAggregateHandler(respondByAggregation);

      const { result } = renderHook(
        () =>
          useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'completed', supportsMetrics: true }),
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
        () =>
          useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'completed', supportsMetrics: true }),
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
        () =>
          useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'completed', supportsMetrics: true }),
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
        () => useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'running', supportsMetrics: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(requests).toHaveLength(3);

      await waitFor(() => expect(requests.length).toBeGreaterThan(3), { timeout: 4000 });
    });

    it('when experimentStatus is completed, then it does not refetch', async () => {
      useAggregateHandler(respondByAggregation);

      const { result } = renderHook(
        () =>
          useExperimentMetrics({ experimentId: EXPERIMENT_ID, experimentStatus: 'completed', supportsMetrics: true }),
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
        () => useExperimentMetrics({ experimentId: undefined, experimentStatus: 'completed', supportsMetrics: true }),
        { wrapper: makeWrapper() },
      );

      await act(() => new Promise(resolve => setTimeout(resolve, 50)));

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(requests).toHaveLength(0);
    });
  });

  describe('when the observability store does not support metrics', () => {
    it('makes no aggregate request and reports isEnabled false', async () => {
      useAggregateHandler(respondByAggregation);

      const { result } = renderHook(
        () =>
          useExperimentMetrics({
            experimentId: EXPERIMENT_ID,
            experimentStatus: 'completed',
            supportsMetrics: false,
            queryOptions: { enabled: false },
          }),
        { wrapper: makeWrapper() },
      );

      await act(() => new Promise(resolve => setTimeout(resolve, 100)));

      expect(result.current.isEnabled).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(requests).toHaveLength(0);
    });
  });
});
