import type { AgentControllerEvent } from '@mastra/client-js';
import { useEffect } from 'react';

import type { AgentControllerSession } from './useAgentControllerClient';

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
  useEffect(() => {
    if (!enabled || !session || !epoch) return;

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    void session
      .subscribe({
        onEvent,
        onError: () => {
          if (!disposed) onConnectedChange(false);
        },
      })
      .then(
        sub => {
          if (disposed) {
            sub.unsubscribe();
            return;
          }
          unsubscribe = sub.unsubscribe;
          onConnectedChange(true);
        },
        () => {
          if (!disposed) onConnectedChange(false);
        },
      );

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [session, enabled, epoch, onEvent, onConnectedChange]);
}
