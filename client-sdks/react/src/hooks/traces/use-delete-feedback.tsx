import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

type UseDeleteFeedbackProps = {
  traceId: string;
  spanId?: string;
};

/**
 * Deletes a single feedback record by id, then invalidates the matching
 * feedback list (trace- or span-scoped) so it refreshes.
 */
export const useDeleteFeedback = ({ traceId, spanId }: UseDeleteFeedbackProps) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId }: { feedbackId: string }) => client.deleteFeedback({ feedbackIds: [feedbackId] }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: spanId ? ['span-feedback', traceId, spanId] : ['trace-feedback', traceId],
      }),
  });
};
