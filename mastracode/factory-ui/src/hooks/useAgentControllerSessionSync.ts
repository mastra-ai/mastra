import type { AgentControllerTaskSnapshot } from '@mastra/client-js';
import { MastraClientError } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { RefObject } from 'react';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

export interface PendingThreadVerification {
  threadId: string;
  observedThreadId: string | null;
}

interface UseAgentControllerSessionSyncArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  sseConnected: boolean;
  pendingVerification: RefObject<PendingThreadVerification | undefined>;
  taskEventGeneration: RefObject<number>;
  liveTasks: RefObject<{ threadId?: string; tasks: AgentControllerTaskSnapshot[] } | undefined>;
}

export function isSessionThreadConflict(error: unknown): boolean {
  return error instanceof MastraClientError && error.status === 409;
}

export function reconnectRefetchInterval(
  sseConnected: boolean,
  fetchFailureCount: number,
  error?: unknown,
): false | number {
  if (sseConnected || isSessionThreadConflict(error)) return false;
  if (fetchFailureCount >= 10) return false;
  return Math.min(1000 * 2 ** fetchFailureCount, 30_000);
}

export function useAgentControllerSessionSync({
  agentControllerId,
  resourceId,
  scope,
  threadId,
  baseUrl = '',
  enabled = true,
  sseConnected,
  pendingVerification,
  taskEventGeneration,
  liveTasks,
}: UseAgentControllerSessionSyncArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerConnectionState(agentControllerId, resourceId, scope, threadId),
    queryFn: async ({ signal }) => {
      const generationAtRequestStart = taskEventGeneration.current;
      const verificationAtRequestStart = pendingVerification.current;
      const state = await session!.state({ threadId });
      const verifiedCurrentRequest =
        verificationAtRequestStart !== undefined &&
        pendingVerification.current === verificationAtRequestStart &&
        verificationAtRequestStart.threadId === state.threadId;
      const verificationIsCurrent = verifiedCurrentRequest && !signal.aborted;
      if (verificationIsCurrent) pendingVerification.current = undefined;
      const latestTasks = liveTasks.current;
      const liveEventOvertookRequest = generationAtRequestStart !== taskEventGeneration.current;
      return liveEventOvertookRequest && latestTasks && latestTasks.threadId === state.threadId
        ? { ...state, tasks: latestTasks.tasks }
        : state;
    },
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    notifyOnChangeProps: ['data', 'dataUpdatedAt', 'error', 'failureCount', 'isFetching'],
    refetchInterval: query => {
      const verificationRequired =
        pendingVerification.current !== undefined && pendingVerification.current.threadId === threadId;
      const streamSuppliesCurrentThread = sseConnected && !verificationRequired;
      return reconnectRefetchInterval(streamSuppliesCurrentThread, query.state.fetchFailureCount, query.state.error);
    },
  });
}
