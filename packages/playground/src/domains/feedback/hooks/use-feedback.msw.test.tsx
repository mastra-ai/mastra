// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useInboxDatasetReviewCount, useInboxDatasetReviewItems } from '../../review/hooks/use-inbox-review-items';
import { useFeedback, useFeedbackInboxCount, useUpdateFeedbackReviewStatus } from './use-feedback';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const FEEDBACK_URL = `${BASE_URL}/api/observability/feedback`;

const feedbackResponse = {
  feedback: [
    {
      feedbackId: 'feedback-1',
      timestamp: '2026-09-01T12:00:00.000Z',
      traceId: 'trace-1',
      feedbackSource: 'user',
      feedbackType: 'comment',
      value: 'Needs follow-up',
      reviewStatus: 'needs-review',
    },
  ],
  pagination: { total: 21, page: 1, perPage: 20, hasMore: true },
};

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('feedback inbox hooks', () => {
  it('lists the requested review status from the first page and loads the next page on demand', async () => {
    const onRequest = vi.fn<(url: URL) => void>();
    server.use(
      http.get(FEEDBACK_URL, ({ request }) => {
        const url = new URL(request.url);
        onRequest(url);
        if (url.searchParams.get('page') === '1') {
          return HttpResponse.json({
            feedback: [{ ...feedbackResponse.feedback[0], feedbackId: 'feedback-2' }],
            pagination: { total: 21, page: 1, perPage: 20, hasMore: false },
          });
        }
        return HttpResponse.json({
          ...feedbackResponse,
          pagination: { total: 21, page: 0, perPage: 20, hasMore: true },
        });
      }),
    );

    const { result } = renderHook(() => useFeedback({ reviewStatus: 'needs-review' }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = onRequest.mock.calls[0][0];
    expect(url.searchParams.get('reviewStatus')).toBe('needs-review');
    expect(url.searchParams.get('page')).toBe('0');
    expect(url.searchParams.get('perPage')).toBe('20');
    expect(url.searchParams.get('field')).toBe('timestamp');
    expect(url.searchParams.get('direction')).toBe('DESC');
    expect(result.current.total).toBe(21);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() =>
      expect(result.current.items.map(item => item.feedbackId)).toEqual(['feedback-1', 'feedback-2']),
    );
    expect(onRequest.mock.calls[1][0].searchParams.get('page')).toBe('1');
    expect(result.current.hasNextPage).toBe(false);
  });

  it('polls the needs-review count for the sidebar inbox pill', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onRequest = vi.fn<(url: URL) => void>();
    server.use(
      http.get(FEEDBACK_URL, ({ request }) => {
        onRequest(new URL(request.url));
        return HttpResponse.json(feedbackResponse);
      }),
    );

    const { result } = renderHook(() => useFeedbackInboxCount({ enabled: true }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onRequest.mock.calls[0][0].searchParams.get('reviewStatus')).toBe('needs-review');
    expect(onRequest.mock.calls[0][0].searchParams.get('perPage')).toBe('1');

    await act(() => vi.advanceTimersByTimeAsync(3000));
    await waitFor(() => expect(onRequest).toHaveBeenCalledTimes(2));
  });

  it('loads dataset experiment results that need review', async () => {
    server.use(
      http.get(`${BASE_URL}/api/experiments`, () =>
        HttpResponse.json({
          experiments: [{ id: 'experiment-1', datasetId: 'dataset-1' }],
          pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
        }),
      ),
      http.get(`${BASE_URL}/api/datasets/dataset-1/experiments/experiment-1/results`, () =>
        HttpResponse.json({
          results: [
            {
              id: 'result-1',
              itemId: 'item-1',
              experimentId: 'experiment-1',
              status: 'needs-review',
              input: 'Review me',
              output: 'Result',
              traceId: 'trace-1',
            },
            {
              id: 'result-2',
              itemId: 'item-2',
              experimentId: 'experiment-1',
              status: 'complete',
              input: 'Already reviewed',
              output: 'Result',
            },
          ],
          pagination: { total: 2, page: 0, perPage: 100, hasMore: false },
        }),
      ),
    );

    const { result } = renderHook(() => useInboxDatasetReviewItems(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      {
        id: 'result-1',
        itemId: 'item-1',
        experimentId: 'experiment-1',
        datasetId: 'dataset-1',
        traceId: 'trace-1',
        input: 'Review me',
        output: 'Result',
      },
    ]);
  });

  it('sums dataset review counts for the inbox pill', async () => {
    server.use(
      http.get(`${BASE_URL}/api/experiments/review-summary`, () =>
        HttpResponse.json({
          counts: [
            { experimentId: 'experiment-1', needsReview: 2, reviewed: 1, complete: 0, total: 3 },
            { experimentId: 'experiment-2', needsReview: 3, reviewed: 0, complete: 1, total: 4 },
          ],
        }),
      ),
    );

    const { result } = renderHook(() => useInboxDatasetReviewCount({ enabled: true }), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(5);
  });

  it('updates review status and refetches the inbox', async () => {
    const onList = vi.fn();
    const onPatch = vi.fn<(body: Record<string, unknown>) => void>();
    server.use(
      http.get(FEEDBACK_URL, () => {
        onList();
        return HttpResponse.json(feedbackResponse);
      }),
      http.patch(`${FEEDBACK_URL}/feedback-1/review-status`, async ({ request }) => {
        onPatch((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ...feedbackResponse.feedback[0], reviewStatus: 'reviewed' });
      }),
    );

    const { result } = renderHook(
      () => ({
        list: useFeedback({ reviewStatus: 'needs-review' }),
        update: useUpdateFeedbackReviewStatus(),
      }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(onList).toHaveBeenCalledTimes(1));
    await result.current.update.mutateAsync({ feedbackId: 'feedback-1', reviewStatus: 'reviewed' });

    expect(onPatch).toHaveBeenCalledWith({ reviewStatus: 'reviewed' });
    await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
  });
});
