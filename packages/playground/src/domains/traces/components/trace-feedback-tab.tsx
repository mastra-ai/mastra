import { useState } from 'react';

import { useTraceFeedback } from '../hooks/use-trace-feedback';
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

  return <SpanFeedbackList feedbackData={data} onPageChange={setPage} isLoadingFeedbackData={isLoading} />;
}
