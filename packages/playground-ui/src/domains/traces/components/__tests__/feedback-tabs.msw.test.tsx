// @vitest-environment jsdom
import type { CreateFeedbackBody } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  fireEvent.change(screen.getByPlaceholderText('Leave feedback'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
};

afterEach(() => cleanup());

describe('feedback tabs composer', () => {
  it.each(['trace', 'span'])('keeps the draft and shows a failed %s submission', async scope => {
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse([]))),
      http.post(FEEDBACK_URL, () => HttpResponse.json({ error: 'Trace not found' }, { status: 404 })),
    );
    render(
      scope === 'span' ? (
        <SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />
      ) : (
        <TraceFeedbackTab traceId={TRACE_ID} />
      ),
      { wrapper },
    );
    submit('Keep this draft');
    expect((await screen.findByRole('alert')).textContent).toContain('Could not save feedback');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Leave feedback' }).value).toBe('Keep this draft');
  });

  it.each(['trace', 'span'])('supports creation without unsupported actions in the %s composer', async scope => {
    const onPost = vi.fn<(body: unknown) => void>();
    server.use(
      http.get(FEEDBACK_URL, () =>
        HttpResponse.json(scope === 'span' ? spanFeedbackResponse : authoredFeedbackResponse),
      ),
      http.post(FEEDBACK_URL, async ({ request }) => {
        onPost(await request.json());
        return HttpResponse.json({ success: true });
      }),
    );
    const feedbackOptions = {
      contextMode: 'resolve',
      feedbackUserId: null,
      allowDelete: false,
      allowReview: false,
    } as const;
    render(
      scope === 'span' ? (
        <SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} feedbackOptions={feedbackOptions} />
      ) : (
        <TraceFeedbackTab traceId={TRACE_ID} feedbackOptions={feedbackOptions} />
      ),
      { wrapper },
    );
    await screen.findByText('Needs review');
    expect(screen.queryByRole('button', { name: 'Feedback actions' })).toBeNull();
    submit('Platform comment');
    await waitFor(() =>
      expect(onPost).toHaveBeenCalledWith({
        contextMode: 'resolve',
        feedback: {
          feedbackId: expect.any(String),
          timestamp: expect.any(String),
          traceId: TRACE_ID,
          ...(scope === 'span' ? { spanId: SPAN_ID } : {}),
          feedbackType: 'comment',
          feedbackSource: 'user',
          feedbackUserId: null,
          value: 'Platform comment',
        },
      }),
    );
  });

  it('submits span-scoped feedback and refetches the list', async () => {
    const onPost = vi.fn<(body: unknown) => void>();
    const onList = vi.fn();
    server.use(
      http.get(FEEDBACK_URL, () => {
        onList();
        return HttpResponse.json(spanFeedbackResponse);
      }),
      http.post(FEEDBACK_URL, async ({ request }) => {
        onPost(await request.json());
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
});

describe('feedback tabs pending comment', () => {
  it.each(['trace', 'span'])(
    'shows a %s comment the list does not return yet as sending, without actions',
    async scope => {
      // The POST is accepted but the list never returns the row (eventually consistent storage).
      server.use(
        http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse([]))),
        http.post(FEEDBACK_URL, () => HttpResponse.json({ success: true })),
      );
      render(
        scope === 'span' ? (
          <SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />
        ) : (
          <TraceFeedbackTab traceId={TRACE_ID} />
        ),
        { wrapper },
      );
      await screen.findByText('No feedback yet');

      submit('not stored yet');

      await screen.findByText('not stored yet');
      expect(screen.getByText('Sending…')).toBeTruthy();
      expect(screen.queryByText('Needs review')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Feedback actions' })).toBeNull();
    },
  );

  it('gives the comment its actions once the list returns it', async () => {
    let stored: ReturnType<typeof feedbackRecord>[] = [];
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse(stored))),
      http.post(FEEDBACK_URL, async ({ request }) => {
        const { feedback } = (await request.json()) as CreateFeedbackBody;
        stored = [feedbackRecord({ feedbackId: feedback.feedbackId, feedbackType: 'comment', value: 'now stored' })];
        return HttpResponse.json({ success: true });
      }),
    );
    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });
    await screen.findByText('No feedback yet');

    submit('now stored');

    // The post-submit refetch returns the stored record, which replaces the pending one.
    await screen.findByRole('button', { name: 'Feedback actions' });
    expect(screen.getAllByText('now stored')).toHaveLength(1);
    expect(screen.queryByText('Sending…')).toBeNull();
  });
});

