import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  feedbackRecord,
  listFeedbackResponse,
  mixedFeedbackResponse,
  TRACE_ID,
} from '../../hooks/__tests__/fixtures/trace-feedback';
import { TraceFeedbackDisclosure } from '../trace-feedback-disclosure';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const FEEDBACK_URL = `${TEST_BASE_URL}/api/observability/feedback`;

describe('TraceFeedbackDisclosure', () => {
  describe('when the turn has no feedback', () => {
    it('invites the reader to leave some', async () => {
      server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse([]))));

      renderWithProviders(<TraceFeedbackDisclosure traceId={TRACE_ID} />);

      expect(await screen.findByRole('button', { name: 'Add feedback to this turn' })).toBeTruthy();
    });
  });

  describe('when the turn already has feedback', () => {
    it('counts only the trace-level records, leaving span comments to their own bubbles', async () => {
      server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(mixedFeedbackResponse)));

      renderWithProviders(<TraceFeedbackDisclosure traceId={TRACE_ID} />);

      expect(await screen.findByRole('button', { name: '2 feedbacks on this turn' })).toBeTruthy();
    });

    it('speaks of a lone record in the singular', async () => {
      server.use(
        http.get(FEEDBACK_URL, () => HttpResponse.json(listFeedbackResponse([feedbackRecord({ feedbackId: 'one' })]))),
      );

      renderWithProviders(<TraceFeedbackDisclosure traceId={TRACE_ID} />);

      expect(await screen.findByRole('button', { name: '1 feedback on this turn' })).toBeTruthy();
    });
  });

  describe('while it stays collapsed', () => {
    it('keeps the thread out of the page', async () => {
      server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(mixedFeedbackResponse)));

      renderWithProviders(<TraceFeedbackDisclosure traceId={TRACE_ID} />);

      await screen.findByRole('button', { name: '2 feedbacks on this turn' });
      expect(screen.queryByPlaceholderText(/feedback/i)).toBeNull();
    });
  });

  describe('when it is expanded', () => {
    it('reveals the comment thread', async () => {
      server.use(http.get(FEEDBACK_URL, () => HttpResponse.json(mixedFeedbackResponse)));

      renderWithProviders(<TraceFeedbackDisclosure traceId={TRACE_ID} />);
      fireEvent.click(await screen.findByRole('button', { name: '2 feedbacks on this turn' }));

      await waitFor(() => expect(document.querySelector('[data-slot="comment"]')).toBeTruthy());
    });
  });
});
