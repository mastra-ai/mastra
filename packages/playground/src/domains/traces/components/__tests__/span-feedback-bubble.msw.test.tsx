import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { SPAN_ID, spanFeedbackResponse, TRACE_ID } from '../../hooks/__tests__/fixtures/trace-feedback';
import { SpanFeedbackBubble } from '../span-feedback-bubble';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const FEEDBACK_URL = `${TEST_BASE_URL}/api/observability/feedback`;

describe('SpanFeedbackBubble', () => {
  describe('when the span already has comments', () => {
    it('surfaces the count in the trigger label', () => {
      renderWithProviders(<SpanFeedbackBubble traceId={TRACE_ID} spanId={SPAN_ID} count={2} />);

      expect(screen.getByRole('button', { name: 'Comments on this step (2)' })).toBeTruthy();
    });
  });

  describe('when the span has no comments', () => {
    it('offers to add one', () => {
      renderWithProviders(<SpanFeedbackBubble traceId={TRACE_ID} spanId={SPAN_ID} />);

      expect(screen.getByRole('button', { name: 'Add a comment on this step' })).toBeTruthy();
    });
  });

  describe('when the popover stays closed', () => {
    it('does not query the span thread', async () => {
      const onRequest = vi.fn();
      server.use(
        http.get(FEEDBACK_URL, () => {
          onRequest();
          return HttpResponse.json(spanFeedbackResponse);
        }),
      );

      renderWithProviders(<SpanFeedbackBubble traceId={TRACE_ID} spanId={SPAN_ID} />);

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(onRequest).not.toHaveBeenCalled();
    });
  });

  describe('when the popover is opened', () => {
    it('renders the span thread as an embedded comment', async () => {
      server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(spanFeedbackResponse)));

      renderWithProviders(<SpanFeedbackBubble traceId={TRACE_ID} spanId={SPAN_ID} count={1} />);
      fireEvent.click(screen.getByRole('button', { name: 'Comments on this step (1)' }));

      await waitFor(() => expect(document.querySelector('[data-slot="comment"]')).toBeTruthy());
      expect(document.querySelector('[data-slot="comment"]')?.getAttribute('data-variant')).toBe('embed');
    });
  });

  describe('when a comment is submitted from the popover', () => {
    it('posts feedback carrying the traceId and spanId', async () => {
      const onPost = vi.fn<(body: Record<string, unknown>) => void>();
      server.use(
        http.get(FEEDBACK_URL, () => HttpResponse.json(spanFeedbackResponse)),
        http.post(FEEDBACK_URL, async ({ request }) => {
          onPost((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ success: true });
        }),
      );

      const { queryClient } = renderWithProviders(<SpanFeedbackBubble traceId={TRACE_ID} spanId={SPAN_ID} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add a comment on this step' }));

      const input = await screen.findByPlaceholderText('Leave feedback...');
      fireEvent.change(input, { target: { value: 'this step is wrong' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

      await waitFor(() => expect(onPost).toHaveBeenCalled());
      expect(onPost.mock.calls[0][0].feedback).toMatchObject({
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        value: 'this step is wrong',
      });

      await waitForMutationsIdle(queryClient);
    });
  });
});
