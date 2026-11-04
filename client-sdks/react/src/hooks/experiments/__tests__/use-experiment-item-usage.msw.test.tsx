// @vitest-environment jsdom
import { getMetricBreakdownArgsSchema } from '@mastra/core/storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';

import { server } from '../../../test/msw-server';
import { TEST_BASE_URL } from '../../../test/render';
import { useExperimentsItemUsage } from '../use-experiment-item-usage';
import {
  BASELINE_EXPERIMENT_ID,
  CONTENDER_EXPERIMENT_ID,
  baselineBreakdown,
  breakdownByExperimentId,
} from './fixtures/experiment-item-usage';

const BASE_URL = TEST_BASE_URL;

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

function createGate() {
  let release = () => {};
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

let rawRequests: Record<string, unknown>[] = [];

const useBreakdownHandler = (gate?: Promise<void>) => {
  server.use(
    http.post(`${BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
      const raw = (await request.json()) as Record<string, unknown>;
      rawRequests.push(raw);
      const body = getMetricBreakdownArgsSchema.parse(raw);
      if (gate) await gate;
      return HttpResponse.json(breakdownByExperimentId[body.filters?.experimentId ?? ''] ?? { groups: [] });
    }),
  );
};

const completedExperiments = [
  { id: BASELINE_EXPERIMENT_ID, status: 'completed' as const },
  { id: CONTENDER_EXPERIMENT_ID, status: 'completed' as const },
];

beforeEach(() => {
  rawRequests = [];
});

afterEach(() => {
  cleanup();
});

describe('useExperimentsItemUsage', () => {
  describe('when metrics are supported', () => {
    it('sends one unlimited breakdown request per experiment, filtered by experimentId and grouped by trace', async () => {
      useBreakdownHandler();

      const { result } = renderHook(
        () => useExperimentsItemUsage({ experiments: completedExperiments, supportsMetrics: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.data[CONTENDER_EXPERIMENT_ID]).toBeDefined());

      expect(rawRequests).toHaveLength(2);
      expect(rawRequests.map(body => (body.filters as { experimentId: string }).experimentId).sort()).toEqual([
        BASELINE_EXPERIMENT_ID,
        CONTENDER_EXPERIMENT_ID,
      ]);
      for (const body of rawRequests) {
        expect(body).toEqual({
          name: ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'],
          aggregation: 'sum',
          groupBy: ['traceId', 'name'],
          filters: { experimentId: expect.any(String) },
        });
        expect(body).not.toHaveProperty('limit');
      }
    });

    it('returns token and cost usage keyed by experiment then trace', async () => {
      useBreakdownHandler();

      const { result } = renderHook(
        () => useExperimentsItemUsage({ experiments: completedExperiments, supportsMetrics: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data[BASELINE_EXPERIMENT_ID]?.traces['trace-b1']).toEqual({
        inputTokens: 100,
        outputTokens: 40,
        estimatedCost: 0.003,
        costUnit: 'usd',
      });
    });

    it('returns the experiment totals, summing the cost of priced groups only', async () => {
      useBreakdownHandler();

      const { result } = renderHook(
        () => useExperimentsItemUsage({ experiments: completedExperiments, supportsMetrics: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data[BASELINE_EXPERIMENT_ID]?.summary).toEqual({
        inputTokens: 170,
        outputTokens: 40,
        estimatedCost: 0.003,
        costUnit: 'usd',
      });
    });
  });

  describe('when an experiment mixes cost units', () => {
    it('keeps the token totals and leaves the experiment cost undefined', async () => {
      useBreakdownHandler();

      const { result } = renderHook(
        () => useExperimentsItemUsage({ experiments: completedExperiments, supportsMetrics: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data[CONTENDER_EXPERIMENT_ID]?.summary).toEqual({
        inputTokens: 200,
        outputTokens: 80,
      });
    });
  });

  describe('when a trace mixes cost units', () => {
    it('keeps tokens and leaves the cost undefined', async () => {
      useBreakdownHandler();

      const { result } = renderHook(
        () => useExperimentsItemUsage({ experiments: completedExperiments, supportsMetrics: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data[CONTENDER_EXPERIMENT_ID]?.traces['trace-c1']).toEqual({
        inputTokens: 200,
        outputTokens: 80,
      });
    });
  });

  describe('when a trace has no priced group', () => {
    it('leaves the cost undefined', async () => {
      useBreakdownHandler();

      const { result } = renderHook(
        () => useExperimentsItemUsage({ experiments: completedExperiments, supportsMetrics: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data[BASELINE_EXPERIMENT_ID]?.traces['trace-b2']).toEqual({
        inputTokens: 70,
      });
    });
  });

  describe('when a breakdown request is pending', () => {
    it('reports loading', async () => {
      const gate = createGate();
      useBreakdownHandler(gate.promise);

      const { result } = renderHook(
        () => useExperimentsItemUsage({ experiments: completedExperiments, supportsMetrics: true }),
        { wrapper: makeWrapper() },
      );

      await waitFor(() => expect(rawRequests).toHaveLength(2));
      expect(result.current.isLoading).toBe(true);

      gate.release();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  describe('when metrics are not supported', () => {
    it('sends no request and is not loading', async () => {
      useBreakdownHandler();

      const { result } = renderHook(
        () => useExperimentsItemUsage({ experiments: completedExperiments, supportsMetrics: false }),
        { wrapper: makeWrapper() },
      );

      await act(() => new Promise(resolve => setTimeout(resolve, 50)));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data[BASELINE_EXPERIMENT_ID]).toBeUndefined();
      expect(rawRequests).toHaveLength(0);
    });
  });

  describe('when an experiment is running', () => {
    it('sends no breakdown request', async () => {
      useBreakdownHandler();

      const { result } = renderHook(
        () =>
          useExperimentsItemUsage({
            experiments: [{ id: BASELINE_EXPERIMENT_ID, status: 'running' }],
            supportsMetrics: true,
          }),
        { wrapper: makeWrapper() },
      );

      await act(() => new Promise(resolve => setTimeout(resolve, 50)));

      expect(rawRequests).toHaveLength(0);
      expect(result.current.data[BASELINE_EXPERIMENT_ID]).toBeUndefined();
    });
  });

  describe('when a running experiment completes', () => {
    it('fetches its usage once', async () => {
      useBreakdownHandler();

      const { result, rerender } = renderHook(
        ({ status }: { status: 'running' | 'completed' }) =>
          useExperimentsItemUsage({ experiments: [{ id: BASELINE_EXPERIMENT_ID, status }], supportsMetrics: true }),
        { wrapper: makeWrapper(), initialProps: { status: 'running' } },
      );
      await act(() => new Promise(resolve => setTimeout(resolve, 50)));
      expect(rawRequests).toHaveLength(0);

      rerender({ status: 'completed' });

      await waitFor(() => expect(result.current.data[BASELINE_EXPERIMENT_ID]?.summary.estimatedCost).toBe(0.003));
      await act(() => new Promise(resolve => setTimeout(resolve, 50)));
      expect(rawRequests).toHaveLength(1);
    });
  });

  describe('when metrics are still flushing after completion', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries and reports the cost once it lands', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      let calls = 0;
      server.use(
        http.post(`${BASE_URL}/api/observability/metrics/breakdown`, () => {
          calls += 1;
          return HttpResponse.json(calls === 1 ? { groups: [] } : baselineBreakdown);
        }),
      );

      const { result } = renderHook(
        () =>
          useExperimentsItemUsage({
            experiments: [{ id: BASELINE_EXPERIMENT_ID, status: 'completed' }],
            supportsMetrics: true,
          }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(calls).toBe(1));

      await act(() => vi.advanceTimersByTimeAsync(2500));

      await waitFor(() => expect(result.current.data[BASELINE_EXPERIMENT_ID]?.summary.estimatedCost).toBe(0.003));
      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(calls).toBe(2);
    });
  });

  describe('when breakdowns stay empty after completion', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('stops retrying after 5 attempts', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      let calls = 0;
      server.use(
        http.post(`${BASE_URL}/api/observability/metrics/breakdown`, () => {
          calls += 1;
          return HttpResponse.json({ groups: [] });
        }),
      );

      renderHook(
        () =>
          useExperimentsItemUsage({
            experiments: [{ id: BASELINE_EXPERIMENT_ID, status: 'completed' }],
            supportsMetrics: true,
          }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(calls).toBe(1));

      for (let i = 0; i < 10; i++) {
        await act(() => vi.advanceTimersByTimeAsync(2500));
      }

      expect(calls).toBe(5);
    });
  });
});
