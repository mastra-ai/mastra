import { useState } from 'react';

import { useCreateFeedback } from '../hooks/use-create-feedback';
import { useTraceFeedback } from '../hooks/use-trace-feedback';
import { FeedbackComposer } from './feedback-composer';
import { SpanFeedbackList } from './span-feedback-list';

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
  const { mutate, isPending } = useCreateFeedback({ traceId });

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <FeedbackComposer onSubmit={text => mutate({ text })} isSubmitting={isPending} />
      <SpanFeedbackList feedbackData={data} onPageChange={setPage} isLoadingFeedbackData={isLoading} />
    </div>
  );
}
