import {
  useCreateFeedback,
  useDeleteFeedback,
  useSpanFeedback,
  useUpdateFeedbackReviewStatus,
} from '@mastra/react/hooks';
import { useState } from 'react';

import { FeedbackThread } from './feedback-thread';

type SpanFeedbackTabProps = {
  traceId: string;
  spanId: string;
};

/**
 * Feedback for a single span. Owns its own pagination: mount it with a `key`
 * on the trace/span pair so a page index never leaks across spans.
 */
export function SpanFeedbackTab({ traceId, spanId }: SpanFeedbackTabProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useSpanFeedback({
    traceId,
    spanId,
    page,
    queryOptions: { enabled: !!traceId && !!spanId },
  });
  const { mutateAsync, isPending } = useCreateFeedback({ traceId, spanId });
  const { mutateAsync: deleteFeedback, isPending: isDeleting } = useDeleteFeedback({ traceId, spanId });
  const updateReviewStatus = useUpdateFeedbackReviewStatus();

  return (
    <FeedbackThread
      feedbackData={data}
      isLoadingFeedbackData={isLoading}
      onPageChange={setPage}
      onSubmit={text => mutateAsync({ text })}
      isSubmitting={isPending}
      onDelete={feedbackId => deleteFeedback({ feedbackId })}
      isDeleting={isDeleting}
      onMarkReviewed={feedbackId => updateReviewStatus.mutate({ feedbackId, reviewStatus: 'reviewed' })}
      pendingFeedbackId={updateReviewStatus.isPending ? updateReviewStatus.variables.feedbackId : undefined}
    />
  );
}
