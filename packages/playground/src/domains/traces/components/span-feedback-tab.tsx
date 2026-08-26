import { useState } from 'react';

import { useSpanFeedback } from '../hooks/use-span-feedback';
import { SpanFeedbackList } from './span-feedback-list';

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

  return <SpanFeedbackList feedbackData={data} onPageChange={setPage} isLoadingFeedbackData={isLoading} />;
}
