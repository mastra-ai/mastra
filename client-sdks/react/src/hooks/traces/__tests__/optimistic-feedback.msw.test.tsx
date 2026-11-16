// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import type { CreateFeedbackResponse } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { OPTIMISTIC_FEEDBACK_TTL_MS } from '../../feedback/optimistic-feedback';
import { useCreateFeedback } from '../use-create-feedback';
import { useSpanFeedback } from '../use-span-feedback';
import { useTraceFeedback } from '../use-trace-feedback';
import {
  createdFeedbackResponse,
  feedbackRecord,
  listFeedbackResponse,
  mixedFeedbackResponse,
  SPAN_ID,
  spanFeedbackResponse,
  TRACE_ID,
} from './fixtures/trace-feedback';

const BASE_URL = 'http://localhost:4111';
const FEEDBACK_URL = `${BASE_URL}/api/observability/feedback`;

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

type PostedFeedback = { feedbackId: string; timestamp: string; value: string; spanId?: string };

/**
 * Models Platform's eventually consistent write path: the POST is accepted, but the
 * list endpoint keeps returning the old rows until the writer flushes (`flush()`).
 */
function eventuallyConsistentFeedbackServer(initialRows: ReturnType<typeof feedbackRecord>[]) {
  let rows = initialRows;
  const posted: PostedFeedback[] = [];
  let releasePost: (() => void) | undefined;
  let holdPost = false;
  let failPost = false;

  server.use(
    http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse(rows))),
    http.post(FEEDBACK_URL, async ({ request }) => {
      const body = (await request.json()) as { feedback: PostedFeedback };
      posted.push(body.feedback);
      if (holdPost) await new Promise<void>(resolve => (releasePost = resolve));
      if (failPost) return HttpResponse.json({ error: 'boom' }, { status: 500 });
      return HttpResponse.json(createdFeedbackResponse(body.feedback.spanId));
    }),
  );

  return {
    posted,
    holdPost: () => (holdPost = true),
    releasePost: () => releasePost?.(),
    failPost: () => (failPost = true),
    /** The writer inserts every accepted POST, so the list now returns them. */
    flush: () => {
      rows = [
        ...posted.map(p =>
          feedbackRecord({
            feedbackId: p.feedbackId,
            spanId: p.spanId,
            feedbackType: 'comment',
            value: p.value,
            timestamp: new Date(p.timestamp),
          }),
        ),
        ...rows,
      ];
    },
    /** Simulates a lost write, or a row deleted elsewhere. */
    reset: (next: ReturnType<typeof feedbackRecord>[]) => (rows = next),
  };
}

const traceRows = mixedFeedbackResponse.feedback;
const spanRows = spanFeedbackResponse.feedback;

