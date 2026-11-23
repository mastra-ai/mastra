import type { MastraClient } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { addPendingFeedbackDeletion } from '../feedback/pending-feedback-deletions';
import type { MastraMutationOptions } from '../shared/query-options';

type DeleteFeedbackResponse = Awaited<ReturnType<MastraClient['deleteFeedback']>>;
type DeleteFeedbackOptions = MastraMutationOptions<DeleteFeedbackResponse, { feedbackId: string }>;

type UseDeleteFeedbackProps = {
  traceId: string;
  spanId?: string;
  queryOptions?: DeleteFeedbackOptions;
};

/**
 * Deletes a single feedback record by id, then invalidates the matching feedback list
 * (trace- or span-scoped) so it refreshes.
 *
 * Deletes can be applied asynchronously (Mastra Platform accepts them and removes the row
 * later), so after a successful request `useTraceFeedback` / `useSpanFeedback` mark the row
 * `deleteStatus: 'deleting'` and poll until the server stops returning it.
 *
 * Caller `onSuccess` runs in addition to this behavior, not instead of it.
 */
export const useDeleteFeedback = ({ traceId, spanId, queryOptions }: UseDeleteFeedbackProps) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId }: { feedbackId: string }) => client.deleteFeedback({ feedbackIds: [feedbackId] }),
    ...queryOptions,
    onSuccess: async (...args: Parameters<NonNullable<DeleteFeedbackOptions['onSuccess']>>) => {
      const [, { feedbackId }] = args;
      addPendingFeedbackDeletion(queryClient, { traceId, spanId, feedbackId });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: spanId ? ['span-feedback', traceId, spanId] : ['trace-feedback', traceId],
        }),
        queryOptions?.onSuccess?.(...args),
      ]);
    },
  });
};
