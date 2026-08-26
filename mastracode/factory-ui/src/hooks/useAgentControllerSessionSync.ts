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
  running?: { value: boolean; threadId: string | null; generation: number; stateVersion?: number; stateEpoch?: string };
  tasks?: {
    value: AgentControllerTaskSnapshot[];
    threadId?: string;
    generation: number;
    stateVersion?: number;
    stateEpoch?: string;
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
  livePatch: RefObject<LiveStatePatch>;
}

/**
 * Orders two pieces of session-state truth by their server stamps. Same epoch:
 * higher version wins. Different epochs (a restart sits between them): ordering
 * is unknowable, so the side that arrived last wins — `incoming` outranks.
 * `undefined` when either side is unstamped (server predates versioning).
 */
export function incomingStateOutranks(
  incoming: { stateVersion?: number; stateEpoch?: string } | undefined,
  held: { stateVersion?: number; stateEpoch?: string } | undefined,
): boolean | undefined {
  if (incoming?.stateVersion == null || held?.stateVersion == null) return undefined;
  return incoming.stateEpoch !== held.stateEpoch || incoming.stateVersion > held.stateVersion;
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
      const patchOutranksSnapshot = (patch: { generation: number; stateVersion?: number; stateEpoch?: string }) => {
        const snapshotIsNewer = incomingStateOutranks(state, patch);
        return snapshotIsNewer == null ? patch.generation > generationAtRequestStart : !snapshotIsNewer;
      };
      const runningOvertookRequest = running && patchOutranksSnapshot(running);
      const tasksOvertookRequest = tasks && patchOutranksSnapshot(tasks) && tasks.threadId === threadId;
      const overlayVersions = [
        runningOvertookRequest ? running.stateVersion : undefined,
        tasksOvertookRequest ? tasks.stateVersion : undefined,
      ].filter((version): version is number => version != null);
      return {
        ...state,
        ...(runningOvertookRequest ? { running: running.value, runningThreadId: running.threadId } : {}),
        ...(tasksOvertookRequest ? { tasks: tasks.value } : {}),
        ...(overlayVersions.length && state.stateVersion != null
          ? { stateVersion: Math.max(state.stateVersion, ...overlayVersions) }
          : {}),
      };
    },
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: query => reconnectRefetchInterval(sseConnected, query.state.fetchFailureCount),
  });
}
