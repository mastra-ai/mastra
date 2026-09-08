import { useState } from 'react';

import { useCreateFeedback } from '../hooks/use-create-feedback';
import { useSpanFeedback } from '../hooks/use-span-feedback';
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
  const { data, isLoading } = useSpanFeedback({ traceId, spanId, page });
  const { mutateAsync, isPending } = useCreateFeedback({ traceId, spanId });

  return (
    <FeedbackThread
      feedbackData={data}
      isLoadingFeedbackData={isLoading}
      onPageChange={setPage}
      onSubmit={text => mutateAsync({ text })}
      isSubmitting={isPending}
    />
  );
}
