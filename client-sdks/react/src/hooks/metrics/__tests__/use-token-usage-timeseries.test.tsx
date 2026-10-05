// @vitest-environment jsdom

import type { GetMetricTimeSeriesResponse } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { assert, describe, expect, it, vi } from 'vitest';

import { makeMetricsWrapper, useTestMetricsFilters } from '../../../test/metrics-wrapper';
import { server } from '../../../test/msw-server';
import { TEST_BASE_URL } from '../../../test/render';
import type { MetricsDatePreset as DatePreset } from '../metrics-query-filters';
import { useTokenUsageTimeSeries } from '../use-token-usage-timeseries';
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
} from './fixtures/token-usage-timeseries';

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

describe('useTokenUsageTimeSeries', () => {
  describe('when called', () => {
    it('merges input and output points by bucket and keeps cost units', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
          const body = (await request.json()) as RequestBody;
          if (body.name?.[0] === 'mastra_model_total_input_tokens') return HttpResponse.json(inputTokenSeries);
          return HttpResponse.json(outputTokenSeries);
        }),
      );

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper({ preset: '3d' }),
      });

      await waitFor(() => {
        expect(result.current.data?.data).toHaveLength(3);
      });

      expect(result.current.data?.interval).toBe('1d');
      const points = result.current.data?.data;
      expect(points).toMatchObject([
        {
          time: 'Jun 1',
          tsMs: new Date('2026-06-01T00:00:00.000Z').getTime(),
          input: 1200,
          output: 300,
          total: 1500,
          costUnit: 'usd',
        },
        {
          time: 'Jun 2',
          tsMs: new Date('2026-06-02T00:00:00.000Z').getTime(),
          input: 800,
          output: 0,
          total: 800,
          costUnit: 'usd',
        },
        {
          time: 'Jun 3',
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
  });

  describe('when for the 24h preset', () => {
    it('uses hourly buckets', async () => {
      const onTimeseries = vi.fn<(body: RequestBody) => void>();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
          const body = (await request.json()) as RequestBody;
          onTimeseries(body);
          return HttpResponse.json(emptyTokenSeries);
        }),
      );

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper({ preset: '24h' }),
      });

      await waitFor(() => {
        expect(result.current.data?.interval).toBe('1h');
      });

      expect(onTimeseries).toHaveBeenCalledTimes(2);
      expect(onTimeseries.mock.calls.map(([body]) => body.interval)).toEqual(['1h', '1h']);
    });
  });

  describe('when for a custom range of 48h or less', () => {
    it('uses hourly buckets', async () => {
      const onTimeseries = vi.fn<(body: RequestBody) => void>();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
          onTimeseries((await request.json()) as RequestBody);
          return HttpResponse.json(emptyTokenSeries);
        }),
      );
      const customRange = { from: new Date('2026-06-01T00:00:00.000Z'), to: new Date('2026-06-02T12:00:00.000Z') };

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper({ preset: 'custom', customRange }),
      });

      await waitFor(() => {
        expect(result.current.data?.interval).toBe('1h');
      });
      expect(onTimeseries.mock.calls.map(([body]) => body.interval)).toEqual(['1h', '1h']);
    });
  });

  describe('when for empty series', () => {
    it('returns an empty list', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, () => HttpResponse.json(emptyTokenSeries)),
      );

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper({ preset: '7d' }),
      });

      await waitFor(() => {
        expect(result.current.data?.data).toEqual([]);
      });
    });
  });

  describe('when with the timestamp filter', () => {
    it('passes dimensional filters through', async () => {
      const onTimeseries = vi.fn<(body: RequestBody) => void>();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
          const body = (await request.json()) as RequestBody;
          onTimeseries(body);
          return HttpResponse.json(emptyTokenSeries);
        }),
      );

      renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper({
          preset: '3d',
          dimensionalFilter: { rootEntityType: EntityType.AGENT, entityName: 'research-agent' },
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
  });

  const serveSeries = (input: GetMetricTimeSeriesResponse, output: GetMetricTimeSeriesResponse) =>
    server.use(
      http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
        const body = (await request.json()) as RequestBody;
        return HttpResponse.json(body.name?.[0] === 'mastra_model_total_input_tokens' ? input : output);
      }),
    );

  describe('when for the token metrics it charts, summed', () => {
    it('asks', async () => {
      const onTimeseries = vi.fn<(body: RequestBody) => void>();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
          onTimeseries((await request.json()) as RequestBody);
          return HttpResponse.json(emptyTokenSeries);
        }),
      );

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper(),
      });

      await waitFor(() => expect(result.current.data).toBeDefined());

      expect(onTimeseries.mock.calls.map(([body]) => body.name?.[0]).sort()).toEqual([
        'mastra_model_total_input_tokens',
        'mastra_model_total_output_tokens',
      ]);
      expect(onTimeseries.mock.calls.map(([body]) => body.aggregation)).toEqual(['sum', 'sum']);
    });
  });

  describe('when called', () => {
    it('labels hourly buckets by their time of day, in order', async () => {
      serveSeries(hourlyInputTokenSeries, emptyTokenSeries);

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper({ preset: '24h' }),
      });

      await waitFor(() => expect(result.current.data?.data).toHaveLength(2));

      // The later bucket arrived first; the chart still reads left to right.
      expect(result.current.data?.data.map(point => point.time)).toEqual(['12:05 AM', '1:45 PM']);
    });
  });

  describe('when two series disagree on it', () => {
    it('drops the cost unit', async () => {
      serveSeries(inputTokenSeries, eurOutputTokenSeries);

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper(),
      });

      await waitFor(() => expect(result.current.data?.data.length).toBeGreaterThan(0));

      const shared = result.current.data?.data.find(
        point => point.tsMs === new Date('2026-06-01T00:00:00.000Z').getTime(),
      );
      assert(shared, 'Expected the shared bucket');
      // The costs still add up; the currency no longer means anything.
      expect(shared.cost).toBeCloseTo(0.042);
      expect(shared.costUnit).toBeNull();
    });
  });

  describe('when a priced series does not name one', () => {
    it('drops the cost unit', async () => {
      serveSeries(emptyTokenSeries, unpricedUnitOutputTokenSeries);

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper(),
      });

      await waitFor(() => expect(result.current.data?.data).toHaveLength(1));

      expect(result.current.data?.data[0]?.cost).toBeCloseTo(0.03);
      expect(result.current.data?.data[0]?.costUnit).toBeNull();
    });
  });

  describe('when only part of a bucket names one', () => {
    it('drops the cost unit', async () => {
      // Same bucket: the input side is priced in usd, the output side is priced
      // in nothing at all. Adding them up gives a number in no known currency.
      serveSeries(inputTokenSeries, unpricedUnitOutputTokenSeries);

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper(),
      });

      await waitFor(() => expect(result.current.data?.data.length).toBeGreaterThan(0));

      const shared = result.current.data?.data.find(
        point => point.tsMs === new Date('2026-06-01T00:00:00.000Z').getTime(),
      );
      assert(shared, 'Expected the shared bucket');
      expect(shared.cost).toBeCloseTo(0.042);
      expect(shared.costUnit).toBeNull();
    });
  });

  describe('when the provider prices nothing', () => {
    it('leaves cost empty', async () => {
      serveSeries(costlessInputTokenSeries, emptyTokenSeries);

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper(),
      });

      await waitFor(() => expect(result.current.data?.data).toHaveLength(1));

      expect(result.current.data?.data[0]).toMatchObject({ input: 500, cost: null, costUnit: null });
    });
  });

  describe('when called', () => {
    it('skips a bucket the backend could not stamp', async () => {
      serveSeries(partlyUnstampedInputTokenSeries, emptyTokenSeries);

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper(),
      });

      await waitFor(() => expect(result.current.data?.data).toHaveLength(1));

      expect(result.current.data?.data[0]?.input).toBe(500);
    });
  });

  describe('when called', () => {
    it('keeps one window’s buckets apart, and stamps the interval on the cache key', async () => {
      serveSeries(hourlyInputTokenSeries, emptyTokenSeries);

      // One client for both hooks, and nothing ever goes stale, so a shared cache
      // entry would hand the second hook the first one's answer and keep it.
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      });
      const wrapperWith = (preset: DatePreset) => makeMetricsWrapper({ preset, queryClient });

      const daily = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), { wrapper: wrapperWith('3d') });
      await waitFor(() => expect(daily.result.current.data?.interval).toBe('1d'));

      const hourly = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: wrapperWith('24h'),
      });
      await waitFor(() => expect(hourly.result.current.data?.interval).toBe('1h'));

      expect(hourly.result.current.data?.data.map(point => point.time)).toEqual(['12:05 AM', '1:45 PM']);

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
  });

  describe('when a response carries no series', () => {
    it('returns an empty list', async () => {
      serveSeries(noTokenSeries, noTokenSeries);

      const { result } = renderHook(() => useTokenUsageTimeSeries(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper(),
      });

      await waitFor(() => expect(result.current.data?.data).toEqual([]));
    });
  });
});
