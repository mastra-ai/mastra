// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import type { MastraClient } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useCreateFeedback } from '../use-create-feedback';
import { useDeleteFeedback } from '../use-delete-feedback';
import { useSpanFeedback } from '../use-span-feedback';
import { useTraceFeedback } from '../use-trace-feedback';
import {
  createdFeedbackResponse,
  emptySerializedFeedbackResponse,
  submittedFeedbackRecord,
  mixedFeedbackResponse,
  SPAN_ID,
  spanFeedbackResponse,
  TRACE_ID,
} from './fixtures/trace-feedback';

const BASE_URL = 'http://localhost:4111';
const FEEDBACK_URL = `${BASE_URL}/api/observability/feedback`;

const makeWrapper = (
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
) => {
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => cleanup());

describe('useCreateFeedback', () => {
  describe('when explicit context and anonymous attribution are supplied', () => {
    it.each([undefined, SPAN_ID])(
      'sends explicit context and anonymous attribution for span %s and returns its creation identity',
      async spanId => {
        const onPost = vi.fn<(body: unknown) => void>();
        const created = createdFeedbackResponse(spanId);
        server.use(
          http.post(FEEDBACK_URL, async ({ request }) => {
            onPost(await request.json());
            return HttpResponse.json(created);
          }),
        );
        const { result } = renderHook(
          () => useCreateFeedback({ traceId: TRACE_ID, spanId, contextMode: 'resolve', feedbackUserId: null }),
          { wrapper: makeWrapper() },
        );
        const response = await result.current.mutateAsync({ text: 'anonymous note' });
        expect(onPost).toHaveBeenCalledWith({
          contextMode: 'resolve',
          feedback: {
            feedbackId: expect.any(String),
            timestamp: expect.any(String),
            traceId: TRACE_ID,
            ...(spanId ? { spanId } : {}),
            feedbackType: 'comment',
            feedbackSource: 'user',
            value: 'anonymous note',
            feedbackUserId: null,
          },
        });
        expect(response).toEqual(created);
      },
    );
  });

  describe('when called', () => {
    it('posts trace-level feedback without a spanId', async () => {
      const onPost = vi.fn<(body: Record<string, unknown>) => void>();
      server.use(
        http.post(FEEDBACK_URL, async ({ request }) => {
          onPost((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ success: true });
        }),
      );

      const { result } = renderHook(() => useCreateFeedback({ traceId: TRACE_ID }), { wrapper: makeWrapper() });

      await result.current.mutateAsync({ text: 'looks good' });

      expect(onPost).toHaveBeenCalledWith({
        feedback: {
          feedbackId: expect.any(String),
          timestamp: expect.any(String),
          traceId: TRACE_ID,
          feedbackType: 'comment',
          feedbackSource: 'user',
          value: 'looks good',
        },
      });
      expect(onPost.mock.calls[0][0].feedback).not.toHaveProperty('spanId');
    });
  });

  describe('when provided', () => {
    it('includes the spanId', async () => {
      const onPost = vi.fn<(body: Record<string, unknown>) => void>();
      server.use(
        http.post(FEEDBACK_URL, async ({ request }) => {
          onPost((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ success: true });
        }),
      );

      const { result } = renderHook(() => useCreateFeedback({ traceId: TRACE_ID, spanId: SPAN_ID }), {
        wrapper: makeWrapper(),
      });

      await result.current.mutateAsync({ text: 'span comment' });

      expect(onPost).toHaveBeenCalledWith({
        feedback: expect.objectContaining({ traceId: TRACE_ID, spanId: SPAN_ID }),
      });
    });
  });

  describe('when after a successful submit', () => {
    it('refetches the trace feedback list', async () => {
      const onList = vi.fn();
      server.use(
        http.get(FEEDBACK_URL, () => {
          onList();
          return HttpResponse.json(mixedFeedbackResponse);
        }),
        http.post(FEEDBACK_URL, () => HttpResponse.json({ success: true })),
      );

      const wrapper = makeWrapper();
      const { result } = renderHook(
        () => ({
          list: useTraceFeedback({ traceId: TRACE_ID }),
          create: useCreateFeedback({ traceId: TRACE_ID }),
        }),
        { wrapper },
      );

      await waitFor(() => expect(onList).toHaveBeenCalledTimes(1));

      await result.current.create.mutateAsync({ text: 'hello' });

      await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
    });
  });

  describe('when after a successful submit', () => {
    it('refetches the span feedback list', async () => {
      const onList = vi.fn();
      server.use(
        http.get(FEEDBACK_URL, () => {
          onList();
          return HttpResponse.json(spanFeedbackResponse);
        }),
        http.post(FEEDBACK_URL, () => HttpResponse.json({ success: true })),
      );

      const wrapper = makeWrapper();
      const { result } = renderHook(
        () => ({
          list: useSpanFeedback({ traceId: TRACE_ID, spanId: SPAN_ID }),
          create: useCreateFeedback({ traceId: TRACE_ID, spanId: SPAN_ID }),
        }),
        { wrapper },
      );

      await waitFor(() => expect(onList).toHaveBeenCalledTimes(1));

      await result.current.create.mutateAsync({ text: 'hello span' });

      await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
    });
  });
});

