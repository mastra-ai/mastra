import type { MastraClient } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { useCurrentUser } from '../auth/use-current-user';
import type { MastraMutationOptions } from '../shared/query-options';

type CreateFeedbackResponse = Awaited<ReturnType<MastraClient['createFeedback']>>;

type UseCreateFeedbackProps = {
  traceId: string;
  spanId?: string;
  queryOptions?: MastraMutationOptions<CreateFeedbackResponse, { text: string }>;
};

/**
 * Submits a free-text comment as a feedback record, scoped to the trace or to a
 * single span, then invalidates the matching feedback list so it refreshes.
 */
export const useCreateFeedback = ({ traceId, spanId, queryOptions }: UseCreateFeedbackProps) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { data: currentUser, refetch: fetchCurrentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      const user = currentUser === undefined ? (await fetchCurrentUser()).data : currentUser;
      return client.createFeedback({
        contextMode: 'resolve',
        feedback: {
          traceId,
          ...(spanId ? { spanId } : {}),
          feedbackType: 'comment',
          feedbackSource: 'user',
          feedbackUserId: user?.id ?? null,
          value: text,
        },
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: spanId ? ['span-feedback', traceId, spanId] : ['trace-feedback', traceId],
      }),
    ...queryOptions,
  });
};
