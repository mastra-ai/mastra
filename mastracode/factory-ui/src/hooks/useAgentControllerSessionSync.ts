import type { AgentControllerTaskSnapshot } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { RefObject } from 'react';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerSessionSyncArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  sseConnected: boolean;
  taskEventGeneration: RefObject<number>;
  liveTasks: RefObject<{ threadId?: string; tasks: AgentControllerTaskSnapshot[] } | undefined>;
}

export function reconnectRefetchInterval(sseConnected: boolean, fetchFailureCount: number): false | number {
  if (sseConnected) return false;
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
    queryFn: async () => {
      const generationAtRequestStart = taskEventGeneration.current;
      const state = await session!.state({ threadId });
      const latestTasks = liveTasks.current;
      const liveEventOvertookRequest = generationAtRequestStart !== taskEventGeneration.current;
      return liveEventOvertookRequest && latestTasks && latestTasks.threadId === threadId
        ? { ...state, tasks: latestTasks.tasks }
        : state;
    },
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: query => reconnectRefetchInterval(sseConnected, query.state.fetchFailureCount),
  });
}