// The write acknowledges publication before the read store has ingested the record (OBS-827).
describe.each([undefined, SPAN_ID])('when delayed feedback ingestion affects span %s', spanId => {
  type ListResponse = Awaited<ReturnType<MastraClient['listFeedback']>>;
  const empty = emptySerializedFeedbackResponse;
  const readKey = spanId ? ['span-feedback', TRACE_ID, spanId] : ['trace-feedback', TRACE_ID];
  const useFeedback = () => {
    const trace = useTraceFeedback({ traceId: TRACE_ID, queryOptions: { enabled: !spanId } });
    const span = useSpanFeedback({ traceId: TRACE_ID, spanId, queryOptions: { enabled: !!spanId } });
    return spanId ? span : trace;
  };

  describe('when writes finish before feedback becomes readable', () => {
    it('shows acknowledged comments through stale refetches and remounts, then reconciles without duplicates', async () => {
      let readable: ListResponse = empty;
      let nextId = 0;
      const acknowledged: ListResponse['feedback'] = [];
      server.use(
        http.get(FEEDBACK_URL, ({ request }) => {
          if (new URL(request.url).searchParams.get('page') === '1') {
            return HttpResponse.json({ ...empty, pagination: { ...empty.pagination!, page: 1 } });
          }
          return HttpResponse.json(readable);
        }),
        http.post(FEEDBACK_URL, async ({ request }) => {
          const body = await request.json();
          const response = createdFeedbackResponse(spanId);
          response.data!.feedbackId = `saved-${++nextId}`;
          const record = submittedFeedbackRecord(
            nextId === 1 ? 'first comment' : 'second comment',
            response.data!.feedbackId!,
            spanId,
          );
          acknowledged.unshift(record);
          expect(body).toHaveProperty('feedback.value', record.value);
          return HttpResponse.json(response);
        }),
        http.delete(FEEDBACK_URL, () => {
          readable = empty;
          return HttpResponse.json({ success: true });
        }),
      );
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const wrapper = makeWrapper(queryClient);
      const hooks = () => ({
        list: useFeedback(),
        create: useCreateFeedback({ traceId: TRACE_ID, spanId }),
        remove: useDeleteFeedback({ traceId: TRACE_ID, spanId }),
        laterPage: useSpanFeedback({ traceId: TRACE_ID, spanId, page: 1, queryOptions: { enabled: !!spanId } }),
        unrelated: useSpanFeedback({ traceId: TRACE_ID, spanId: 'other-span' }),
      });
      const initial = renderHook(hooks, { wrapper });
      await waitFor(() => expect(initial.result.current.list.isSuccess).toBe(true));
      await act(() => initial.result.current.create.mutateAsync({ text: 'first comment' }));
      await waitFor(() => expect(initial.result.current.list.data?.feedback).toEqual(acknowledged));
      await act(() => queryClient.invalidateQueries({ queryKey: readKey }));
      expect(initial.result.current.list.data?.feedback).toEqual(acknowledged);
      initial.unmount();
      const { result } = renderHook(hooks, { wrapper });
      await waitFor(() => expect(result.current.list.data?.feedback).toEqual(acknowledged));
      await act(() => result.current.create.mutateAsync({ text: 'second comment' }));
      await waitFor(() => expect(result.current.list.data?.feedback).toEqual(acknowledged));
      expect(result.current.list.data?.pagination?.total).toBe(2);
      expect(result.current.unrelated.data?.feedback).toEqual([]);
      if (spanId) expect(result.current.laterPage.data?.feedback).toEqual([]);

      readable = {
        ...empty,
        feedback: acknowledged.map(row => ({ ...row, reviewStatus: 'reviewed' })),
        pagination: { ...empty.pagination!, total: 2 },
      };
      await act(() => queryClient.invalidateQueries({ queryKey: readKey }));
      await waitFor(() => expect(result.current.list.data?.feedback).toEqual(readable.feedback));
      expect(result.current.list.data?.pagination?.total).toBe(2);
      // Once confirmed, later deletion must not resurrect locally submitted records.
      await act(() => result.current.remove.mutateAsync({ feedbackId: 'saved-1' }));
      await waitFor(() => expect(result.current.list.data?.feedback).toEqual([]));
      queryClient.clear();
    });

    it('forgets an unconfirmed comment after deletion and keeps submissions scoped to their query client', async () => {
      server.use(
        http.get(FEEDBACK_URL, () => HttpResponse.json(empty)),
        http.post(FEEDBACK_URL, () => HttpResponse.json(createdFeedbackResponse(spanId))),
        http.delete(FEEDBACK_URL, () => HttpResponse.json({ success: true })),
      );
      const { result } = renderHook(
        () => ({
          list: useFeedback(),
          create: useCreateFeedback({ traceId: TRACE_ID, spanId }),
          remove: useDeleteFeedback({ traceId: TRACE_ID, spanId }),
        }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
      await act(() => result.current.create.mutateAsync({ text: 'comment' }));
      await waitFor(() => expect(result.current.list.data?.feedback).toHaveLength(1));
      const other = renderHook(useFeedback, { wrapper: makeWrapper() });
      await waitFor(() => expect(other.result.current.data?.feedback).toEqual([]));
      await act(() => result.current.remove.mutateAsync({ feedbackId: 'created-feedback' }));
      await waitFor(() => expect(result.current.list.data?.feedback).toEqual([]));
      await act(() => result.current.list.refetch());
      expect(result.current.list.data?.feedback).toEqual([]);
    });

    it('does not add a comment when saving fails', async () => {
      server.use(
        http.get(FEEDBACK_URL, () => HttpResponse.json(empty)),
        http.post(FEEDBACK_URL, () => HttpResponse.json({ error: 'Unavailable' }, { status: 400 })),
      );
      const { result } = renderHook(
        () => ({ list: useFeedback(), create: useCreateFeedback({ traceId: TRACE_ID, spanId }) }),
        { wrapper: makeWrapper() },
      );
      await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
      await act(async () => {
        await expect(result.current.create.mutateAsync({ text: 'failed' })).rejects.toThrow();
      });
      expect(result.current.list.data?.feedback).toEqual([]);
    });
  });
});
