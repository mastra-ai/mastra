// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { getMetricBreakdownArgsSchema } from '@mastra/core/storage';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useTraceUsage } from '../use-trace-usage';
import { emptyTraceUsageBreakdown, mixedCostUnitBreakdown, traceUsageBreakdown } from './fixtures/trace-usage';

type BreakdownArgs = Parameters<MastraClient['getMetricBreakdown']>[0];

const BASE_URL = 'http://localhost:4111';
const server = setupServer();

function makeWrapper(baseUrl: string | (() => string) = BASE_URL) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={typeof baseUrl === 'function' ? baseUrl() : baseUrl}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

function createGate() {
  let release = () => {};
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

describe('useTraceUsage', () => {
  describe('when usage columns are disabled', () => {
    it('does not request metric data', () => {
      let requestCount = 0;
      server.use(
        http.post(`${BASE_URL}/api/observability/metrics/breakdown`, () => {
          requestCount++;
          return HttpResponse.json(emptyTraceUsageBreakdown);
        }),
      );

      const { result } = renderHook(
        () => useTraceUsage({ traceIds: ['trace-a'], enabled: false, autoRefetch: false }),
        { wrapper: makeWrapper() },
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(requestCount).toBe(0);
    });
  });

  describe('when usage columns are enabled', () => {
    it('batches trace IDs and merges token and cost totals by trace', async () => {
      const requests: BreakdownArgs[] = [];
      server.use(
        http.post(`${BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
          requests.push(getMetricBreakdownArgsSchema.parse(await request.json()));
          return HttpResponse.json(traceUsageBreakdown);
        }),
      );

      const { result } = renderHook(
        () =>
          useTraceUsage({
            traceIds: ['trace-a', 'trace-b', 'trace-a'],
            enabled: true,
            autoRefetch: false,
          }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.data?.get('trace-b')?.outputTokens).toBe(40));

      expect(requests).toHaveLength(1);
      const request = requests[0];
      expect(request?.filters?.traceIds).toEqual(['trace-a', 'trace-b']);
      expect(request?.name).toEqual(['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens']);
      expect(request?.groupBy).toEqual(['traceId', 'name']);
      expect(request?.aggregation).toBe('sum');
      expect(request?.limit).toBe(4);
      expect(result.current.data?.get('trace-a')).toEqual({
        inputTokens: 100,
        outputTokens: 30,
        estimatedCost: 0.004,
        costUnit: 'usd',
      });
      expect(result.current.data?.get('trace-b')).toEqual({
        inputTokens: 200,
        outputTokens: 40,
        estimatedCost: 0.006,
        costUnit: 'usd',
      });
    });

    it('keeps each metric request below the trace ID batch size', async () => {
      const requests: BreakdownArgs[] = [];
      server.use(
        http.post(`${BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
          requests.push(getMetricBreakdownArgsSchema.parse(await request.json()));
          return HttpResponse.json(emptyTraceUsageBreakdown);
        }),
      );
      const traceIds = Array.from({ length: 501 }, (_, index) => `trace-${index}`);

      const { result } = renderHook(() => useTraceUsage({ traceIds, enabled: true, autoRefetch: false }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(requests).toHaveLength(2);
      const batchSizes = requests.flatMap(request =>
        request.filters?.traceIds ? [request.filters.traceIds.length] : [],
      );
      expect(batchSizes.toSorted((left, right) => left - right)).toEqual([1, 500]);
      expect(requests.map(request => request.limit).toSorted((left, right) => (left ?? 0) - (right ?? 0))).toEqual([
        2, 1000,
      ]);
    });

    it('keeps successful batch data when another batch fails', async () => {
      server.use(
        http.post(`${BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
          const body = getMetricBreakdownArgsSchema.parse(await request.json());
          if (body.filters?.traceIds?.includes('zz-trace-failed')) {
            return new HttpResponse(null, { status: 503 });
          }
          return HttpResponse.json({
            groups: traceUsageBreakdown.groups.filter(group => group.dimensions.traceId === 'trace-a'),
          });
        }),
      );
      const traceIds = [
        'trace-a',
        ...Array.from({ length: 499 }, (_, index) => `trace-fill-${index.toString().padStart(3, '0')}`),
        'zz-trace-failed',
      ];

      const { result } = renderHook(() => useTraceUsage({ traceIds, enabled: true, autoRefetch: false }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.data?.get('trace-a')?.inputTokens).toBe(100));
    });

    it('keeps existing values visible while an added trace batch loads', async () => {
      const gate = createGate();
      const requests: BreakdownArgs[] = [];
      server.use(
        http.post(`${BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
          const body = getMetricBreakdownArgsSchema.parse(await request.json());
          requests.push(body);
          if (body.filters?.traceIds?.includes('trace-c')) {
            await gate.promise;
            return HttpResponse.json(emptyTraceUsageBreakdown);
          }
          return HttpResponse.json(traceUsageBreakdown);
        }),
      );

      const { result, rerender } = renderHook(
        ({ traceIds }: { traceIds: string[] }) => useTraceUsage({ traceIds, enabled: true, autoRefetch: false }),
        {
          initialProps: { traceIds: ['trace-a'] },
          wrapper: makeWrapper(),
        },
      );
      await waitFor(() => expect(result.current.data?.get('trace-a')?.inputTokens).toBe(100));

      rerender({ traceIds: ['trace-a', 'trace-c'] });
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(result.current.data?.get('trace-a')?.inputTokens).toBe(100);

      gate.release();
      await waitFor(() => expect(result.current.isFetching).toBe(false));
    });

    it('does not carry usage values across projects while the new project loads', async () => {
      const projectAUrl = 'http://project-a.test';
      const projectBUrl = 'http://project-b.test';
      const gate = createGate();
      let currentBaseUrl = projectAUrl;
      let projectBRequests = 0;
      server.use(
        http.post(`${projectAUrl}/api/observability/metrics/breakdown`, () => HttpResponse.json(traceUsageBreakdown)),
        http.post(`${projectBUrl}/api/observability/metrics/breakdown`, async () => {
          projectBRequests++;
          await gate.promise;
          return HttpResponse.json(emptyTraceUsageBreakdown);
        }),
      );

      const { result, rerender } = renderHook(
        () => useTraceUsage({ traceIds: ['trace-a'], enabled: true, autoRefetch: false }),
        { wrapper: makeWrapper(() => currentBaseUrl) },
      );
      await waitFor(() => expect(result.current.data?.get('trace-a')?.inputTokens).toBe(100));

      currentBaseUrl = projectBUrl;
      rerender();
      await waitFor(() => expect(projectBRequests).toBe(1));
      try {
        expect(result.current.data).toBeUndefined();
      } finally {
        gate.release();
      }
      await waitFor(() => expect(result.current.isFetching).toBe(false));
    });

    it('does not display a combined cost when units differ', async () => {
      server.use(
        http.post(`${BASE_URL}/api/observability/metrics/breakdown`, () => HttpResponse.json(mixedCostUnitBreakdown)),
      );

      const { result } = renderHook(() => useTraceUsage({ traceIds: ['trace-a'], enabled: true, autoRefetch: false }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.get('trace-a')).toEqual({
        inputTokens: 100,
        outputTokens: 30,
      });
    });
  });
});
