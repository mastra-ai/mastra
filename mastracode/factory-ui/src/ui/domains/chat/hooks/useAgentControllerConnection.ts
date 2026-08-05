import type { AgentControllerEvent, AgentControllerSessionState, KnownAgentControllerEvent } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { queryKeys } from '../../../../api/keys';
import type { FactorySessionState } from '../context/ChatSessionContext';
import { createAgentControllerClient } from '../services/agentControllerClient';
import { useAgentControllerEvents } from './useAgentControllerEvents';
import { useAgentControllerSessionInit } from '../../../../hooks/useAgentControllerSessionInit';
import { useAgentControllerSessionSync } from '../../../../hooks/useAgentControllerSessionSync';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';
type SseConnectionState = 'never' | 'connected' | 'dropped';

interface UseAgentControllerConnectionArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  /** Exact thread id to bind on session creation (see ChatSessionContextApi). */
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

  const handleEvent = (raw: AgentControllerEvent) => {
    // Same cast as applyEvent in services/transcript.ts: OtherAgentControllerEvent
    // is `{ type: string }`, so it never drops out of the union on its own.
    const event = raw as KnownAgentControllerEvent;
    const displayStateRunning =
      event.type === 'display_state_changed' &&
      typeof event.displayState === 'object' &&
      event.displayState !== null &&
      'isRunning' in event.displayState
        ? event.displayState.isRunning
        : undefined;
    const running = event.type === 'agent_start' ? true : event.type === 'agent_end' ? false : displayStateRunning;
    if (typeof running === 'boolean') {
      const stateQueryKey = queryKeys.agentControllerConnectionState(agentControllerId, resourceId, scope);
      const updatedAt = queryClient.getQueryState(stateQueryKey)?.dataUpdatedAt;
      queryClient.setQueryData<AgentControllerSessionState>(
        stateQueryKey,
        current => (current ? { ...current, running } : current),
        { updatedAt },
      );
    }
    const streamedThreadId = syncQuery.data?.threadId;
    if (event.type === 'message_end' && streamedThreadId) {
      cacheThreadMessage(
        queryClient,
        queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, streamedThreadId),
        event.message,
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

/**
 * Fold a persisted message into every cached window of its thread. Matching the
 * limit-less key prefix covers each window load-more has grown to; a thread
 * nobody fetched has no entry, and `setQueriesData` never creates one.
 */
function cacheThreadMessage(queryClient: QueryClient, threadKey: QueryKey, message: MastraDBMessage) {
  queryClient.setQueriesData<MastraDBMessage[]>({ queryKey: threadKey }, current => {
    if (!current) return current;
    const index = current.findIndex(candidate => candidate.id === message.id);
    if (index === -1) return [...current, message];
    const next = [...current];
    next[index] = message;
    return next;
  });
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
