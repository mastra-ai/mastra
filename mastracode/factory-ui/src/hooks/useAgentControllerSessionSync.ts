import type { AgentControllerTaskSnapshot } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { RefObject } from 'react';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

/** Latest run state written into the cache from the event stream. */
export interface AgentControllerLiveState {
  threadId?: string;
  tasks?: AgentControllerTaskSnapshot[];
  running?: boolean;
}

interface UseAgentControllerSessionSyncArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  sseConnected: boolean;
  liveEventGeneration: RefObject<number>;
  liveState: RefObject<AgentControllerLiveState | undefined>;
}

export function reconnectRefetchInterval(
  sseConnected: boolean,
  fetchFailureCount: number,
  running = false,
): false | number {
  // The stream is best-effort and does not replay events. A missed final
  // message/end event must not leave an apparently active run stale forever.
  if (sseConnected) return running ? 15_000 : false;
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
  liveEventGeneration,
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
      const generationAtRequestStart = liveEventGeneration.current;
      const state = await session!.state({ threadId });
      const latest = liveState.current;
      const liveEventOvertookRequest = generationAtRequestStart !== liveEventGeneration.current;
      // A stream event that landed while the request was in flight is newer
      // than the response, so its tasks and running flag win over the snapshot.
      return liveEventOvertookRequest && latest && latest.threadId === threadId
        ? {
            ...state,
            ...(latest.tasks ? { tasks: latest.tasks } : {}),
            ...(typeof latest.running === 'boolean' ? { running: latest.running } : {}),
          }
        : state;
    },
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: query =>
      reconnectRefetchInterval(sseConnected, query.state.fetchFailureCount, query.state.data?.running === true),
  });
}
