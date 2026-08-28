// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  feedbackRecord,
  listFeedbackResponse,
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
});

describe('feedback tabs delete', () => {
  it('deletes a span feedback record and refetches the list', async () => {
    const onDelete = vi.fn<(body: Record<string, unknown>) => void>();
    const onList = vi.fn();
    let listResponse = spanFeedbackResponse;
    server.use(
      http.get(FEEDBACK_URL, () => {
        onList();
        return HttpResponse.json(listResponse);
      }),
      http.delete(FEEDBACK_URL, async ({ request }) => {
        onDelete((await request.json()) as Record<string, unknown>);
        listResponse = listFeedbackResponse([]);
        return HttpResponse.json({ success: true });
      }),
    );

    render(<SpanFeedbackTab traceId={TRACE_ID} spanId={SPAN_ID} />, { wrapper });
    await waitFor(() => expect(onList).toHaveBeenCalledTimes(1));
    await screen.findByRole('button', { name: 'Delete feedback' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete feedback' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    expect(onDelete.mock.calls[0][0]).toEqual({ feedbackIds: ['span-a-feedback'] });
    // Invalidation refetches; the emptied list drops the record from the thread.
    await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete feedback' })).toBeNull());
    expect(screen.getByText('No feedback yet')).toBeTruthy();
  });

  it('deletes a trace-level feedback record by feedbackId', async () => {
    const onDelete = vi.fn<(body: Record<string, unknown>) => void>();
    server.use(
      http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse([feedbackRecord({ feedbackId: 'fb-42' })]))),
      http.delete(FEEDBACK_URL, async ({ request }) => {
        onDelete((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ success: true });
      }),
    );

    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });
    await screen.findByRole('button', { name: 'Delete feedback' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete feedback' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    expect(onDelete.mock.calls[0][0]).toEqual({ feedbackIds: ['fb-42'] });
  });

  it('shows no delete action for records without a feedbackId', async () => {
    server.use(
      http.get(FEEDBACK_URL, () =>
        HttpResponse.json(
          listFeedbackResponse([{ ...feedbackRecord({ feedbackId: 'ignored' }), feedbackId: null } as never]),
        ),
      ),
    );

    render(<TraceFeedbackTab traceId={TRACE_ID} />, { wrapper });
    await screen.findByText('👍');

    expect(screen.queryByRole('button', { name: 'Delete feedback' })).toBeNull();
  });
});
