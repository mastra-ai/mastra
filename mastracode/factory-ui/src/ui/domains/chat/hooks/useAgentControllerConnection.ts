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
  const sseStateRef = useRef<SseConnectionState>('never');
  const taskEventGeneration = useRef(0);
  const liveTasks = useRef<{ threadId?: string; tasks: NonNullable<AgentControllerSessionState['tasks']> }>(undefined);
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
    taskEventGeneration,
    liveTasks,
  });
  const handleConnectedChange = (connected: boolean) => {
    // Ref mirrors the state so back-to-back events see the true previous value
    // even when React batches the renders in between.
    const previous = sseStateRef.current;
    const next = nextSseConnectionState(previous, connected);
    if (next === previous) return;
    sseStateRef.current = next;
    setSseConnectionState(next);
    if (next !== 'connected') return;
    // Events sent while the stream was down are gone for good (the server does
    // not replay them), so a reconnect refetches the mounted message windows —
    // mergeWindow folds whatever the gap dropped back into the transcript. A
    // first connect retries only failed windows: the stream opens after the
    // session is bound to its thread, so a read that raced that binding works now.
    const reconnected = previous === 'dropped';
    void queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerResourceThreadMessages(agentControllerId, resourceId),
      predicate: query => reconnected || query.state.status === 'error',
    });
    // The gap can also have eaten agent_start/agent_end, so the cached state
    // snapshot is refetched the same way.
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
    if (tasks) {
      taskEventGeneration.current += 1;
      liveTasks.current = { threadId: sessionThreadId, tasks };
    }
    if (typeof running === 'boolean' || tasks) {
      const stateQueryKey = queryKeys.agentControllerConnectionState(
        agentControllerId,
        resourceId,
        scope,
        sessionThreadId,
      );
      const updatedAt = queryClient.getQueryState(stateQueryKey)?.dataUpdatedAt;
      queryClient.setQueryData<AgentControllerSessionState>(
        stateQueryKey,
        current =>
          current
            ? {
                ...current,
                ...(typeof running === 'boolean' ? { running } : {}),
                ...(tasks ? { tasks } : {}),
              }
            : current,
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
