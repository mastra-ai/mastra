// @vitest-environment jsdom
import '../../../test/jsdom-polyfills';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { useCreateFeedback } from '../use-create-feedback';
import { useSpanFeedback } from '../use-span-feedback';
import { useTraceFeedback } from '../use-trace-feedback';
import { mixedFeedbackResponse, SPAN_ID, spanFeedbackResponse, TRACE_ID } from './fixtures/trace-feedback';

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

afterEach(() => cleanup());

describe('useCreateFeedback', () => {
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
