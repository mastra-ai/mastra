// @vitest-environment jsdom
import { getMetricBreakdownArgsSchema } from '@mastra/core/storage';
import type { GetMetricBreakdownArgs, GetMetricBreakdownResponse } from '@mastra/core/storage';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper } from '../../../test/render';
import { useExperimentsListMetrics } from '../use-experiments-list-metrics';

const INPUT = 'mastra_model_total_input_tokens';
const OUTPUT = 'mastra_model_total_output_tokens';
const DURATION = 'mastra_agent_duration_ms';

const tokenBreakdown: GetMetricBreakdownResponse = {
  groups: [
    { dimensions: { experimentId: 'exp-a', name: INPUT }, value: 1200, estimatedCost: 0.012, costUnit: 'usd' },
    { dimensions: { experimentId: 'exp-a', name: OUTPUT }, value: 300, estimatedCost: 0.006, costUnit: 'usd' },
    { dimensions: { experimentId: 'exp-b', name: INPUT }, value: 50, estimatedCost: 0.001, costUnit: 'usd' },
    { dimensions: { experimentId: 'exp-b', name: OUTPUT }, value: 10, estimatedCost: 0.002, costUnit: 'eur' },
    // A store that ignores the experimentIds filter can return other experiments.
    { dimensions: { experimentId: 'exp-unrequested', name: INPUT }, value: 999, estimatedCost: 1, costUnit: 'usd' },
  ],
};

const durationBreakdown: GetMetricBreakdownResponse = {
  groups: [
    { dimensions: { experimentId: 'exp-a' }, value: 850 },
    { dimensions: { experimentId: 'exp-c' }, value: 2400 },
    { dimensions: { experimentId: 'exp-unrequested' }, value: 1 },
  ],
};

let requests: GetMetricBreakdownArgs[] = [];

const useBreakdownHandler = ({ failTokens = false }: { failTokens?: boolean } = {}) => {
  server.use(
    http.post('*/api/observability/metrics/breakdown', async ({ request }) => {
      const body = getMetricBreakdownArgsSchema.parse(await request.json());
      requests.push(body);
      const isDuration = body.name.includes(DURATION);
      if (!isDuration && failTokens) return HttpResponse.json({ error: 'boom' }, { status: 500 });
      return HttpResponse.json(isDuration ? durationBreakdown : tokenBreakdown);
    }),
  );
};

const completed = (...ids: string[]) => ids.map(id => ({ id, status: 'completed' as const }));

beforeEach(() => {
  requests = [];
});

afterEach(() => cleanup());

describe('useExperimentsListMetrics', () => {
  describe('when metrics are supported', () => {
    it('sends one token and one duration breakdown for all experiments, filtered by their ids', async () => {
      useBreakdownHandler();

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useExperimentsListMetrics({ experiments: completed('exp-b', 'exp-a', 'exp-c'), supportsMetrics: true }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(requests).toHaveLength(2);
      expect(requests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: [INPUT, OUTPUT],
            aggregation: 'sum',
            groupBy: ['experimentId', 'name'],
            filters: { experimentIds: ['exp-a', 'exp-b', 'exp-c'] },
            limit: 6,
          }),
          expect.objectContaining({
            name: [DURATION],
            aggregation: 'avg',
            groupBy: ['experimentId'],
            filters: { experimentIds: ['exp-a', 'exp-b', 'exp-c'] },
            limit: 3,
          }),
        ]),
      );
    });

    it('returns tokens, priced cost and average duration per requested experiment', async () => {
      useBreakdownHandler();

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useExperimentsListMetrics({ experiments: completed('exp-a', 'exp-b', 'exp-c'), supportsMetrics: true }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const metrics = result.current.data!;
      expect(metrics.get('exp-a')).toEqual({
        inputTokens: 1200,
        outputTokens: 300,
        estimatedCost: expect.closeTo(0.018, 6),
        costUnit: 'usd',
        avgDurationMs: 850,
      });
      // Mixed cost units cannot be summed.
      expect(metrics.get('exp-b')).toEqual({
        inputTokens: 50,
        outputTokens: 10,
        estimatedCost: undefined,
        costUnit: undefined,
      });
      expect(metrics.get('exp-c')).toEqual({ avgDurationMs: 2400 });
      expect(metrics.has('exp-unrequested')).toBe(false);
    });

    it('still returns durations when the token breakdown fails', async () => {
      useBreakdownHandler({ failTokens: true });

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useExperimentsListMetrics({ experiments: completed('exp-a'), supportsMetrics: true }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.get('exp-a')).toEqual({ avgDurationMs: 850 });
    });

    it('splits more than 500 experiments into several requests', async () => {
      useBreakdownHandler();
      const ids = Array.from({ length: 501 }, (_, index) => `exp-${String(index).padStart(3, '0')}`);

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useExperimentsListMetrics({ experiments: completed(...ids), supportsMetrics: true }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const batchSizes = requests.map(request => request.filters?.experimentIds?.length);
      expect(batchSizes.toSorted((a = 0, b = 0) => b - a)).toEqual([500, 500, 1, 1]);
    });
  });

  describe('when metrics are not supported', () => {
    it('does not send a request', () => {
      useBreakdownHandler();

      const { wrapper } = makeWrapper();
      const { result } = renderHook(
        () => useExperimentsListMetrics({ experiments: completed('exp-a'), supportsMetrics: false }),
        { wrapper },
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(requests).toEqual([]);
    });
  });

  describe('when there are no experiments', () => {
    it('does not send a request', () => {
      useBreakdownHandler();

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExperimentsListMetrics({ experiments: [], supportsMetrics: true }), {
        wrapper,
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(requests).toEqual([]);
    });
  });
});
