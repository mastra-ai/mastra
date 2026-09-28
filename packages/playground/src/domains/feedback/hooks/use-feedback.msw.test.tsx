import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { useUpdateFeedbackReviewStatus } from './use-feedback';
import {
  feedbackRecord,
  listFeedbackResponse,
  TRACE_ID,
} from '@/domains/traces/hooks/__tests__/fixtures/trace-feedback';
import { useTraceFeedback } from '@/domains/traces/hooks/use-trace-feedback';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

const FEEDBACK_URL = `${TEST_BASE_URL}/api/observability/feedback`;

describe('useUpdateFeedbackReviewStatus', () => {
  describe('when the review status update succeeds', () => {
    it('patches the record and refetches the trace feedback thread', async () => {
      const record = feedbackRecord({ feedbackId: 'feedback-1' });
      const onList = vi.fn();
      const onPatch = vi.fn<(body: Record<string, unknown>) => void>();
      server.use(
        http.get(FEEDBACK_URL, () => {
          onList();
          return HttpResponse.json(listFeedbackResponse([record]));
        }),
        http.patch(`${FEEDBACK_URL}/feedback-1/review-status`, async ({ request }) => {
          onPatch((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({ ...record, reviewStatus: 'reviewed' });
        }),
      );

      const { result } = renderHookWithProviders(() => ({
        thread: useTraceFeedback({ traceId: TRACE_ID }),
        update: useUpdateFeedbackReviewStatus(),
      }));

      await waitFor(() => expect(onList).toHaveBeenCalledTimes(1));
      await result.current.update.mutateAsync({ feedbackId: 'feedback-1', reviewStatus: 'reviewed' });

      expect(onPatch).toHaveBeenCalledWith({ reviewStatus: 'reviewed' });
      await waitFor(() => expect(onList).toHaveBeenCalledTimes(2));
    });
  });
});
