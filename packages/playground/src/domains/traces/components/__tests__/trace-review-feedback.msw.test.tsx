// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TraceReviewFeedback } from '../trace-review-feedback';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderForm = (props?: Partial<Parameters<typeof TraceReviewFeedback>[0]>) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TraceReviewFeedback traceId="trace-a" spanId="span-a" {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('TraceReviewFeedback', () => {
  describe('when the reviewer submits an assessment with a note', () => {
    it('posts the review as trace feedback', async () => {
      const onFeedback = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${BASE_URL}/api/observability/feedback`, async ({ request }) => {
          onFeedback(await request.json());
          return HttpResponse.json({ success: true });
        }),
      );

      renderForm({ target: 'response' });

      fireEvent.click(screen.getByRole('radio', { name: 'Needs correction' }));
      fireEvent.change(screen.getByLabelText(/note/i), { target: { value: 'Missing red flags.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save review' }));

      await waitFor(() => expect(onFeedback).toHaveBeenCalledTimes(1));
      expect(onFeedback).toHaveBeenCalledWith({
        feedback: {
          traceId: 'trace-a',
          spanId: 'span-a',
          feedbackSource: 'studio',
          feedbackType: 'review',
          value: 0,
          comment: 'Missing red flags.',
          metadata: { reviewTarget: 'response' },
        },
      });
    });
  });

  describe('when no assessment is selected', () => {
    it('keeps the save button disabled', () => {
      renderForm();

      const saveButton = screen.getByRole('button', { name: 'Save review' });
      expect(saveButton.hasAttribute('disabled')).toBe(true);
    });
  });
});