describe('feedback tabs delete', () => {
  it('confirms a span feedback deletion, shows its pending state, and refetches the list', async () => {
    const onDelete = vi.fn<(body: unknown) => void>();
    const onList = vi.fn();
    let resolveDelete: (() => void) | undefined;
    let listResponse = spanFeedbackResponse;
    server.use(
      http.get(FEEDBACK_URL, () => {
        onList();
        return HttpResponse.json(listResponse);
      }),
      http.delete(FEEDBACK_URL, async ({ request }) => {
        onDelete(await request.json());
        await new Promise<void>(resolve => {
          resolveDelete = resolve;
        });
        listResponse = listFeedbackResponse([]);
        return HttpResponse.json({ success: true });
      }),
    );

    render(<SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />, { wrapper });
    await waitFor(() => expect(onList).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Feedback actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete feedback' }));

    expect(screen.getByRole('heading', { name: 'Delete feedback?' })).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    expect(onDelete.mock.calls[0][0]).toEqual({ feedbackIds: ['span-a-feedback'] });
    expect(screen.getByRole('button', { name: 'Deleting…' }).getAttribute('disabled')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Delete feedback?' })).toBeTruthy();

    resolveDelete?.();

    // Invalidation refetches; the emptied list drops the record from the thread.
    await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Delete feedback?' })).toBeNull());
    expect(screen.getByText('No feedback yet')).toBeTruthy();
  });

  it('deletes a trace-level feedback record by feedbackId after confirmation', async () => {
    const onDelete = vi.fn<(body: unknown) => void>();
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse([feedbackRecord({ feedbackId: 'fb-42' })]))),
      http.delete(FEEDBACK_URL, async ({ request }) => {
        onDelete(await request.json());
        return HttpResponse.json({ success: true });
      }),
    );

    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Feedback actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete feedback' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    expect(onDelete.mock.calls[0][0]).toEqual({ feedbackIds: ['fb-42'] });
  });

  it('cancels feedback deletion without sending a request', async () => {
    const onDelete = vi.fn();
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(spanFeedbackResponse)),
      http.delete(FEEDBACK_URL, () => {
        onDelete();
        return HttpResponse.json({ success: true });
      }),
    );

    render(<SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Feedback actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete feedback' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Delete feedback?' })).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('keeps the confirmation open after a failed deletion so it can be retried', async () => {
    const onDelete = vi.fn();
    // The client retries 5xx on its own, so fail every attempt until the user retries —
    // failing only the first call let the automatic retry succeed and close the dialog.
    let failDeletes = true;
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(spanFeedbackResponse)),
      http.delete(FEEDBACK_URL, () => {
        onDelete();
        return failDeletes
          ? HttpResponse.json({ error: 'Delete failed' }, { status: 500 })
          : HttpResponse.json({ success: true });
      }),
    );

    render(<SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Feedback actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete feedback' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    // The button reads "Deleting…" until the failed request (and its retries) settle.
    const retryButton = await screen.findByRole('button', { name: 'Delete' }, { timeout: 5000 });
    expect(screen.getByRole('heading', { name: 'Delete feedback?' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Could not delete feedback');

    failDeletes = false;
    const failedAttempts = onDelete.mock.calls.length;
    fireEvent.click(retryButton);

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(failedAttempts + 1));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Delete feedback?' })).toBeNull());
  });

  it('does not show a failed deletion error when the confirmation is opened again', async () => {
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(spanFeedbackResponse)),
      http.delete(FEEDBACK_URL, () => HttpResponse.json({ error: 'Delete failed' }, { status: 500 })),
    );

    render(<SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Feedback actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete feedback' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not delete feedback'), {
      timeout: 5000,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Delete feedback?' })).toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: 'Feedback actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete feedback' }));

    expect(await screen.findByRole('heading', { name: 'Delete feedback?' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows no delete action for records without a feedbackId', async () => {
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse([feedbackRecord({ feedbackId: null })]))),
    );

    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });
    await screen.findByText('👍');

    expect(screen.queryByRole('button', { name: 'Feedback actions' })).toBeNull();
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
  const reviewFlow = (needsReview: typeof authoredFeedbackResponse, reviewed: typeof authoredFeedbackResponse) => {
    const onList = vi.fn();
    const onPatch = vi.fn<(feedbackId: string, body: unknown) => void>();
    let isReviewed = false;
    server.use(
      http.get(FEEDBACK_URL, () => {
        onList();
        return HttpResponse.json(isReviewed ? reviewed : needsReview);
      }),
      http.patch(REVIEW_STATUS_URL, async ({ params, request }) => {
        onPatch(String(params.feedbackId), await request.json());
        isReviewed = true;
        return HttpResponse.json({ success: true });
      }),
    );
    return { onList, onPatch };
  };

  it('marks trace feedback reviewed and refetches the thread', async () => {
    const { onList, onPatch } = reviewFlow(authoredFeedbackResponse, reviewedFeedbackResponse);

    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });
    await screen.findByText('Needs review');

    fireEvent.click(screen.getByRole('button', { name: 'Feedback actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mark reviewed' }));

    await waitFor(() => expect(onPatch).toHaveBeenCalledWith('authored', { reviewStatus: 'reviewed' }));
    expect(await screen.findByText('Reviewed')).toBeTruthy();
    expect(onList).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Feedback actions' }));
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: 'Mark reviewed' })).toBeNull();
  });

  it('marks span feedback reviewed and refetches the thread', async () => {
    const reviewedSpanResponse = listFeedbackResponse([
      feedbackRecord({ feedbackId: 'span-a-feedback', spanId: SPAN_ID, reviewStatus: 'reviewed' }),
    ]);
    const { onList, onPatch } = reviewFlow(spanFeedbackResponse, reviewedSpanResponse);

    render(<SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />, { wrapper });
    await screen.findByText('Needs review');

    fireEvent.click(screen.getByRole('button', { name: 'Feedback actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mark reviewed' }));

    await waitFor(() => expect(onPatch).toHaveBeenCalledWith('span-a-feedback', { reviewStatus: 'reviewed' }));
    expect(await screen.findByText('Reviewed')).toBeTruthy();
    expect(onList).toHaveBeenCalledTimes(2);
  });
});

