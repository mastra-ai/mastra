// @vitest-environment jsdom
import type { ListScoresResponse } from '@mastra/client-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTraceSpanScoresRefetchInterval, useTraceSpanScores } from '../use-trace-span-scores';
import { server } from '@/test/msw-server';
import { makeWrapper } from '@/test/render';

const scoresResponse: ListScoresResponse = {
  pagination: { total: 1, page: 0, perPage: 10, hasMore: false },
  scores: [
    {
      id: 'score-1',
      scorerId: 'scorer-1',
      entityId: 'agent-1',
      runId: 'run-1',
      score: 0.8,
      scorer: {},
      source: 'LIVE',
      entity: {},
      traceId: 'trace-1',
      spanId: 'span-1',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    } as ListScoresResponse['scores'][number],
  ],
};

afterEach(() => cleanup());

describe('useTraceSpanScores', () => {
  it('loads the scores of the given span', async () => {
    const onRequest = vi.fn<(url: URL) => void>();
    server.use(
      http.get('*/api/observability/traces/trace-1/span-1/scores', ({ request }) => {
        onRequest(new URL(request.url));
        return HttpResponse.json(scoresResponse);
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTraceSpanScores({ traceId: 'trace-1', spanId: 'span-1' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.scores.map(s => s.id)).toEqual(['score-1']);
    expect(onRequest.mock.calls[0][0].searchParams.get('perPage')).toBe('10');
  });

  it('does not fetch without a span', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTraceSpanScores({ traceId: 'trace-1' }), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('stops polling when observability is unavailable', async () => {
    server.use(
      http.get('*/api/observability/traces/trace-1/span-1/scores', () =>
        HttpResponse.json({ error: 'Observability storage domain is not available' }, { status: 500 }),
      ),
    );

    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useTraceSpanScores({ traceId: 'trace-1', spanId: 'span-1' }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    const [query] = queryClient.getQueryCache().findAll({ queryKey: ['trace-span-scores'] });
    expect(query).toBeDefined();
    expect(getTraceSpanScoresRefetchInterval(query)).toBe(false);
  });
});
