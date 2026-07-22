import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { useScoreMetrics } from '../use-score-metrics';
import type { ScoreMetricsDateRange } from '../use-score-metrics';
import { emptyScoreMetrics, scoreMetricsScorers } from './fixtures/score-metrics';
import { server } from '@/test/msw-server';
import { renderHookWithProviders } from '@/test/render';

const BASE_URL = 'http://localhost:4111';
const firstRange = {
  start: new Date('2026-07-01T12:00:00.000Z'),
  end: new Date('2026-07-02T12:00:00.000Z'),
};
const secondRange = {
  start: new Date('2026-07-03T12:00:00.000Z'),
  end: new Date('2026-07-04T12:00:00.000Z'),
};

const serializeRange = (range: ScoreMetricsDateRange) =>
  JSON.stringify({
    start: range.start?.toISOString(),
    end: range.end?.toISOString(),
  });

const useScoreMetricsHandlers = (onScoresRequest: (timestamp: string | null) => void) => {
  server.use(
    http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json(scoreMetricsScorers)),
    http.get(`${BASE_URL}/api/observability/scores`, ({ request }) => {
      onScoresRequest(new URL(request.url).searchParams.get('timestamp'));
      return HttpResponse.json(emptyScoreMetrics);
    }),
  );
};

describe('useScoreMetrics', () => {
  describe('when a date range is supplied', () => {
    it('creates a distinct query and refetches when the range changes', async () => {
      const onScoresRequest = vi.fn<(timestamp: string | null) => void>();
      useScoreMetricsHandlers(onScoresRequest);

      const { result, rerender, queryClient } = renderHookWithProviders(
        ({ range }: { range: typeof firstRange }) => useScoreMetrics(range),
        { initialProps: { range: firstRange } },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      rerender({ range: secondRange });

      await waitFor(() => expect(onScoresRequest).toHaveBeenCalledTimes(2));
      expect(onScoresRequest.mock.calls).toEqual([[serializeRange(firstRange)], [serializeRange(secondRange)]]);
      expect(queryClient.getQueryCache().findAll({ queryKey: ['score-metrics'] })).toHaveLength(2);
    });
  });

  describe('when no date range is supplied', () => {
    it('omits the score timestamp filter', async () => {
      const onScoresRequest = vi.fn<(timestamp: string | null) => void>();
      useScoreMetricsHandlers(onScoresRequest);

      const { result } = renderHookWithProviders(() => useScoreMetrics());

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(onScoresRequest).toHaveBeenCalledWith(null);
    });
  });
});
