import type { MastraClient } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';

type DeleteFeedbackResponse = Awaited<ReturnType<MastraClient['deleteFeedback']>>;

type UseDeleteFeedbackProps = {
  traceId: string;
  spanId?: string;
  queryOptions?: MastraMutationOptions<DeleteFeedbackResponse, { feedbackId: string }>;
};

/**
 * Deletes a single feedback record by id, then invalidates the matching
 * feedback list (trace- or span-scoped) so it refreshes.
 */
export const useDeleteFeedback = ({ traceId, spanId, queryOptions }: UseDeleteFeedbackProps) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId }: { feedbackId: string }) => client.deleteFeedback({ feedbackIds: [feedbackId] }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: spanId ? ['span-feedback', traceId, spanId] : ['trace-feedback', traceId],
      }),
    ...queryOptions,
  });
};
