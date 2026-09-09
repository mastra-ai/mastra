// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  authoredFeedbackResponse,
  feedbackRecord,
  listFeedbackResponse,
  reviewedFeedbackResponse,
  SPAN_ID,
  spanFeedbackResponse,
  TRACE_ID,
} from '../../hooks/__tests__/fixtures/trace-feedback';
import { SpanFeedbackTab } from '../span-feedback-tab';
import { TraceFeedbackTab } from '../trace-feedback-tab';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const FEEDBACK_URL = `${BASE_URL}/api/observability/feedback`;

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const submit = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText('Leave feedback...'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
};

afterEach(() => cleanup());

describe('feedback tabs composer', () => {
  it('submits span-scoped feedback and refetches the list', async () => {
    const onPost = vi.fn<(body: Record<string, unknown>) => void>();
    const onList = vi.fn();
    server.use(
      http.get(FEEDBACK_URL, () => {
        onList();
        return HttpResponse.json(spanFeedbackResponse);
      }),
      http.post(FEEDBACK_URL, async ({ request }) => {
        onPost((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ success: true });
      }),
    );

    render(<SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />, { wrapper });
    await waitFor(() => expect(onList).toHaveBeenCalledTimes(1));

    submit('span note');

    await waitFor(() => expect(onPost).toHaveBeenCalled());
    expect(onPost.mock.calls[0][0]).toMatchObject({
      feedback: { traceId: TRACE_ID, spanId: SPAN_ID, value: 'span note' },
    });
    await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
  });

  it('submits trace-level feedback without a spanId', async () => {
    const onPost = vi.fn<(body: Record<string, unknown>) => void>();
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(spanFeedbackResponse)),
      http.post(FEEDBACK_URL, async ({ request }) => {
        onPost((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ success: true });
      }),
    );

    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });

    submit('trace note');

    await waitFor(() => expect(onPost).toHaveBeenCalled());
    expect(onPost.mock.calls[0][0]).toMatchObject({ feedback: { traceId: TRACE_ID, value: 'trace note' } });
    expect((onPost.mock.calls[0][0] as { feedback: object }).feedback).not.toHaveProperty('spanId');
  });

  it('shows the resolved author avatar and name on trace feedback', async () => {
    server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(authoredFeedbackResponse)));

    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });

    expect((await screen.findByText('Marvin Frachet')).getAttribute('data-slot')).toBe('comment-item-author');
    expect((screen.getByAltText('Marvin Frachet') as HTMLImageElement).src).toBe('https://example.com/marvin.png');
    expect(screen.getByText('Looks off to me')).toBeTruthy();
  });
});

describe('feedback tabs review status', () => {
  const REVIEW_STATUS_URL = `${FEEDBACK_URL}/:feedbackId/review-status`;

  /** GET serves `needsReview` until the PATCH lands, then `reviewed` — mirroring the server. */
  const reviewFlow = (needsReview: unknown, reviewed: unknown) => {
    const onList = vi.fn();
    const onPatch = vi.fn<(feedbackId: string, body: Record<string, unknown>) => void>();
    let isReviewed = false;
    server.use(
      http.get(FEEDBACK_URL, () => {
        onList();
        return HttpResponse.json(isReviewed ? reviewed : needsReview);
      }),
      http.patch(REVIEW_STATUS_URL, async ({ params, request }) => {
        onPatch(params.feedbackId as string, (await request.json()) as Record<string, unknown>);
        isReviewed = true;
        return HttpResponse.json({ success: true });
      }),
    );
    return { onList, onPatch };
  };

  it('shows the review status of trace feedback', async () => {
    server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(authoredFeedbackResponse)));
    const { unmount } = render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });
    expect(await screen.findByText('Needs review')).toBeTruthy();
    unmount();

    server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(reviewedFeedbackResponse)));
    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });
    expect(await screen.findByText('Reviewed')).toBeTruthy();
  });

  it('marks trace feedback reviewed and refetches the thread', async () => {
    const { onList, onPatch } = reviewFlow(authoredFeedbackResponse, reviewedFeedbackResponse);

    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });
    await screen.findByText('Needs review');

    fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }));

    await waitFor(() => expect(onPatch).toHaveBeenCalledWith('authored', { reviewStatus: 'reviewed' }));
    expect(await screen.findByText('Reviewed')).toBeTruthy();
    expect(onList).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Mark reviewed' })).toBeNull();
  });

  it('marks span feedback reviewed and refetches the thread', async () => {
    const reviewedSpanResponse = listFeedbackResponse([
      feedbackRecord({ feedbackId: 'span-a-feedback', spanId: SPAN_ID, reviewStatus: 'reviewed' }),
    ]);
    const { onList, onPatch } = reviewFlow(spanFeedbackResponse, reviewedSpanResponse);

    render(<SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />, { wrapper });
    await screen.findByText('Needs review');

    fireEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }));

    await waitFor(() => expect(onPatch).toHaveBeenCalledWith('span-a-feedback', { reviewStatus: 'reviewed' }));
    expect(await screen.findByText('Reviewed')).toBeTruthy();
    expect(onList).toHaveBeenCalledTimes(2);
  });
});
