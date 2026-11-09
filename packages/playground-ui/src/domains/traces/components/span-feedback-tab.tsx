import { useUpdateFeedbackReviewStatus } from '@mastra/react/hooks/feedback';
import { useCreateFeedback, useDeleteFeedback, useSpanFeedback } from '@mastra/react/hooks/traces';
import { useState } from 'react';

import type { FeedbackOptions } from './feedback-options';
import { FeedbackThread } from './feedback-thread';

type SpanFeedbackTabProps = {
  traceId: string;
  feedbackOptions?: FeedbackOptions;
  spanId: string;
};

/**
 * Feedback for a single span. Owns its own pagination: mount it with a `key`
 * on the trace/span pair so a page index never leaks across spans.
 */
export function SpanFeedbackTab({ traceId, spanId, feedbackOptions }: SpanFeedbackTabProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useSpanFeedback({
    traceId,
    spanId,
    page,
    queryOptions: { enabled: !!traceId && !!spanId },
  });
  const { mutateAsync, isPending, error } = useCreateFeedback({
    traceId,
    spanId,
    contextMode: feedbackOptions?.contextMode,
    feedbackUserId: feedbackOptions?.feedbackUserId,
  });
  const { mutateAsync: deleteFeedback, isPending: isDeleting } = useDeleteFeedback({ traceId, spanId });
  const updateReviewStatus = useUpdateFeedbackReviewStatus();

  return (
    <FeedbackThread
      feedbackData={data}
      isLoadingFeedbackData={isLoading}
      onPageChange={setPage}
      onSubmit={text => mutateAsync({ text })}
      isSubmitting={isPending}
      submitError={error ? 'Could not save feedback. Please try again.' : undefined}
      onDelete={feedbackOptions?.allowDelete === false ? undefined : feedbackId => deleteFeedback({ feedbackId })}
      isDeleting={isDeleting}
      onMarkReviewed={
        feedbackOptions?.allowReview === false
          ? undefined
          : feedbackId => updateReviewStatus.mutate({ feedbackId, reviewStatus: 'reviewed' })
      }
      pendingFeedbackId={updateReviewStatus.isPending ? updateReviewStatus.variables.feedbackId : undefined}
    />
  );
}

export type { FeedbackOptions } from './feedback-options';
