// @vitest-environment jsdom

import { EntityType } from '@mastra/core/observability';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, assert, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  costlessInputTokenSeries,
  emptyTokenSeries,
  eurOutputTokenSeries,
  hourlyInputTokenSeries,
  inputTokenSeries,
  noTokenSeries,
  outputTokenSeries,
  partlyUnstampedInputTokenSeries,
  unpricedUnitOutputTokenSeries,
} from './__tests__/fixtures/token-usage-timeseries';
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
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
}: {
  preset?: DatePreset;
  filterTokens?: PropertyFilterToken[];
  queryClient?: QueryClient;
} = {}) {
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

    const firstCall = onTimeseries.mock.calls[0];
    assert(firstCall, 'Expected first timeseries request');
    const [inputRequest] = firstCall;
    expect(inputRequest.name).toEqual(['mastra_model_total_input_tokens']);
    expect(inputRequest.aggregation).toBe('sum');
    expect(inputRequest.filters?.timestamp?.start).toBeDefined();
    expect(inputRequest.filters?.timestamp?.end).toBeDefined();
    expect(inputRequest.filters?.rootEntityType).toBe(EntityType.AGENT);
    expect(inputRequest.filters?.entityName).toBe('research-agent');
  });

  const serveSeries = (input: unknown, output: unknown) =>
    server.use(
      http.post(`${BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
        const body = (await request.json()) as RequestBody;
        return HttpResponse.json(body.name?.[0] === 'mastra_model_total_input_tokens' ? input : output);
      }),
    );

  it('asks for the token metrics it charts, summed', async () => {
    const onTimeseries = vi.fn<(body: RequestBody) => void>();
    server.use(
      http.post(`${BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
        onTimeseries((await request.json()) as RequestBody);
        return HttpResponse.json(emptyTokenSeries);
      }),
    );

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(onTimeseries.mock.calls.map(([body]) => body.name?.[0]).sort()).toEqual([
      'mastra_model_total_input_tokens',
      'mastra_model_total_output_tokens',
    ]);
    expect(onTimeseries.mock.calls.map(([body]) => body.aggregation)).toEqual(['sum', 'sum']);
  });

  it('labels hourly buckets by their time of day, in order', async () => {
    serveSeries(hourlyInputTokenSeries, emptyTokenSeries);

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper({ preset: '24h' }) });

    await waitFor(() => expect(result.current.data?.data).toHaveLength(2));

    // The later bucket arrived first; the chart still reads left to right.
    expect(result.current.data?.data.map(point => point.time)).toEqual(['00:05', '13:45']);
  });

  it('drops the cost unit when two series disagree on it', async () => {
    serveSeries(inputTokenSeries, eurOutputTokenSeries);

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data?.data.length).toBeGreaterThan(0));

    const shared = result.current.data?.data.find(
      point => point.tsMs === new Date('2026-06-01T00:00:00.000Z').getTime(),
    );
    assert(shared, 'Expected the shared bucket');
    // The costs still add up; the currency no longer means anything.
    expect(shared.cost).toBeCloseTo(0.042);
    expect(shared.costUnit).toBeNull();
  });

  it('drops the cost unit when a priced series does not name one', async () => {
    serveSeries(emptyTokenSeries, unpricedUnitOutputTokenSeries);

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data?.data).toHaveLength(1));

    expect(result.current.data?.data[0]?.cost).toBeCloseTo(0.03);
    expect(result.current.data?.data[0]?.costUnit).toBeNull();
  });

  it('drops the cost unit when only part of a bucket names one', async () => {
    // Same bucket: the input side is priced in usd, the output side is priced
    // in nothing at all. Adding them up gives a number in no known currency.
    serveSeries(inputTokenSeries, unpricedUnitOutputTokenSeries);

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data?.data.length).toBeGreaterThan(0));

    const shared = result.current.data?.data.find(
      point => point.tsMs === new Date('2026-06-01T00:00:00.000Z').getTime(),
    );
    assert(shared, 'Expected the shared bucket');
    expect(shared.cost).toBeCloseTo(0.042);
    expect(shared.costUnit).toBeNull();
  });

  it('leaves cost empty when the provider prices nothing', async () => {
    serveSeries(costlessInputTokenSeries, emptyTokenSeries);

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data?.data).toHaveLength(1));

    expect(result.current.data?.data[0]).toMatchObject({ input: 500, cost: null, costUnit: null });
  });

  it('skips a bucket the backend could not stamp', async () => {
    serveSeries(partlyUnstampedInputTokenSeries, emptyTokenSeries);

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data?.data).toHaveLength(1));

    expect(result.current.data?.data[0]?.input).toBe(500);
  });

  it('keeps one window’s buckets apart, and stamps the interval on the cache key', async () => {
    serveSeries(hourlyInputTokenSeries, emptyTokenSeries);

    // One client for both hooks, and nothing ever goes stale, so a shared cache
    // entry would hand the second hook the first one's answer and keep it.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const wrapperWith = (preset: DatePreset) => makeWrapper({ preset, queryClient });

    const daily = renderHook(() => useTokenUsageTimeSeries(), { wrapper: wrapperWith('3d') });
    await waitFor(() => expect(daily.result.current.data?.interval).toBe('1d'));

    const hourly = renderHook(() => useTokenUsageTimeSeries(), { wrapper: wrapperWith('24h') });
    await waitFor(() => expect(hourly.result.current.data?.interval).toBe('1h'));

    expect(hourly.result.current.data?.data.map(point => point.time)).toEqual(['00:05', '13:45']);

    // The window alone already tells these two apart, so the interval in the key
    // cannot be caught by behaviour — assert the shape of the key itself.
    const intervals = queryClient
      .getQueryCache()
      .getAll()
      .map(query => query.queryKey)
      .filter(key => key[1] === 'token-usage-timeseries')
      .map(key => key.at(-1));
    expect(intervals.sort()).toEqual(['1d', '1h']);
  });

  it('returns an empty list when a response carries no series', async () => {
    serveSeries(noTokenSeries, noTokenSeries);

    const { result } = renderHook(() => useTokenUsageTimeSeries(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data?.data).toEqual([]));
  });
});
