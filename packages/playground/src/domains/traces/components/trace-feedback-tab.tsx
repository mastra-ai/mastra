import { useState } from 'react';

import { useCreateFeedback } from '../hooks/use-create-feedback';
import { useDeleteFeedback } from '../hooks/use-delete-feedback';
import { useTraceFeedback } from '../hooks/use-trace-feedback';
import { FeedbackThread } from './feedback-thread';

type TraceFeedbackTabProps = {
  traceId: string;
};

/**
 * Trace-level feedback (no span). Owns its own pagination: mount it with a `key`
 * on the trace id so a page index never leaks across traces.
 */
export function TraceFeedbackTab({ traceId }: TraceFeedbackTabProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useTraceFeedback({ traceId, page });
  const { mutateAsync, isPending } = useCreateFeedback({ traceId });
  const { mutate: deleteFeedback, isPending: isDeleting } = useDeleteFeedback({ traceId });

  return (
    <FeedbackThread
      feedbackData={data}
      isLoadingFeedbackData={isLoading}
      onPageChange={setPage}
      onSubmit={text => mutateAsync({ text })}
      isSubmitting={isPending}
      onDelete={feedbackId => deleteFeedback({ feedbackId })}
      isDeleting={isDeleting}
    />
  );
}
