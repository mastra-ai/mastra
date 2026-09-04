import type { CommentVariant } from '@mastra/playground-ui/components/Comment';
import { useState } from 'react';

import { useCreateFeedback } from '../hooks/use-create-feedback';
import { useTraceFeedback } from '../hooks/use-trace-feedback';
import { FeedbackThread } from './feedback-thread';

type TraceFeedbackTabProps = {
  traceId: string;
  /** Comment layout variant — forwarded to `FeedbackThread`. */
  variant?: CommentVariant;
};

/**
 * Trace-level feedback (no span). Owns its own pagination: mount it with a `key`
 * on the trace id so a page index never leaks across traces.
 */
export function TraceFeedbackTab({ traceId, variant }: TraceFeedbackTabProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useTraceFeedback({ traceId, page });
  const { mutateAsync, isPending } = useCreateFeedback({ traceId });

  return (
    <FeedbackThread
      feedbackData={data}
      isLoadingFeedbackData={isLoading}
      onPageChange={setPage}
      onSubmit={text => mutateAsync({ text })}
      isSubmitting={isPending}
      variant={variant}
    />
  );
}
