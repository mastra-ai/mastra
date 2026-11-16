import { v4 as uuid } from '@lukeed/uuid';
import type { CreateFeedbackBody, MastraClient } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { addPendingFeedback, discardPendingFeedback } from '../feedback/optimistic-feedback';
import type { MastraMutationOptions } from '../shared/query-options';

type CreateFeedbackResponse = Awaited<ReturnType<MastraClient['createFeedback']>>;
type CreateFeedbackVariables = { text: string };
type CreateFeedbackOptions = MastraMutationOptions<CreateFeedbackResponse, CreateFeedbackVariables>;

export type FeedbackWriteOptions = {
  contextMode?: CreateFeedbackBody['contextMode'];
  feedbackUserId?: CreateFeedbackBody['feedback']['feedbackUserId'];
};

type UseCreateFeedbackProps = FeedbackWriteOptions & {
  traceId: string;
  spanId?: string;
  queryOptions?: CreateFeedbackOptions;
};

type FeedbackIdentity = { feedbackId: string; timestamp: string };

/**
 * Identity generated per submit, so the optimistic comment (added in onMutate) and the posted
 * record (sent in mutationFn) share one feedbackId. TanStack passes the same variables object
 * to every callback of a mutation run.
 */
const identities = new WeakMap<CreateFeedbackVariables, FeedbackIdentity>();

function identityFor(variables: CreateFeedbackVariables): FeedbackIdentity {
  let identity = identities.get(variables);
  if (!identity) {
    identity = { feedbackId: uuid(), timestamp: new Date().toISOString() };
    identities.set(variables, identity);
  }
  return identity;
}

/**
 * Submits a free-text comment as a feedback record, scoped to the trace or to a single span.
 * The comment shows up right away in `useTraceFeedback` / `useSpanFeedback`, is removed again
 * if the submit fails, and the matching feedback list is invalidated on success.
 *
 * Caller `onMutate`, `onError` and `onSuccess` run in addition to this behavior, not instead of it.
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
    mutationFn: (variables: CreateFeedbackVariables) =>
      client.createFeedback({
        ...(contextMode !== undefined ? { contextMode } : {}),
        feedback: {
          ...identityFor(variables),
          traceId,
          ...(spanId ? { spanId } : {}),
          ...(feedbackUserId !== undefined ? { feedbackUserId } : {}),
          feedbackType: 'comment',
          feedbackSource: 'user',
          value: variables.text,
        },
      }),
    ...queryOptions,
    onMutate: (...args: Parameters<NonNullable<CreateFeedbackOptions['onMutate']>>) => {
      const [variables] = args;
      const { feedbackId, timestamp } = identityFor(variables);
      addPendingFeedback(queryClient, {
        traceId,
        spanId,
        item: {
          feedbackId,
          timestamp,
          traceId,
          ...(spanId ? { spanId } : {}),
          ...(feedbackUserId !== undefined ? { feedbackUserId } : {}),
          feedbackType: 'comment',
          feedbackSource: 'user',
          value: variables.text,
          // Storage defaults new feedback to this status.
          reviewStatus: 'needs-review',
        },
      });
      return queryOptions?.onMutate?.(...args);
    },
    onError: (...args: Parameters<NonNullable<CreateFeedbackOptions['onError']>>) => {
      const [, variables] = args;
      discardPendingFeedback(queryClient, { traceId, spanId, feedbackId: identityFor(variables).feedbackId });
      return queryOptions?.onError?.(...args);
    },
    onSuccess: async (...args: Parameters<NonNullable<CreateFeedbackOptions['onSuccess']>>) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: spanId ? ['span-feedback', traceId, spanId] : ['trace-feedback', traceId],
        }),
        queryOptions?.onSuccess?.(...args),
      ]);
    },
  });
};
