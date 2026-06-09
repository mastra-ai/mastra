// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { emptyTokenSeries, inputTokenSeries, outputTokenSeries } from './__tests__/fixtures/token-usage-timeseries';
import { MetricsProvider } from './use-metrics';
import type { DatePreset, DateRange } from './use-metrics';
import { useTokenUsageTimeSeries } from './use-token-usage-timeseries';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

const BASE_URL = 'http://localhost:4111';
const server = setupServer();

type RequestBody = {
  name?: string[];
  interval?: string;
  aggregation?: string;
  filters?: {
    timestamp?: { start?: string; end?: string };
    rootEntityType?: string;
    entityName?: string;
  };
};

function makeWrapper({
  preset = '3d',
  filterTokens = [],
}: {
  preset?: DatePreset;
  filterTokens?: PropertyFilterToken[];
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const customRange: DateRange | undefined = undefined;

  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MetricsProvider
          preset={preset}
          filterTokens={filterTokens}
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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());

describe('useTokenUsageTimeSeries', () => {
  it('merges input and output points by bucket and keeps cost units', async () => {
    server.use(
      http.post(`${BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
        const body = (await request.json()) as RequestBody;
        if (body.name?.[0] === 'mastra_model_total_input_tokens') return HttpResponse.json(inputTokenSeries);
        return HttpResponse.json(outputTokenSeries);
      }),
    );

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper({ preset: '3d' }) });

    await waitFor(() => {
      expect(result.current.data?.data).toHaveLength(3);
    });

    expect(result.current.data?.interval).toBe('1d');
    const points = result.current.data?.data;
    expect(points).toMatchObject([
      {
        time: 'Jun 01',
        tsMs: new Date('2026-06-01T00:00:00.000Z').getTime(),
        input: 1200,
        output: 300,
        total: 1500,
        costUnit: 'usd',
      },
      {
        time: 'Jun 02',
        tsMs: new Date('2026-06-02T00:00:00.000Z').getTime(),
        input: 800,
        output: 0,
        total: 800,
        costUnit: 'usd',
      },
      {
        time: 'Jun 03',
        tsMs: new Date('2026-06-03T00:00:00.000Z').getTime(),
        input: 0,
        output: 200,
        total: 200,
        costUnit: 'usd',
      },
    ]);
    expect(points?.[0]?.cost).toBeCloseTo(0.042);
    expect(points?.[1]?.cost).toBeCloseTo(0.008);
    expect(points?.[2]?.cost).toBeCloseTo(0.02);
  });

  it('uses hourly buckets for the 24h preset', async () => {
    const onTimeseries = vi.fn<(body: RequestBody) => void>();
    server.use(
      http.post(`${BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
        const body = (await request.json()) as RequestBody;
        onTimeseries(body);
        return HttpResponse.json(emptyTokenSeries);
      }),
    );

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper({ preset: '24h' }) });

    await waitFor(() => {
      expect(result.current.data?.interval).toBe('1h');
    });

    expect(onTimeseries).toHaveBeenCalledTimes(2);
    expect(onTimeseries.mock.calls.map(([body]) => body.interval)).toEqual(['1h', '1h']);
  });

  it('returns an empty list for empty series', async () => {
    server.use(
      http.post(`${BASE_URL}/api/observability/metrics/timeseries`, () => HttpResponse.json(emptyTokenSeries)),
    );

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper({ preset: '7d' }) });

    await waitFor(() => {
      expect(result.current.data?.data).toEqual([]);
    });
  });

  it('passes dimensional filters through with the timestamp filter', async () => {
    const onTimeseries = vi.fn<(body: RequestBody) => void>();
    server.use(
      http.post(`${BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
        const body = (await request.json()) as RequestBody;
        onTimeseries(body);
        return HttpResponse.json(emptyTokenSeries);
      }),
    );

    renderHook(() => useTokenUsageTimeSeries(), {
      wrapper: makeWrapper({
        preset: '3d',
        filterTokens: [
          { fieldId: 'rootEntityType', value: EntityType.AGENT },
          { fieldId: 'entityName', value: 'research-agent' },
        ],
      }),
    });

    await waitFor(() => {
      expect(onTimeseries).toHaveBeenCalledTimes(2);
    });

    const [inputRequest] = onTimeseries.mock.calls[0]!;
    expect(inputRequest.name).toEqual(['mastra_model_total_input_tokens']);
    expect(inputRequest.aggregation).toBe('sum');
    expect(inputRequest.filters?.timestamp?.start).toBeDefined();
    expect(inputRequest.filters?.timestamp?.end).toBeDefined();
    expect(inputRequest.filters?.rootEntityType).toBe(EntityType.AGENT);
    expect(inputRequest.filters?.entityName).toBe('research-agent');
  });
});