describe('feedback tabs queued delete', () => {
  afterEach(() => vi.useRealTimers());

  /** The server accepts the delete (202) but keeps returning the row until `applyDeletes()`. */
  function queuedDeleteServer() {
    let rows = [
      feedbackRecord({ feedbackId: 'keep', feedbackType: 'comment', value: 'keep me' }),
      feedbackRecord({ feedbackId: 'doomed', feedbackType: 'comment', value: 'delete me' }),
    ];
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse(rows))),
      http.delete(FEEDBACK_URL, () => HttpResponse.json({ accepted: true }, { status: 202 })),
    );
    return { applyDeletes: () => (rows = rows.filter(row => row.feedbackId !== 'doomed')) };
  }

  const rowOf = (text: string) => {
    const row = screen.getByText(text).closest<HTMLElement>('[data-slot="comment-item"]');
    if (!row) throw new Error(`No comment row for "${text}"`);
    return row;
  };

  async function deleteDoomed() {
    await screen.findByText('delete me');
    const [, doomedActions] = screen.getAllByRole('button', { name: 'Feedback actions' });
    fireEvent.click(doomedActions);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete feedback' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Delete feedback?' })).toBeNull());
  }

  describe('when the server accepts the delete and the cleanup job removes the row', () => {
    it('shows the row as deleting, without actions, until the server drops it', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const api = queuedDeleteServer();
      render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });

      await deleteDoomed();

      await waitFor(() => expect(within(rowOf('delete me')).getByText('Deleting…')).toBeTruthy());
      expect(within(rowOf('delete me')).queryByRole('button', { name: 'Feedback actions' })).toBeNull();
      expect(within(rowOf('keep me')).getByRole('button', { name: 'Feedback actions' })).toBeTruthy();

      api.applyDeletes();
      await act(() => vi.advanceTimersByTimeAsync(3_100));

      await waitFor(() => expect(screen.queryByText('delete me')).toBeNull());
      expect(screen.getByText('keep me')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('when the server still returns the row after the deletion window', () => {
    it('restores the row with its actions and shows an error', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      queuedDeleteServer();
      render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });

      await deleteDoomed();
      await waitFor(() => expect(within(rowOf('delete me')).getByText('Deleting…')).toBeTruthy());

      await act(() => vi.advanceTimersByTimeAsync(5 * 60_000 + 1));

      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not delete feedback'));
      expect(within(rowOf('delete me')).queryByText('Deleting…')).toBeNull();
      expect(within(rowOf('delete me')).getByRole('button', { name: 'Feedback actions' })).toBeTruthy();
    });
  });
});
