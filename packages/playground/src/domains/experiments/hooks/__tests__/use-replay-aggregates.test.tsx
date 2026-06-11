// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import {
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
    const pageOne = [failedReplayResult, liveResultWithJunkToolReplay];
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
      total: 102,
      // replayResult carries the divergent report (misses present) → never fully grounded.
      fullyGrounded: 0,
      withMisses: 101,
      withUnconsumed: 101,
      withArgMismatches: 101,
      failedReplay: 1,
      staleRecordings: 101,
      redactedPayloads: 101,
      // liveResultWithJunkToolReplay contributes to total only — junk key is not a report.
    });
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
});
