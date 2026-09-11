import type { AgentControllerSessionState } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { RefObject } from 'react';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

export type AgentControllerLiveState = Pick<AgentControllerSessionState, 'running' | 'tasks'> & {
  generation: number;
  threadId?: string;
};

interface UseAgentControllerSessionSyncArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  sseConnected: boolean;
  liveState: RefObject<AgentControllerLiveState>;
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
  liveState,
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
      const generationAtRequestStart = liveState.current.generation;
      liveState.current = { generation: generationAtRequestStart, threadId };
      const state = await session!.state({ threadId });
      const { generation, threadId: liveThreadId, ...updates } = liveState.current;
      const liveEventOvertookRequest = generationAtRequestStart !== generation && liveThreadId === threadId;
      return liveEventOvertookRequest ? { ...state, ...updates } : state;
    },
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: query => reconnectRefetchInterval(sseConnected, query.state.fetchFailureCount),
  });
}
