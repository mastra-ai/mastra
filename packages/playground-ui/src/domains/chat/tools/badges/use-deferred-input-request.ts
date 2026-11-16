import type { BackgroundTaskResponse } from '@mastra/client-js';
import { MastraClientError } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useBackgroundTaskStream } from '@mastra/react/hooks/agents';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { isMcpInputRequest } from '../mcp-input-request';
import type { McpInputRequestPayload, McpInputResumeData } from '../mcp-input-request';

const ENDED_STATUSES: ReadonlySet<string> = new Set(['completed', 'failed', 'cancelled', 'timed_out']);

export const backgroundTaskQueryKey = (backgroundTaskId: string) => ['background-task', backgroundTaskId] as const;

export interface OpenInputRequest {
  payload: McpInputRequestPayload;
  /** The suspension being answered; the server refuses an answer to an older one. */
  suspendedAt?: string | Date;
}

/**
 * The MCP input request a deferred call's background task is suspended on, if any. The task is read
 * once (so a reloaded chat still sees an open request) and then followed over the task's event
 * stream, whose events are folded into the same cache entry the task chip polls.
 */
export function useDeferredInputRequest(backgroundTaskId: string, enabled: boolean): OpenInputRequest | undefined {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const queryKey = backgroundTaskQueryKey(backgroundTaskId);
  const { data } = useQuery({
    queryKey,
    queryFn: () => client.getBackgroundTask(backgroundTaskId),
    enabled,
  });
  const live = !ENDED_STATUSES.has(data?.status ?? '');
  const { tasks } = useBackgroundTaskStream({ taskId: backgroundTaskId, enabled: enabled && live });
  const event = tasks[backgroundTaskId];

  useEffect(() => {
    if (!event) return;
    const suspendedAt =
      'suspendedAt' in event ? (event.suspendedAt as BackgroundTaskResponse['suspendedAt']) : undefined;
    const cached = queryClient.getQueryData<BackgroundTaskResponse>(queryKey);
    // The first read is still on its way; read again so it can't land older than this event.
    if (!cached) {
      void queryClient.invalidateQueries({ queryKey });
      return;
    }
    queryClient.setQueryData<BackgroundTaskResponse>(queryKey, {
      ...cached,
      status: event.status,
      suspendPayload: event.status === 'suspended' ? event.suspendPayload : undefined,
      suspendedAt: event.status === 'suspended' ? suspendedAt : undefined,
    });
    // `queryKey` is rebuilt every render; the task id names it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [event, queryClient, backgroundTaskId]);

  if (!enabled || data?.status !== 'suspended' || !isMcpInputRequest(data.suspendPayload)) return undefined;
  return { payload: data.suspendPayload, suspendedAt: data.suspendedAt };
}

const ANSWER_CONFLICT_MESSAGE = 'This request was already answered or has moved on.';

/** Answers a deferred call's suspended background task, fenced on the suspension that was shown. */
export function useResumeBackgroundTask(backgroundTaskId: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const queryKey = backgroundTaskQueryKey(backgroundTaskId);
  return useMutation({
    mutationFn: ({ resumeData, suspendedAt }: { resumeData: McpInputResumeData; suspendedAt?: string | Date }) =>
      client.resumeBackgroundTask(backgroundTaskId, resumeData, { suspendedAt }),
    onSuccess: task => queryClient.setQueryData(queryKey, task),
    onError: error => {
      if (error instanceof MastraClientError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export const resumeErrorMessage = (error: Error) =>
  error instanceof MastraClientError && error.status === 409 ? ANSWER_CONFLICT_MESSAGE : error.message;
