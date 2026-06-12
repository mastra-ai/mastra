// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import {
  callFlowResult,
  expectationFailedResult,
  failedReplayResult,
  listResultsResponse,
  liveResultWithJunkToolReplay,
  replayResult,
} from '../../__tests__/fixtures/tool-replay';
import { useReplayAggregates } from '../use-replay-aggregates';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

describe('useReplayAggregates', () => {
  it('folds every page of results into groundedness aggregates', async () => {
    // Page 0: 100 clean-ish copies of replayResult; page 1: the divergent tail.
    const pageZero = Array.from({ length: 100 }, (_, i) => ({
      ...replayResult,
      id: `result-${i}`,
      itemId: `item-${i}`,
    }));
    const pageOne = [failedReplayResult, liveResultWithJunkToolReplay, expectationFailedResult];
    const total = pageZero.length + pageOne.length;

    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments/exp-replay-1/results`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 0);
        return HttpResponse.json(listResultsResponse(page === 0 ? pageZero : pageOne, total, page));
      }),
    );

    const { result } = renderHook(
      () =>
        useReplayAggregates({
          datasetId: 'dataset-1',
          experimentId: 'exp-replay-1',
          enabled: true,
          experimentStatus: 'completed',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toEqual({
      total: 103,
      // replayResult carries the divergent report (misses present) → never fully grounded.
      fullyGrounded: 0,
      withMisses: 101,
      withUnconsumed: 101,
      withArgMismatches: 101,
      // expectationFailedResult: top-level report with one unsatisfied expectation.
      withFailedExpectations: 1,
      // TOOL_MOCK_EXPECTATION_FAILED is not a TOOL_REPLAY_* code — only the miss counts here.
      failedReplay: 1,
      // expectationFailedResult mocked everything: nothing was ever on the tape.
      emptyRecordings: 1,
      staleRecordings: 101,
      redactedPayloads: 101,
      // None of these fixtures carry a call-flow report.
      callTotals: { total: 0, replayed: 0, replayedWithDrift: 0, mocked: 0, missed: 0, live: 0 },
      itemFlows: [],
      // No `partial` flag: completed experiments always walk every page.
      // liveResultWithJunkToolReplay contributes to total only — junk key is not a report.
    });
  });

  it('folds call flows into experiment-level totals and per-item flows', async () => {
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments/exp-replay-1/results`, () =>
        HttpResponse.json(listResultsResponse([callFlowResult])),
      ),
    );

    const { result } = renderHook(
      () =>
        useReplayAggregates({
          datasetId: 'dataset-1',
          experimentId: 'exp-replay-1',
          enabled: true,
          experimentStatus: 'completed',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.callTotals).toEqual({
      total: 4,
      replayed: 2,
      replayedWithDrift: 1,
      mocked: 1,
      missed: 0,
      live: 1,
    });
    expect(result.current.data?.itemFlows).toEqual([
      {
        resultId: 'result-replay-3',
        itemId: 'item-5',
        outcomes: [
          { outcome: 'replayed' },
          { outcome: 'replayed', argsDiffered: true },
          { outcome: 'mocked' },
          { outcome: 'miss-passthrough' },
        ],
        hasError: false,
      },
    ]);
  });

  it('stays idle when disabled', async () => {
    const { result } = renderHook(
      () =>
        useReplayAggregates({
          datasetId: 'dataset-1',
          experimentId: 'exp-live-1',
          enabled: false,
          experimentStatus: 'completed',
        }),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('caps the walk at 5 pages mid-run and flags the result partial; completed walks everything', async () => {
    // 7 pages of 100 — a running experiment must stop after page 4 (500 items).
    const total = 700;
    const pageRequests: number[] = [];
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments/exp-replay-1/results`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 0);
        pageRequests.push(page);
        const results = Array.from({ length: 100 }, (_, i) => ({
          ...replayResult,
          id: `result-${page}-${i}`,
          itemId: `item-${page}-${i}`,
        }));
        return HttpResponse.json(listResultsResponse(results, total, page));
      }),
    );

    const { result, rerender } = renderHook(
      ({ experimentStatus }: { experimentStatus: 'running' | 'completed' }) =>
        useReplayAggregates({
          datasetId: 'dataset-1',
          experimentId: 'exp-replay-1',
          enabled: true,
          experimentStatus,
        }),
      { wrapper, initialProps: { experimentStatus: 'running' as 'running' | 'completed' } },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.partial).toBe(true);
    expect(result.current.data?.total).toBe(500);
    expect(Math.max(...pageRequests)).toBe(4);

    rerender({ experimentStatus: 'completed' });

    await waitFor(() => expect(result.current.data?.total).toBe(700));
    expect(result.current.data?.partial).toBeUndefined();
    expect(Math.max(...pageRequests)).toBe(6);
  });

  it('keeps the previous aggregates rendered across the running→completed transition', async () => {
    const gate = (() => {
      let resolve: () => void = () => {};
      const promise = new Promise<void>(r => {
        resolve = r;
      });
      return { promise, resolve };
    })();
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments/exp-replay-1/results`, async () => {
        calls += 1;
        // The second (full) walk hangs until released — the previous data must
        // stay visible meanwhile instead of flipping back to the spinner.
        if (calls > 1) await gate.promise;
        return HttpResponse.json(listResultsResponse([callFlowResult]));
      }),
    );

    const { result, rerender } = renderHook(
      ({ experimentStatus }: { experimentStatus: 'running' | 'completed' }) =>
        useReplayAggregates({
          datasetId: 'dataset-1',
          experimentId: 'exp-replay-1',
          enabled: true,
          experimentStatus,
        }),
      { wrapper, initialProps: { experimentStatus: 'running' as 'running' | 'completed' } },
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    const runningData = result.current.data;

    rerender({ experimentStatus: 'completed' });

    // Key changed (capped → full) but keepPreviousData keeps the card fed.
    expect(result.current.data).toEqual(runningData);
    expect(result.current.isLoading).toBe(false);

    gate.resolve();
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data?.total).toBe(1);
  });
});
