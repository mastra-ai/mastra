import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { queryKeys } from '../../../../api/keys';
import type { FactorySessionState } from '../context/ChatSessionContext';
import { createAgentControllerClient } from '../services/agentControllerClient';
import { useAgentControllerEvents } from './useAgentControllerEvents';
import { useAgentControllerSessionInit } from '../../../../hooks/useAgentControllerSessionInit';
import { useAgentControllerSessionSync } from '../../../../hooks/useAgentControllerSessionSync';
import type { AgentControllerLiveState } from '../../../../hooks/useAgentControllerSessionSync';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';
type SseConnectionState = 'never' | 'connected' | 'dropped';

function nextSseConnectionState(previous: SseConnectionState, connected: boolean): SseConnectionState {
  if (connected) return 'connected';
  return previous === 'connected' ? 'dropped' : previous;
}

interface UseAgentControllerConnectionArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  sessionThreadId?: string;
  factorySessionState?: FactorySessionState;
  baseUrl?: string;
  enabled?: boolean;
  onEvent: (event: AgentControllerEvent) => void;
}

export function useAgentControllerConnection({
  agentControllerId,
  resourceId,
  scope,
  sessionThreadId,
  factorySessionState,
  baseUrl = '',
  enabled = true,
  onEvent,
}: UseAgentControllerConnectionArgs) {
  const queryClient = useQueryClient();
  const [sseConnectionState, setSseConnectionState] = useState<SseConnectionState>('never');
  const sseStateRef = useRef<SseConnectionState>('never');
  const liveState = useRef<AgentControllerLiveState>({ generation: 0 });
  const sseConnected = sseConnectionState === 'connected';
  const hasEverConnected = sseConnectionState !== 'never';
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });
  const initQuery = useAgentControllerSessionInit({
    agentControllerId,
    resourceId,
    scope,
    sessionThreadId,
    factorySessionState,
    baseUrl,
    enabled,
  });
  const syncQuery = useAgentControllerSessionSync({
    agentControllerId,
    resourceId,
    scope,
    threadId: sessionThreadId,
    baseUrl,
    enabled: enabled && initQuery.isSuccess,
    sseConnected,
    liveState,
  });
  const handleConnectedChange = (connected: boolean) => {
    // React can batch renders between consecutive connection events.
    const previous = sseStateRef.current;
    const next = nextSseConnectionState(previous, connected);
    if (next === previous) return;
    sseStateRef.current = next;
    setSseConnectionState(next);
    if (next !== 'connected') return;
    // The server does not replay events missed while disconnected.
    const reconnected = previous === 'dropped';
    void queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerResourceThreadMessages(agentControllerId, resourceId),
      predicate: query => reconnected || query.state.status === 'error',
    });
    if (reconnected) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerConnectionState(agentControllerId, resourceId, scope, sessionThreadId),
        exact: true,
      });
    }
  };

  const handleEvent = (event: AgentControllerEvent) => {
    const displayStateRunning =
      isKnownAgentControllerEvent(event) && event.type === 'display_state_changed'
        ? event.displayState.isRunning
        : undefined;
    const running = event.type === 'agent_start' ? true : event.type === 'agent_end' ? false : displayStateRunning;
    const tasks = isKnownAgentControllerEvent(event) && event.type === 'task_updated' ? event.tasks : undefined;
    if (running !== undefined || tasks) {
      const updates = {
        ...(running !== undefined ? { running } : {}),
        ...(tasks ? { tasks } : {}),
      };
      liveState.current = {
        ...(liveState.current.threadId === sessionThreadId ? liveState.current : {}),
        generation: liveState.current.generation + 1,
        threadId: sessionThreadId,
        ...updates,
      };
      const stateQueryKey = queryKeys.agentControllerConnectionState(
        agentControllerId,
        resourceId,
        scope,
        sessionThreadId,
      );
      const updatedAt = queryClient.getQueryState(stateQueryKey)?.dataUpdatedAt;
      queryClient.setQueryData<AgentControllerSessionState>(
        stateQueryKey,
        current => (current ? { ...current, ...updates } : current),
        { updatedAt },
      );
    }
    onEvent(event);
  };

  useAgentControllerEvents({
    session,
    enabled,
    epoch: syncQuery.dataUpdatedAt,
    onEvent: handleEvent,
    onConnectedChange: handleConnectedChange,
  });

  const status = deriveConnectionStatus({
    initIsError: initQuery.isError,
    syncIsError: syncQuery.isError,
    hasSyncData: Boolean(syncQuery.data),
    sseConnected,
    hasEverConnected,
    syncFailureCount: syncQuery.failureCount,
  });

  return {
    status,
    state: syncQuery.data,
    threadId: syncQuery.data?.threadId ?? initQuery.data?.threadId ?? undefined,
  };
}

export function deriveConnectionStatus({
  initIsError,
  syncIsError,
  hasSyncData,
  sseConnected,
  hasEverConnected,
  syncFailureCount,
}: {
  initIsError: boolean;
  syncIsError: boolean;
  hasSyncData: boolean;
  sseConnected: boolean;
  hasEverConnected: boolean;
  syncFailureCount: number;
}): ConnectionStatus {
  if (initIsError || (syncIsError && !hasSyncData)) return 'error';
  if (!hasSyncData) return 'connecting';
  if (!sseConnected && syncFailureCount >= 10) return 'error';
  if (!sseConnected) return hasEverConnected ? 'reconnecting' : 'connecting';
  return 'ready';
}
