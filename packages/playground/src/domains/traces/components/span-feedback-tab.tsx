import { useState } from 'react';

import { useCreateFeedback } from '../hooks/use-create-feedback';
import { useSpanFeedback } from '../hooks/use-span-feedback';
import { FeedbackComposer } from './feedback-composer';
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
  const { mutate, isPending } = useCreateFeedback({ traceId, spanId });

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <FeedbackComposer onSubmit={text => mutate({ text })} isSubmitting={isPending} />
      <SpanFeedbackList feedbackData={data} onPageChange={setPage} isLoadingFeedbackData={isLoading} />
    </div>
  );
}
