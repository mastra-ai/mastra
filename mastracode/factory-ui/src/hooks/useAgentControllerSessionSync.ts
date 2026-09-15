import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

type SessionStateUpdate = Pick<AgentControllerSessionState, 'running' | 'tasks'>;

interface UseAgentControllerSessionSyncArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  sseConnected: boolean;
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
}: UseAgentControllerSessionSyncArgs) {
  const queryClient = useQueryClient();
  const liveStateUpdates = useRef<{ threadId?: string; updates: SessionStateUpdate }>({ updates: {} });
  const stateQueryKey = queryKeys.agentControllerConnectionState(agentControllerId, resourceId, scope, threadId);
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  async function readSessionState() {
    liveStateUpdates.current = { threadId, updates: {} };
    const serverState = await requireAgentControllerSession(session).state({ threadId });
    if (liveStateUpdates.current.threadId !== threadId) return serverState;
    return { ...serverState, ...liveStateUpdates.current.updates };
  }

  function recordLiveStateUpdate(update: SessionStateUpdate) {
    if (liveStateUpdates.current.threadId !== threadId) {
      liveStateUpdates.current = { threadId, updates: {} };
    }
    liveStateUpdates.current.updates = { ...liveStateUpdates.current.updates, ...update };
  }

  function updateCachedSessionState(update: SessionStateUpdate) {
    const updatedAt = queryClient.getQueryState(stateQueryKey)?.dataUpdatedAt;
    queryClient.setQueryData<AgentControllerSessionState>(
      stateQueryKey,
      current => (current ? { ...current, ...update } : current),
      { updatedAt },
    );
  }

  function applySessionEvent(event: AgentControllerEvent) {
    const update = getSessionStateUpdate(event);
    if (!update) return;
    recordLiveStateUpdate(update);
    updateCachedSessionState(update);
  }

  const stateQuery = useQuery({
    queryKey: stateQueryKey,
    queryFn: readSessionState,
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: query => reconnectRefetchInterval(sseConnected, query.state.fetchFailureCount),
  });

  return { stateQuery, applySessionEvent };
}

function getSessionStateUpdate(event: AgentControllerEvent): SessionStateUpdate | undefined {
  if (!isKnownAgentControllerEvent(event)) return undefined;

  switch (event.type) {
    case 'agent_start':
      return { running: true };
    case 'agent_end':
      return { running: false };
    case 'display_state_changed':
      return { running: event.displayState.isRunning };
    case 'task_updated':
      return { tasks: event.tasks };
    default:
      return undefined;
  }
}
