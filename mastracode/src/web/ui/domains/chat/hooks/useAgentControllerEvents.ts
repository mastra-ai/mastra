import type { AgentControllerEvent } from '@mastra/client-js';
import { useRef, useSyncExternalStore } from 'react';

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
  const connectedSnapshotRef = useRef<SseConnectionState>('never');

  const subscribe = (onStoreChange: () => void) => {
    if (!enabled || !session || !epoch) return () => {};

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    const setConnectionState = (state: SseConnectionState) => {
      if (connectedSnapshotRef.current === state) return;
      connectedSnapshotRef.current = state;
      onConnectedChange(state === 'connected');
      onStoreChange();
    };

    const disconnect = () => {
      if (connectedSnapshotRef.current === 'connected') setConnectionState('dropped');
    };

    void session
      .subscribe({
        onEvent,
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
  };

  return useSyncExternalStore(
    subscribe,
    () => connectedSnapshotRef.current,
    () => 'never',
  );
}
