import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { queryKeys } from '../../../../api/keys';
import type { FactorySessionState } from '../context/ChatSessionContext';
import { createAgentControllerClient } from '../services/agentControllerClient';
import { useAgentControllerEvents } from './useAgentControllerEvents';
import { useAgentControllerSessionInit } from '../../../../hooks/useAgentControllerSessionInit';
import {
  type PendingThreadVerification,
  isSessionThreadConflict,
  useAgentControllerSessionSync,
} from '../../../../hooks/useAgentControllerSessionSync';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'conflict' | 'error';
type SseConnectionState = 'never' | 'connected' | 'dropped';

function nextSseConnectionState(previous: SseConnectionState, connected: boolean): SseConnectionState {
  if (connected) return 'connected';
  return previous === 'connected' ? 'dropped' : previous;
}

function eventThreadId(event: AgentControllerEvent): string | null | undefined {
  if (!isKnownAgentControllerEvent(event)) return undefined;
  switch (event.type) {
    case 'display_state_changed':
      return event.displayState.threadId ?? null;
    case 'thread_changed':
      return event.threadId;
    case 'thread_created':
      return event.thread.id;
    default:
      return undefined;
  }
}

interface UseAgentControllerConnectionArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  sessionThreadId?: string;
  initialThreadId?: string;
  displayThreadId?: string;
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
  initialThreadId,
  displayThreadId,
  factorySessionState,
  baseUrl = '',
  enabled = true,
  onEvent,
}: UseAgentControllerConnectionArgs) {
  const queryClient = useQueryClient();
  const requestedThreadId = initialThreadId ?? sessionThreadId;
  const stateQueryKey = queryKeys.agentControllerConnectionState(
    agentControllerId,
    resourceId,
    scope,
    requestedThreadId,
  );
  const [sseConnectionState, setSseConnectionState] = useState<SseConnectionState>('never');
  // Stream callbacks can run before React commits the previous callback's updates.
  const sseStateRef = useRef<SseConnectionState>('never');
  const pendingVerification = useRef<PendingThreadVerification>(undefined);
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
    initialThreadId,
    factorySessionState,
    baseUrl,
    enabled,
  });
  const syncQuery = useAgentControllerSessionSync({
    agentControllerId,
    resourceId,
    scope,
    threadId: requestedThreadId,
    baseUrl,
    enabled: enabled && initQuery.isSuccess && !initQuery.isFetching,
    sseConnected,
    pendingVerification,
    taskEventGeneration,
    liveTasks,
  });
  const activeThreadId =
    displayThreadId ?? requestedThreadId ?? syncQuery.data?.threadId ?? initQuery.data?.threadId ?? undefined;
  const sessionThreadConflict =
    !initQuery.isFetching && isSessionThreadConflict(syncQuery.error) && activeThreadId === requestedThreadId;
  const verifyingCurrentThread =
    activeThreadId !== undefined && pendingVerification.current?.threadId === activeThreadId;
  const hasCurrentState =
    !initQuery.isFetching &&
    !sessionThreadConflict &&
    activeThreadId !== undefined &&
    syncQuery.data?.threadId === activeThreadId;
  const state = hasCurrentState ? syncQuery.data : undefined;

  const handleConnectedChange = (connected: boolean) => {
    const previous = sseStateRef.current;
    const next = nextSseConnectionState(previous, connected);
    if (next === previous) return;
    sseStateRef.current = next;
    setSseConnectionState(next);
    if (next !== 'connected') return;
    // Streams don't replay missed transcript events.
    const reconnected = previous === 'dropped';
    void queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerResourceThreadMessages(agentControllerId, resourceId),
      predicate: query => reconnected || query.state.status === 'error',
    });
    if (reconnected) {
      void queryClient.invalidateQueries({
        queryKey: stateQueryKey,
        exact: true,
      });
    }
  };

  const handleEvent = (event: AgentControllerEvent) => {
    if (sessionThreadConflict) return;
    const verification = pendingVerification.current;
    const verifyingThisThread = verification !== undefined && verification.threadId === activeThreadId;
    const incomingThreadId = eventThreadId(event);
    if (incomingThreadId !== undefined && incomingThreadId !== activeThreadId) {
      const exactThreadBound = requestedThreadId !== undefined && activeThreadId === requestedThreadId;
      const initializingBinding =
        queryClient.isFetching({
          queryKey: queryKeys.agentControllerConnectionInit(agentControllerId, resourceId, scope),
        }) > 0;
      const verifyingSameBinding = verifyingThisThread && verification.observedThreadId === incomingThreadId;
      const shouldVerify = exactThreadBound && !initializingBinding && !verifyingSameBinding;
      if (shouldVerify) {
        pendingVerification.current = { threadId: activeThreadId, observedThreadId: incomingThreadId };
        void queryClient.cancelQueries({ queryKey: stateQueryKey, exact: true }).then(() => syncQuery.refetch());
      }
      return;
    }
    if (verifyingThisThread) {
      if (incomingThreadId !== undefined) verification.observedThreadId = incomingThreadId;
      return;
    }
    const displayState =
      isKnownAgentControllerEvent(event) && event.type === 'display_state_changed' ? event.displayState : undefined;

    const running = event.type === 'agent_start' ? true : event.type === 'agent_end' ? false : displayState?.isRunning;
    const tasks =
      isKnownAgentControllerEvent(event) && event.type === 'task_updated' ? event.tasks : displayState?.tasks;
    if (tasks) {
      taskEventGeneration.current += 1;
      liveTasks.current = { threadId: activeThreadId, tasks };
    }
    if (typeof running === 'boolean' || tasks) {
      const updatedAt = queryClient.getQueryState(stateQueryKey)?.dataUpdatedAt;
      queryClient.setQueryData<AgentControllerSessionState>(
        stateQueryKey,
        current =>
          current && current.threadId === activeThreadId
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
    enabled: enabled && initQuery.isSuccess && !initQuery.isFetching && !sessionThreadConflict,
    epoch: syncQuery.dataUpdatedAt,
    onEvent: handleEvent,
    onConnectedChange: handleConnectedChange,
  });

  const status = deriveConnectionStatus({
    initIsError: initQuery.isError,
    syncIsError: syncQuery.isError,
    sessionThreadConflict,
    hasSyncData: Boolean(state),
    sseConnected: sseConnected && !verifyingCurrentThread,
    hasEverConnected,
    syncFailureCount: syncQuery.failureCount,
  });

  return {
    status,
    state,
    threadId: activeThreadId,
  };
}

export function deriveConnectionStatus({
  initIsError,
  syncIsError,
  sessionThreadConflict = false,
  hasSyncData,
  sseConnected,
  hasEverConnected,
  syncFailureCount,
}: {
  initIsError: boolean;
  syncIsError: boolean;
  sessionThreadConflict?: boolean;
  hasSyncData: boolean;
  sseConnected: boolean;
  hasEverConnected: boolean;
  syncFailureCount: number;
}): ConnectionStatus {
  if (sessionThreadConflict) return 'conflict';
  if (initIsError || (syncIsError && !hasSyncData)) return 'error';
  if (!hasSyncData) return 'connecting';
  if (!sseConnected && syncFailureCount >= 10) return 'error';
  if (!sseConnected) return hasEverConnected ? 'reconnecting' : 'connecting';
  return 'ready';
}
