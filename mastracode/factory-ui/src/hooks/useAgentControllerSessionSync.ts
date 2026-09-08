import type { AgentControllerSessionState, AgentControllerTaskSnapshot } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { RefObject } from 'react';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

interface LiveTasks {
  threadId?: string;
  tasks: AgentControllerTaskSnapshot[];
}

/**
 * What the stream reported, stamped with the generation it arrived at. A state
 * response the stream overtook is older than those reports, so they lay over it.
 */
export interface LiveEvents {
  generation: number;
  running?: { value: boolean; at: number };
  runBoundaryAt?: number;
  tasks?: LiveTasks & { at: number };
}

/** Stamps what an event changed; returns the generation before it, to overlay the cached snapshot from. */
export function recordLiveEvent(
  live: LiveEvents,
  event: { running?: boolean; runBoundary: boolean; tasks?: LiveTasks },
): number {
  const since = live.generation;
  const at = since + 1;
  live.generation = at;
  if (event.tasks) live.tasks = { ...event.tasks, at };
  if (event.running !== undefined) live.running = { value: event.running, at };
  if (event.runBoundary) live.runBoundaryAt = at;
  return since;
}

/** The snapshot with everything the stream reported after `since` laid over it. */
export function overlayLiveEvents(
  state: AgentControllerSessionState,
  live: LiveEvents,
  since: number,
  threadId?: string,
): AgentControllerSessionState {
  const { tasks, running } = live;
  return {
    ...state,
    ...(tasks && tasks.at > since && tasks.threadId === threadId ? { tasks: tasks.tasks } : {}),
    ...(running && running.at > since ? { running: running.value } : {}),
    ...((live.runBoundaryAt ?? 0) > since ? { currentMessage: undefined } : {}),
  };
}

interface UseAgentControllerSessionSyncArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  sseConnected: boolean;
  liveEvents: RefObject<LiveEvents>;
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
  liveEvents,
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
      const since = liveEvents.current.generation;
      const state = await session!.state({ threadId });
      return overlayLiveEvents(state, liveEvents.current, since, threadId);
    },
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: query => reconnectRefetchInterval(sseConnected, query.state.fetchFailureCount),
  });
}
