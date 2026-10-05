// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { makeMetricsWrapper, useTestMetricsFilters } from '../../../test/metrics-wrapper';
import { server } from '../../../test/msw-server';
import { TEST_BASE_URL } from '../../../test/render';
import { formatMetricsBucketLabel } from '../metrics-interval';
import type { MetricsDatePreset as DatePreset } from '../metrics-query-filters';
import { useLatencyMetrics } from '../use-latency-metrics';
import { latencyPercentiles } from './fixtures/latency-metrics';

type RequestBody = { name?: string; interval?: string };

function listenPercentiles() {
  const onRequest = vi.fn<(body: RequestBody) => void>();
  server.use(
    http.post(`${TEST_BASE_URL}/api/observability/metrics/percentiles`, async ({ request }) => {
      onRequest((await request.json()) as RequestBody);
      return HttpResponse.json(latencyPercentiles);
    }),
  );
  return onRequest;
}

describe('useLatencyMetrics', () => {
  describe('when for the 24h preset', () => {
    it('uses hourly buckets and hour labels', async () => {
      const onRequest = listenPercentiles();

      const { result } = renderHook(() => useLatencyMetrics(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper({ preset: '24h' }),
      });

      await waitFor(() => expect(result.current.data?.interval).toBe('1h'));

      expect(onRequest.mock.calls.map(([body]) => body.interval)).toEqual(['1h', '1h', '1h']);
      expect(result.current.data?.agentData[0]).toEqual({
        time: formatMetricsBucketLabel(new Date('2026-06-01T00:00:00.000Z'), '1h'),
        tsMs: Date.parse('2026-06-01T00:00:00.000Z'),
        p50: 120,
        p95: 480,
      });
    });
  });

  describe('when for the 30d preset', () => {
    it('uses daily buckets and date labels', async () => {
      const onRequest = listenPercentiles();

      const { result } = renderHook(() => useLatencyMetrics(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper({ preset: '30d' }),
      });

      await waitFor(() => expect(result.current.data?.interval).toBe('1d'));

      expect(onRequest.mock.calls.map(([body]) => body.interval)).toEqual(['1d', '1d', '1d']);
      expect(result.current.data?.agentData.map(p => p.time)).toEqual([
        formatMetricsBucketLabel(new Date('2026-06-01T00:00:00.000Z'), '1d'),
        formatMetricsBucketLabel(new Date('2026-06-02T00:00:00.000Z'), '1d'),
      ]);
      expect(result.current.data?.agentData[1]?.time).toMatch(/^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/);
    });
  });

  describe('when for a short custom range', () => {
    it('uses hourly buckets', async () => {
      const onRequest = listenPercentiles();
      const customRange = { from: new Date('2026-06-01T00:00:00.000Z'), to: new Date('2026-06-02T12:00:00.000Z') };

      const { result } = renderHook(() => useLatencyMetrics(useTestMetricsFilters()), {
        wrapper: makeMetricsWrapper({ preset: 'custom', customRange }),
      });

      await waitFor(() => expect(result.current.data?.interval).toBe('1h'));
      expect(onRequest.mock.calls.map(([body]) => body.interval)).toEqual(['1h', '1h', '1h']);
    });
  });
});
