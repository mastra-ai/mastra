import { useUpdateFeedbackReviewStatus } from '@mastra/react/hooks/feedback';
import { useCreateFeedback, useDeleteFeedback, useTraceFeedback } from '@mastra/react/hooks/traces';
import { useState } from 'react';

import type { FeedbackOptions } from './feedback-options';
import { FeedbackThread } from './feedback-thread';
import type { CommentVariant } from '@/ds/components/Comment';

type TraceFeedbackTabProps = {
  traceId: string;
  feedbackOptions?: FeedbackOptions;
  /** Comment layout variant — forwarded to `FeedbackThread`. */
  variant?: CommentVariant;
};

/**
 * Trace-level feedback (no span). Owns its own pagination: mount it with a `key`
 * on the trace id so a page index never leaks across traces.
 */
export function TraceFeedbackTab({ traceId, variant, feedbackOptions }: TraceFeedbackTabProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useTraceFeedback({ traceId, page, queryOptions: { enabled: !!traceId } });
  const { mutateAsync, isPending, error } = useCreateFeedback({
    traceId,
    contextMode: feedbackOptions?.contextMode,
    feedbackUserId: feedbackOptions?.feedbackUserId,
  });
  const { mutateAsync: deleteFeedback, isPending: isDeleting } = useDeleteFeedback({ traceId });
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
      variant={variant}
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