const scopes = [
  {
    name: 'trace',
    spanId: undefined,
    rows: traceRows,
    // useTraceFeedback drops span-level rows, so it shows 2 of the 3 server rows.
    visibleServerRows: 2,
    useList: (page?: number) => useTraceFeedback({ traceId: TRACE_ID, page }),
  },
  {
    name: 'span',
    spanId: SPAN_ID,
    rows: spanRows,
    visibleServerRows: 1,
    useList: (page?: number) => useSpanFeedback({ traceId: TRACE_ID, spanId: SPAN_ID, page }),
  },
] as const;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe.each(scopes)('optimistic $name comments', ({ spanId, rows, visibleServerRows, useList }) => {
  const renderPanel = (page?: number) =>
    renderHook(
      () => ({
        list: useList(page),
        create: useCreateFeedback({ traceId: TRACE_ID, spanId, feedbackUserId: 'user-1' }),
      }),
      { wrapper: makeWrapper() },
    );

  describe('when a comment is submitted', () => {
    it('shows the comment at the top of the list before the server confirms it', async () => {
      const api = eventuallyConsistentFeedbackServer([...rows]);
      api.holdPost();
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows));

      act(() => result.current.create.mutate({ text: 'new note' }));

      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows + 1));
      const [first] = result.current.list.data!.feedback;
      expect(first).toMatchObject({
        traceId: TRACE_ID,
        feedbackType: 'comment',
        feedbackSource: 'user',
        feedbackUserId: 'user-1',
        value: 'new note',
      });
      expect(first?.spanId ?? undefined).toBe(spanId);
      expect(result.current.list.data?.pagination?.total).toBe(visibleServerRows + 1);

      // The optimistic row and the posted row share one identity, so they can be matched up later.
      await waitFor(() => expect(api.posted).toHaveLength(1));
      expect(first?.feedbackId).toBe(api.posted[0]!.feedbackId);
      api.releasePost();
      await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    });
  });

  describe('when the server has not stored the comment yet', () => {
    it('keeps the comment visible through the post-submit refetch and later polls', async () => {
      const api = eventuallyConsistentFeedbackServer([...rows]);
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows));

      await act(() => result.current.create.mutateAsync({ text: 'new note' }));
      await act(() => result.current.list.refetch());

      expect(result.current.list.data?.feedback[0]?.value).toBe('new note');
      expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows + 1);
    });
  });

  describe('when the server starts returning the comment', () => {
    it('shows it once and stops tracking it as pending', async () => {
      const api = eventuallyConsistentFeedbackServer([...rows]);
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows));

      await act(() => result.current.create.mutateAsync({ text: 'new note' }));
      api.flush();
      await act(() => result.current.list.refetch());

      const id = api.posted[0]!.feedbackId;
      expect(result.current.list.data?.feedback.filter(f => f.feedbackId === id)).toHaveLength(1);
      expect(result.current.list.data?.pagination?.total).toBe(visibleServerRows + 1);

      // Once confirmed, the list follows the server alone: if the row goes away, it is not resurrected.
      api.reset([...rows]);
      await act(() => result.current.list.refetch());
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows));
    });
  });

  describe('when the submit fails', () => {
    it('removes the comment from the list', async () => {
      const api = eventuallyConsistentFeedbackServer([...rows]);
      api.holdPost();
      api.failPost();
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows));

      act(() => result.current.create.mutate({ text: 'doomed note' }));
      await waitFor(() => expect(result.current.list.data?.feedback[0]?.value).toBe('doomed note'));

      api.releasePost();
      await waitFor(() => expect(result.current.create.isError).toBe(true));
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows));
      expect(result.current.list.data?.feedback.some(f => f.value === 'doomed note')).toBe(false);
    });
  });

  describe('when the write is lost and never shows up on the server', () => {
    it('drops the comment after the pending window expires', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      eventuallyConsistentFeedbackServer([...rows]);
      const { result } = renderPanel();
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows));

      await act(() => result.current.create.mutateAsync({ text: 'lost note' }));
      await waitFor(() => expect(result.current.list.data?.feedback[0]?.value).toBe('lost note'));

      await act(() => vi.advanceTimersByTimeAsync(OPTIMISTIC_FEEDBACK_TTL_MS + 1));

      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows));
    });
  });

  describe('when viewing a later page', () => {
    it('does not inject the comment there', async () => {
      eventuallyConsistentFeedbackServer([...rows]);
      const { result } = renderPanel(1);
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows));

      await act(() => result.current.create.mutateAsync({ text: 'new note' }));

      expect(result.current.list.data?.feedback).toHaveLength(visibleServerRows);
    });
  });
});

describe('optimistic span comments in the trace list', () => {
  describe('when a span-level comment is submitted', () => {
    it('does not show a span-level comment in the trace-level list', async () => {
      eventuallyConsistentFeedbackServer([...traceRows]);
      const { result } = renderHook(
        () => ({
          traceList: useTraceFeedback({ traceId: TRACE_ID }),
          spanList: useSpanFeedback({ traceId: TRACE_ID, spanId: SPAN_ID }),
          create: useCreateFeedback({ traceId: TRACE_ID, spanId: SPAN_ID }),
        }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.traceList.data?.feedback).toHaveLength(2));

      await act(() => result.current.create.mutateAsync({ text: 'span note' }));

      await waitFor(() => expect(result.current.spanList.data?.feedback[0]?.value).toBe('span note'));
      expect(result.current.traceList.data?.feedback.some(f => f.value === 'span note')).toBe(false);
    });
  });
});

describe('useCreateFeedback caller callbacks', () => {
  describe('when the caller passes onMutate and onSuccess', () => {
    it('still runs caller onMutate/onSuccess and passes their context through', async () => {
      eventuallyConsistentFeedbackServer([...traceRows]);
      const onMutate = vi.fn(() => ({ fromCaller: true }));
      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => ({
          list: useTraceFeedback({ traceId: TRACE_ID }),
          create: useCreateFeedback({ traceId: TRACE_ID, queryOptions: { onMutate, onSuccess } }),
        }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(2));

      await act(() => result.current.create.mutateAsync({ text: 'note' }));

      expect(onMutate).toHaveBeenCalledWith({ text: 'note' }, expect.anything());
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining<Partial<CreateFeedbackResponse>>({ success: true }),
        { text: 'note' },
        { fromCaller: true },
        expect.anything(),
      );
      // The hook's own work still happened alongside the caller's callbacks.
      await waitFor(() => expect(result.current.list.data?.feedback[0]?.value).toBe('note'));
    });
  });

  describe('when the caller passes onError and the submit fails', () => {
    it('still runs caller onError and rolls back the comment', async () => {
      const api = eventuallyConsistentFeedbackServer([...traceRows]);
      api.failPost();
      const onError = vi.fn();
      const { result } = renderHook(
        () => ({
          list: useTraceFeedback({ traceId: TRACE_ID }),
          create: useCreateFeedback({ traceId: TRACE_ID, queryOptions: { onError } }),
        }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(2));

      await act(() => result.current.create.mutateAsync({ text: 'note' }).catch(() => undefined));

      expect(onError).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(2));
    });
  });
});
