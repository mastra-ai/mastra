// @vitest-environment jsdom

import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { formatMetricsBucketLabel } from '../metrics-interval';
import { latencyPercentiles } from './__tests__/fixtures/latency-metrics';
import { useLatencyMetrics } from './use-latency-metrics';
import { MetricsProvider } from './use-metrics';
import type { DatePreset, DateRange } from './use-metrics';

const BASE_URL = 'http://localhost:4111';
const server = setupServer();

type RequestBody = { name?: string; interval?: string };

function makeWrapper({ preset, customRange }: { preset: DatePreset; customRange?: DateRange }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MetricsProvider
          preset={preset}
          filterTokens={[]}
          customRange={customRange}
          onPresetChange={() => {}}
          onFilterTokensChange={() => {}}
        >
          {children}
        </MetricsProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

function listenPercentiles() {
  const onRequest = vi.fn<(body: RequestBody) => void>();
  server.use(
    http.post(`${BASE_URL}/api/observability/metrics/percentiles`, async ({ request }) => {
      onRequest((await request.json()) as RequestBody);
      return HttpResponse.json(latencyPercentiles);
    }),
  );
  return onRequest;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

describe('useLatencyMetrics', () => {
  it('uses hourly buckets and hour labels for the 24h preset', async () => {
    const onRequest = listenPercentiles();

    const { result } = renderHook(() => useLatencyMetrics(), { wrapper: makeWrapper({ preset: '24h' }) });

    await waitFor(() => expect(result.current.data?.interval).toBe('1h'));

    expect(onRequest.mock.calls.map(([body]) => body.interval)).toEqual(['1h', '1h', '1h']);
    expect(result.current.data?.agentData[0]).toEqual({
      time: formatMetricsBucketLabel(new Date('2026-06-01T00:00:00.000Z'), '1h'),
      tsMs: Date.parse('2026-06-01T00:00:00.000Z'),
      p50: 120,
      p95: 480,
    });
  });

  it('uses daily buckets and date labels for the 30d preset', async () => {
    const onRequest = listenPercentiles();

    const { result } = renderHook(() => useLatencyMetrics(), { wrapper: makeWrapper({ preset: '30d' }) });

    await waitFor(() => expect(result.current.data?.interval).toBe('1d'));

    expect(onRequest.mock.calls.map(([body]) => body.interval)).toEqual(['1d', '1d', '1d']);
    expect(result.current.data?.agentData.map(p => p.time)).toEqual([
      formatMetricsBucketLabel(new Date('2026-06-01T00:00:00.000Z'), '1d'),
      formatMetricsBucketLabel(new Date('2026-06-02T00:00:00.000Z'), '1d'),
    ]);
    expect(result.current.data?.agentData[1]?.time).toMatch(/^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/);
  });

  it('uses hourly buckets for a short custom range', async () => {
    const onRequest = listenPercentiles();
    const customRange = { from: new Date('2026-06-01T00:00:00.000Z'), to: new Date('2026-06-02T12:00:00.000Z') };

    const { result } = renderHook(() => useLatencyMetrics(), {
      wrapper: makeWrapper({ preset: 'custom', customRange }),
    });

    await waitFor(() => expect(result.current.data?.interval).toBe('1h'));
    expect(onRequest.mock.calls.map(([body]) => body.interval)).toEqual(['1h', '1h', '1h']);
  });
});
