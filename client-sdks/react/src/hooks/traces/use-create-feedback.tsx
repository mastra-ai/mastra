import type { CreateFeedbackBody, MastraClient } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';
import { feedbackListKey, rememberSubmittedFeedback } from './submitted-feedback';

type CreateFeedbackResponse = Awaited<ReturnType<MastraClient['createFeedback']>>;

export type FeedbackWriteOptions = {
  contextMode?: CreateFeedbackBody['contextMode'];
  feedbackUserId?: CreateFeedbackBody['feedback']['feedbackUserId'];
};

type UseCreateFeedbackProps = FeedbackWriteOptions & {
  traceId: string;
  spanId?: string;
  queryOptions?: MastraMutationOptions<CreateFeedbackResponse, { text: string }>;
};

/**
 * Submits a free-text comment as a feedback record, scoped to the trace or to a
 * single span. Keeps acknowledged comments visible until the refreshed list includes them.
 */
export const useCreateFeedback = ({
  traceId,
  spanId,
  contextMode,
  feedbackUserId,
  queryOptions,
}: UseCreateFeedbackProps) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ text }: { text: string }) =>
      client.createFeedback({
        ...(contextMode !== undefined ? { contextMode } : {}),
        feedback: {
          traceId,
          ...(spanId ? { spanId } : {}),
          ...(feedbackUserId !== undefined ? { feedbackUserId } : {}),
          feedbackType: 'comment',
          feedbackSource: 'user',
          value: text,
        },
      }),
    onSuccess: async (response, { text }) => {
      const queryKey = feedbackListKey(traceId, spanId);
      if (response.success && response.data?.feedbackId && response.data.timestamp) {
        // An already-running list request must not overwrite the acknowledged comment.
        await queryClient.cancelQueries({ queryKey });
        rememberSubmittedFeedback(queryClient, traceId, spanId, {
          ...response.data,
          feedbackType: 'comment',
          feedbackSource: 'user',
          value: text,
          reviewStatus: 'needs-review',
          ...(feedbackUserId !== undefined ? { feedbackUserId } : {}),
        });
      }
      await queryClient.invalidateQueries({ queryKey });
    },
    ...queryOptions,
  });
};
