// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import type { FeedbackListItem } from '../../feedback/optimistic-feedback';
import { PENDING_FEEDBACK_DELETION_TTL_MS } from '../../feedback/pending-feedback-deletions';
import { useDeleteFeedback } from '../use-delete-feedback';
import { useSpanFeedback } from '../use-span-feedback';
import { useTraceFeedback } from '../use-trace-feedback';
import { feedbackRecord, listFeedbackResponse, SPAN_ID, TRACE_ID } from './fixtures/trace-feedback';

const BASE_URL = 'http://localhost:4111';
const FEEDBACK_URL = `${BASE_URL}/api/observability/feedback`;

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const makeWrapper = (queryClient = makeQueryClient()) => {
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const isIn = (row: ReturnType<typeof feedbackRecord>, ids: string[]) =>
  row.feedbackId !== undefined && row.feedbackId !== null && ids.includes(row.feedbackId);

/**
 * Models Platform's queued delete path: the DELETE is accepted (202), but the list endpoint
 * keeps returning the row until the cleanup job runs (`applyDeletes()`).
 */
function queuedDeleteFeedbackServer(initialRows: ReturnType<typeof feedbackRecord>[], { sync = false } = {}) {
  let rows = initialRows;
  const requested: string[] = [];
  let failDelete = false;
  let listRequests = 0;

  server.use(
    http.get(FEEDBACK_URL, () => {
      listRequests++;
      return HttpResponse.json(listFeedbackResponse(rows));
    }),
    http.delete<never, { feedbackIds: string[] }>(FEEDBACK_URL, async ({ request }) => {
      if (failDelete) return HttpResponse.json({ error: 'boom' }, { status: 500 });
      const { feedbackIds } = await request.json();
      requested.push(...feedbackIds);
      if (sync) rows = rows.filter(row => !isIn(row, feedbackIds));
      return HttpResponse.json({ accepted: true }, { status: 202 });
    }),
  );

  return {
    requested,
    listRequests: () => listRequests,
    failDelete: () => (failDelete = true),
    applyDeletes: () => (rows = rows.filter(row => !isIn(row, requested))),
  };
}

const scopes = [
  {
    name: 'trace',
    spanId: undefined,
    rows: [
      feedbackRecord({ feedbackId: 'keep', feedbackType: 'comment', value: 'keep me' }),
      feedbackRecord({ feedbackId: 'doomed', feedbackType: 'comment', value: 'delete me' }),
    ],
    useList: () => useTraceFeedback({ traceId: TRACE_ID }),
  },
  {
    name: 'span',
    spanId: SPAN_ID,
    rows: [
      feedbackRecord({ feedbackId: 'keep', spanId: SPAN_ID, feedbackType: 'comment', value: 'keep me' }),
      feedbackRecord({ feedbackId: 'doomed', spanId: SPAN_ID, feedbackType: 'comment', value: 'delete me' }),
    ],
    useList: () => useSpanFeedback({ traceId: TRACE_ID, spanId: SPAN_ID }),
  },
] as const;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const statusOf = (feedback: FeedbackListItem[] | undefined, id: string) =>
  feedback?.find(item => item.feedbackId === id)?.deleteStatus;

describe.each(scopes)('pending $name feedback deletions', ({ spanId, rows, useList }) => {
  const renderPanel = (queryClient?: QueryClient) =>
    renderHook(() => ({ list: useList(), remove: useDeleteFeedback({ traceId: TRACE_ID, spanId }) }), {
      wrapper: makeWrapper(queryClient),
    });

  describe('when the server accepts the delete but still returns the row', () => {
    it('marks the row as deleting and leaves the others alone', async () => {
      const api = queuedDeleteFeedbackServer([...rows]);
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(2));

      await act(() => result.current.remove.mutateAsync({ feedbackId: 'doomed' }));

      expect(api.requested).toEqual(['doomed']);
      await waitFor(() => expect(statusOf(result.current.list.data?.feedback, 'doomed')).toBe('deleting'));
      expect(statusOf(result.current.list.data?.feedback, 'keep')).toBeUndefined();
    });
  });

  describe('when the cleanup job removes the row', () => {
    it('drops the row on the next poll and goes back to slow polling', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const api = queuedDeleteFeedbackServer([...rows]);
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(2));
      await act(() => result.current.remove.mutateAsync({ feedbackId: 'doomed' }));
      await waitFor(() => expect(statusOf(result.current.list.data?.feedback, 'doomed')).toBe('deleting'));

      // Still deleting: polls every 3 seconds.
      const before = api.listRequests();
      await act(() => vi.advanceTimersByTimeAsync(3_100));
      expect(api.listRequests()).toBe(before + 1);

      api.applyDeletes();
      await act(() => vi.advanceTimersByTimeAsync(3_100));
      await waitFor(() => expect(result.current.list.data?.feedback.map(item => item.feedbackId)).toEqual(['keep']));

      // Nothing left to wait for: back to the 30 second poll.
      const settled = api.listRequests();
      await act(() => vi.advanceTimersByTimeAsync(6_200));
      expect(api.listRequests()).toBe(settled);
    });
  });

  describe('when the cleanup job removes the row while the list is closed', () => {
    it('settles the deletion on reopen and does not poll fast', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const api = queuedDeleteFeedbackServer([...rows]);
      const queryClient = makeQueryClient();
      const first = renderPanel(queryClient);
      await waitFor(() => expect(first.result.current.list.data?.feedback).toHaveLength(2));
      await act(() => first.result.current.remove.mutateAsync({ feedbackId: 'doomed' }));
      await waitFor(() => expect(statusOf(first.result.current.list.data?.feedback, 'doomed')).toBe('deleting'));

      first.unmount();
      // Closed long enough for the list cache (gcTime 0) to be dropped.
      await act(() => vi.advanceTimersByTimeAsync(2_000));
      api.applyDeletes();
      const reopened = renderPanel(queryClient);
      await waitFor(() =>
        expect(reopened.result.current.list.data?.feedback.map(item => item.feedbackId)).toEqual(['keep']),
      );

      const settled = api.listRequests();
      await act(() => vi.advanceTimersByTimeAsync(9_300));
      expect(api.listRequests()).toBe(settled);
    });
  });

  describe('when the server deletes the row right away', () => {
    it('removes the row after the post-delete refetch', async () => {
      queuedDeleteFeedbackServer([...rows], { sync: true });
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(2));

      await act(() => result.current.remove.mutateAsync({ feedbackId: 'doomed' }));

      await waitFor(() => expect(result.current.list.data?.feedback.map(item => item.feedbackId)).toEqual(['keep']));
    });
  });

  describe('when the delete request fails', () => {
    it('does not mark the row as deleting', async () => {
      const api = queuedDeleteFeedbackServer([...rows]);
      api.failDelete();
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(2));

      await act(() => result.current.remove.mutateAsync({ feedbackId: 'doomed' }).catch(() => undefined));

      await waitFor(() => expect(result.current.remove.isError).toBe(true));
      expect(statusOf(result.current.list.data?.feedback, 'doomed')).toBeUndefined();
    });
  });

  describe('when the row is still returned after the deletion window', () => {
    it('shows the row again, marked as failed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      queuedDeleteFeedbackServer([...rows]);
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(2));
      await act(() => result.current.remove.mutateAsync({ feedbackId: 'doomed' }));
      await waitFor(() => expect(statusOf(result.current.list.data?.feedback, 'doomed')).toBe('deleting'));

      await act(() => vi.advanceTimersByTimeAsync(PENDING_FEEDBACK_DELETION_TTL_MS + 1));

      await waitFor(() => expect(statusOf(result.current.list.data?.feedback, 'doomed')).toBe('failed'));
    });
  });
});

describe('useDeleteFeedback caller callbacks', () => {
  describe('when the caller passes onSuccess', () => {
    it('still runs it and marks the row as deleting', async () => {
      queuedDeleteFeedbackServer([...scopes[0].rows]);
      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => ({
          list: useTraceFeedback({ traceId: TRACE_ID }),
          remove: useDeleteFeedback({ traceId: TRACE_ID, queryOptions: { onSuccess } }),
        }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(2));

      await act(() => result.current.remove.mutateAsync({ feedbackId: 'doomed' }));

      expect(onSuccess).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(statusOf(result.current.list.data?.feedback, 'doomed')).toBe('deleting'));
    });
  });
});
