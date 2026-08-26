import type { AgentControllerTaskSnapshot } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { RefObject } from 'react';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

/**
 * Freshest event-patched fields, stamped per field so a state fetch resolving
 * after an event re-applies only what the event updated mid-flight instead of
 * overwriting it with an older snapshot.
 */
export interface LiveStatePatch {
  generation: number;
  running?: { value: boolean; generation: number };
  tasks?: { value: AgentControllerTaskSnapshot[]; threadId?: string; generation: number };
}

interface UseAgentControllerSessionSyncArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  sseConnected: boolean;
  livePatch: RefObject<LiveStatePatch>;
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
  livePatch,
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
      const generationAtRequestStart = livePatch.current.generation;
      const state = await session!.state({ threadId });
      const { running, tasks } = livePatch.current;
      const runningOvertookRequest = running && running.generation > generationAtRequestStart;
      const tasksOvertookRequest = tasks && tasks.generation > generationAtRequestStart && tasks.threadId === threadId;
      return {
        ...state,
        ...(runningOvertookRequest ? { running: running.value } : {}),
        ...(tasksOvertookRequest ? { tasks: tasks.value } : {}),
      };
    },
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: query => reconnectRefetchInterval(sseConnected, query.state.fetchFailureCount),
  });
}
