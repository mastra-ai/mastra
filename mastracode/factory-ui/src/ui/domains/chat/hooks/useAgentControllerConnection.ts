import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';
import { useMutationState, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { queryKeys } from '../../../../api/keys';
import type { FactorySessionState } from '../context/ChatSessionContext';
import { createAgentControllerClient } from '../services/agentControllerClient';
import { useAgentControllerEvents } from './useAgentControllerEvents';
import { useAgentControllerSessionInit } from '../../../../hooks/useAgentControllerSessionInit';
import { useAgentControllerSessionSync } from '../../../../hooks/useAgentControllerSessionSync';
import type { AgentControllerLiveState } from '../../../../hooks/useAgentControllerSessionSync';
import { switchThreadMutationKey } from '../../../../hooks/useAgentControllerThreadMutations';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';
type SseConnectionState = 'never' | 'connected' | 'dropped';

function nextSseConnectionState(previous: SseConnectionState, connected: boolean): SseConnectionState {
  if (connected) return 'connected';
  return previous === 'connected' ? 'dropped' : previous;
}

interface UseAgentControllerConnectionArgs {
  agentControllerId: string;
  sessionId: string;
  /** Memory resource the session is created under (see ChatSessionContextApi). */
  resourceId: string;
  threadTags?: Record<string, string>;
  /** Exact thread id to bind on session creation (see ChatSessionContextApi). */
  sessionThreadId?: string;
  factorySessionState?: FactorySessionState;
  baseUrl?: string;
  enabled?: boolean;
  onEvent: (event: AgentControllerEvent) => void;
}

export function useAgentControllerConnection({
  agentControllerId,
  sessionId,
  resourceId,
  threadTags,
  sessionThreadId,
  factorySessionState,
  baseUrl = '',
  enabled = true,
  onEvent,
}: UseAgentControllerConnectionArgs) {
  const queryClient = useQueryClient();
  const [sseConnectionState, setSseConnectionState] = useState<SseConnectionState>('never');
  const sseStateRef = useRef<SseConnectionState>('never');
  const liveEventGeneration = useRef(0);
  const liveState = useRef<AgentControllerLiveState>(undefined);
  const sseConnected = sseConnectionState === 'connected';
  const hasEverConnected = sseConnectionState !== 'never';
  const { session } = createAgentControllerClient({
    agentControllerId,
    sessionId,
    baseUrl,
    enabled,
  });
  const initQuery = useAgentControllerSessionInit({
    agentControllerId,
    sessionId,
    resourceId,
    threadTags,
    sessionThreadId,
    factorySessionState,
    baseUrl,
    enabled,
  });
  const syncQuery = useAgentControllerSessionSync({
    agentControllerId,
    sessionId,
    threadId: sessionThreadId,
    baseUrl,
    enabled: enabled && initQuery.isSuccess,
    sseConnected,
    liveEventGeneration,
    liveState,
  });
  const observedRun = useRef<{ sessionId: string; running?: boolean }>({ sessionId });
  const streamRun = useRef<'started' | 'ended'>(undefined);
  const tracked = useRef<{ sessionId: string; dropped: boolean; seq?: number }>({ sessionId, dropped: false });
  const trackedStream = () => {
    if (tracked.current.sessionId !== sessionId) tracked.current = { sessionId, dropped: false };
    return tracked.current;
  };
  useEffect(() => {
    const running = syncQuery.data?.running;
    const previous = observedRun.current;
    observedRun.current = { sessionId, running };
    const streamEnded = streamRun.current === 'ended';
    if (running !== true || streamEnded) streamRun.current = undefined;
    if (previous.sessionId !== sessionId || previous.running !== true || running !== false || streamEnded) return;
    // A state poll can discover completion even when the stream missed the
    // final message, and a stream that joined mid-run never drew the in-flight
    // message. Recover it through the window merge; only a run this stream saw
    // from start to end without a gap needs no refetch.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerSessionThreadMessages(agentControllerId, sessionId),
    });
  }, [agentControllerId, queryClient, sessionId, syncQuery.data?.running]);
  const handleConnectedChange = (connected: boolean) => {
    // Ref mirrors the state so back-to-back events see the true previous value
    // even when React batches the renders in between.
    const previous = sseStateRef.current;
    const next = nextSseConnectionState(previous, connected);
    if (next === previous) return;
    sseStateRef.current = next;
    setSseConnectionState(next);
    if (next === 'dropped') trackedStream().dropped = true;
    if (next !== 'connected') return;
    // The stream opens after the session is bound to its thread, so a window
    // read that raced that binding works now.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerSessionThreadMessages(agentControllerId, sessionId),
      predicate: query => query.state.status === 'error',
    });
  };

  // The server does not replay missed events: mergeWindow folds the refetched
  // window back in, and the state refetch covers a missed agent_start/agent_end.
  const recoverMissedEvents = () => {
    streamRun.current = undefined;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerSessionThreadMessages(agentControllerId, sessionId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerConnectionState(agentControllerId, sessionId, sessionThreadId),
      exact: true,
    });
  };

  // A stream opens on a snapshot numbered like the session's last event, and
  // each later event is numbered one higher: anything else means events were missed.
  const trackSeq = (event: AgentControllerEvent, opensStream: boolean) => {
    const seq = typeof event.seq === 'number' ? event.seq : undefined;
    const stream = trackedStream();
    const last = stream.seq;
    if (seq !== undefined) stream.seq = opensStream ? seq : Math.max(seq, last ?? seq);
    const missed = opensStream
      ? stream.dropped && (seq === undefined || seq !== last)
      : last !== undefined && seq !== undefined && seq > last + 1;
    if (missed) recoverMissedEvents();
  };

  const handleEvent = (event: AgentControllerEvent, opensStream: boolean) => {
    trackSeq(event, opensStream);
    const displayStateRunning =
      isKnownAgentControllerEvent(event) && event.type === 'display_state_changed'
        ? event.displayState.isRunning
        : undefined;
    const running = event.type === 'agent_start' ? true : event.type === 'agent_end' ? false : displayStateRunning;
    const tasks = isKnownAgentControllerEvent(event) && event.type === 'task_updated' ? event.tasks : undefined;
    if (event.type === 'agent_start') streamRun.current = 'started';
    else if (running === false && streamRun.current) streamRun.current = 'ended';
    if (typeof running === 'boolean' || tasks) {
      // Bump the generation so a state request that was already in flight
      // knows this event is newer than its response, and keep the latest
      // tasks and running flag for that request to reconcile against.
      liveEventGeneration.current += 1;
      const previous = liveState.current?.threadId === sessionThreadId ? liveState.current : undefined;
      liveState.current = {
        ...previous,
        threadId: sessionThreadId,
        ...(typeof running === 'boolean' ? { running } : {}),
        ...(tasks ? { tasks } : {}),
      };
      const stateQueryKey = queryKeys.agentControllerConnectionState(agentControllerId, sessionId, sessionThreadId);
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
  // State is read for the session's primary thread and echoes it back, so only a switch moves the binding.
  const switchedThreadId = useMutationState({
    filters: { mutationKey: switchThreadMutationKey(agentControllerId, sessionId), status: 'success' },
    select: mutation => (typeof mutation.state.variables === 'string' ? mutation.state.variables : undefined),
  }).at(-1);

  return {
    status,
    state: syncQuery.data,
    threadId: switchedThreadId ?? syncQuery.data?.threadId ?? initQuery.data?.threadId ?? undefined,
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
