import type { AgentControllerEvent, AgentControllerSessionState, KnownAgentControllerEvent } from '@mastra/client-js';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { queryKeys } from '../../../../../shared/api/keys';
import type { FactorySessionState } from '../context/ChatSessionContext';
import { createAgentControllerClient } from '../services/agentControllerClient';
import { useAgentControllerEvents } from './useAgentControllerEvents';
import { useAgentControllerSessionInit } from '../../../../../shared/hooks/useAgentControllerSessionInit';
import { useAgentControllerSessionSync } from '../../../../../shared/hooks/useAgentControllerSessionSync';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';
type SseConnectionState = 'never' | 'connected' | 'dropped';

/**
 * `AgentControllerEvent` includes an untyped catch-all member, so a literal
 * `event.type` check alone cannot narrow to the known event's payload.
 */
function isEventOfType<T extends KnownAgentControllerEvent['type']>(
  event: AgentControllerEvent,
  type: T,
): event is Extract<KnownAgentControllerEvent, { type: T }> {
  return event.type === type;
}

interface UseAgentControllerConnectionArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  factorySessionState?: FactorySessionState;
  baseUrl?: string;
  enabled?: boolean;
  onEvent: (event: AgentControllerEvent) => void;
}

export function useAgentControllerConnection({
  agentControllerId,
  resourceId,
  scope,
  factorySessionState,
  baseUrl = '',
  enabled = true,
  onEvent,
}: UseAgentControllerConnectionArgs) {
  const queryClient = useQueryClient();
  const [sseConnectionState, setSseConnectionState] = useState<SseConnectionState>('never');
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
    factorySessionState,
    baseUrl,
    enabled,
  });
  const syncQuery = useAgentControllerSessionSync({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled: enabled && initQuery.isSuccess,
    sseConnected,
  });
  const handleConnectedChange = (connected: boolean) => {
    setSseConnectionState(current => {
      if (connected) return 'connected';
      if (current === 'connected') return 'dropped';
      return current;
    });
  };

  const handleEvent = (event: AgentControllerEvent) => {
    const stateQueryKey = queryKeys.agentControllerConnectionState(agentControllerId, resourceId, scope);
    const patchConnectionState = (updates: Partial<AgentControllerSessionState>) => {
      const updatedAt = queryClient.getQueryState(stateQueryKey)?.dataUpdatedAt;
      queryClient.setQueryData<AgentControllerSessionState>(
        stateQueryKey,
        current => (current ? { ...current, ...updates } : current),
        { updatedAt },
      );
    };

    if (isEventOfType(event, 'mode_changed')) {
      patchConnectionState({ modeId: event.modeId });
    } else if (isEventOfType(event, 'model_changed')) {
      patchConnectionState({ modelId: event.modelId });
    } else if (event.type === 'thread_changed') {
      // A thread switch also hydrates that thread's persisted mode and model.
      // The event only carries the id, so fetch the complete canonical state.
      void queryClient.invalidateQueries({ queryKey: stateQueryKey, exact: true });
    }

    const displayStateRunning =
      event.type === 'display_state_changed' &&
      typeof event.displayState === 'object' &&
      event.displayState !== null &&
      'isRunning' in event.displayState
        ? event.displayState.isRunning
        : undefined;
    const running = event.type === 'agent_start' ? true : event.type === 'agent_end' ? false : displayStateRunning;
    if (typeof running === 'boolean') {
      patchConnectionState({ running });
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
