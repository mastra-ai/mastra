import { useState } from 'react';

import { useCreateFeedback } from '../hooks/use-create-feedback';
import { useDeleteFeedback } from '../hooks/use-delete-feedback';
import { useSpanFeedback } from '../hooks/use-span-feedback';
import { FeedbackThread } from './feedback-thread';
import { useUpdateFeedbackReviewStatus } from '@/domains/feedback/hooks/use-feedback';

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
  const { data, isLoading } = useSpanFeedback({ traceId, spanId, page });
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
