// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSpanFeedback } from '../use-span-feedback';
import { useTraceFeedback } from '../use-trace-feedback';
import {
  mixedFeedbackResponse,
  otherSpanFeedbackResponse,
  OTHER_SPAN_ID,
  SPAN_ID,
  spanFeedbackResponse,
  TRACE_ID,
} from './fixtures/trace-feedback';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const FEEDBACK_URL = `${BASE_URL}/api/observability/feedback`;

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

afterEach(() => cleanup());

describe('useSpanFeedback', () => {
  it('scopes the request to the traceId + spanId pair', async () => {
    const onRequest = vi.fn<(url: URL) => void>();
    server.use(
      http.get(FEEDBACK_URL, ({ request }) => {
        onRequest(new URL(request.url));
        return HttpResponse.json(spanFeedbackResponse);
      }),
    );

    const { result } = renderHook(() => useSpanFeedback({ traceId: TRACE_ID, spanId: SPAN_ID }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data?.feedback).toHaveLength(1));

    const url = onRequest.mock.calls[0][0];
    const params = url.searchParams;
    const serialized = params.toString();
    expect(serialized).toContain(TRACE_ID);
    expect(serialized).toContain(SPAN_ID);
  });

  it('does not share cached results between two spans of the same trace', async () => {
    server.use(
      http.get(FEEDBACK_URL, ({ request }) => {
        const serialized = new URL(request.url).searchParams.toString();
        return HttpResponse.json(serialized.includes(OTHER_SPAN_ID) ? otherSpanFeedbackResponse : spanFeedbackResponse);
      }),
    );

    const wrapper = makeWrapper();
    const { result, rerender } = renderHook(
      ({ spanId }: { spanId: string }) => useSpanFeedback({ traceId: TRACE_ID, spanId }),
      {
        wrapper,
        initialProps: { spanId: SPAN_ID },
      },
    );

    await waitFor(() => expect(result.current.data?.feedback[0]?.feedbackId).toBe('span-a-feedback'));

    rerender({ spanId: OTHER_SPAN_ID });

    await waitFor(() => expect(result.current.data?.feedback[0]?.feedbackId).toBe('span-b-feedback'));
  });

  it('does not fetch without a spanId', async () => {
    const onRequest = vi.fn();
    server.use(
      http.get(FEEDBACK_URL, () => {
        onRequest();
        return HttpResponse.json(spanFeedbackResponse);
      }),
    );

    const { result } = renderHook(() => useSpanFeedback({ traceId: TRACE_ID }), { wrapper: makeWrapper() });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onRequest).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});

describe('useTraceFeedback', () => {
  it('keeps only trace-level feedback and counts that subset', async () => {
    server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(mixedFeedbackResponse)));

    const { result } = renderHook(() => useTraceFeedback({ traceId: TRACE_ID }), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.feedback.map(f => f.feedbackId)).toEqual(['trace-level-undefined', 'trace-level-null']);
    expect(result.current.data!.pagination.total).toBe(2);
  });

  it('never sends a spanId filter', async () => {
    const onRequest = vi.fn<(url: URL) => void>();
    server.use(
      http.get(FEEDBACK_URL, ({ request }) => {
        onRequest(new URL(request.url));
        return HttpResponse.json(mixedFeedbackResponse);
      }),
    );

    renderHook(() => useTraceFeedback({ traceId: TRACE_ID }), { wrapper: makeWrapper() });

    await waitFor(() => expect(onRequest).toHaveBeenCalled());
    expect(onRequest.mock.calls[0][0].searchParams.toString()).not.toContain('spanId');
  });
});
