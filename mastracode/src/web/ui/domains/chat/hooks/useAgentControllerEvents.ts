import type { AgentControllerEvent } from '@mastra/client-js';
import { useEffect, useRef, useState } from 'react';

import type { AgentControllerSession } from '../services/agentControllerClient';

export type SseConnectionState = 'never' | 'connected' | 'dropped';

interface UseAgentControllerEventsArgs {
  session: AgentControllerSession | null;
  enabled: boolean;
  epoch: number;
  onEvent: (event: AgentControllerEvent) => void;
  onConnectedChange: (connected: boolean) => void;
}

export function useAgentControllerEvents({
  session,
  enabled,
  epoch,
  onEvent,
  onConnectedChange,
}: UseAgentControllerEventsArgs) {
  const [connectionState, setConnectionStateSnapshot] = useState<SseConnectionState>('never');
  const connectedSnapshotRef = useRef<SseConnectionState>('never');
  const onEventRef = useRef(onEvent);
  const onConnectedChangeRef = useRef(onConnectedChange);

  onEventRef.current = onEvent;
  onConnectedChangeRef.current = onConnectedChange;

  useEffect(() => {
    if (!enabled || !session || !epoch) return;

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    const setConnectionState = (state: SseConnectionState) => {
      if (connectedSnapshotRef.current === state) return;
      connectedSnapshotRef.current = state;
      onConnectedChangeRef.current(state === 'connected');
      setConnectionStateSnapshot(state);
    };

    const disconnect = () => {
      if (connectedSnapshotRef.current === 'connected') setConnectionState('dropped');
    };

    void session
      .subscribe({
        onEvent: event => onEventRef.current(event),
        onError: () => {
          if (!disposed) disconnect();
        },
      })
      .then(
        sub => {
          if (disposed) {
            sub.unsubscribe();
            return;
          }
          unsubscribe = sub.unsubscribe;
          setConnectionState('connected');
        },
        () => {
          if (!disposed) disconnect();
        },
      );

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [enabled, session, epoch]);

  return connectionState;
}
