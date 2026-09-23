import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type UseCreateFeedbackProps = {
  traceId: string;
  spanId?: string;
};

/**
 * Submits a free-text comment as a feedback record, scoped to the trace or to a
 * single span, then invalidates the matching feedback list so it refreshes.
 */
export const useCreateFeedback = ({ traceId, spanId }: UseCreateFeedbackProps) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ text }: { text: string }) =>
      client.createFeedback({
        feedback: {
          traceId,
          ...(spanId ? { spanId } : {}),
          feedbackType: 'comment',
          feedbackSource: 'user',
          value: text,
        },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: spanId ? ['span-feedback', traceId, spanId] : ['trace-feedback', traceId],
      }),
  });
};
