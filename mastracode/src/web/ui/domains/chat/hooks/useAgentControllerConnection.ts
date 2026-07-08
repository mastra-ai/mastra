import type { AgentControllerEvent, AgentControllerModeInfo } from '@mastra/client-js';
import { useEffect, useState } from 'react';

import { queryKeys } from '../../../../../shared/api/keys';
import { useAgentControllerClient } from './useAgentControllerClient';
import type { AgentControllerSession } from './useAgentControllerClient';

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'error';

type SessionState = Awaited<ReturnType<AgentControllerSession['state']>>;

interface UseAgentControllerConnectionArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
  onEvent: (event: AgentControllerEvent) => void;
  onInitialState: (state: SessionState, threadId?: string) => void;
  onReconnectState: (state: SessionState) => void;
  onReconnectMessagesInvalidated: (queryKey: ReturnType<typeof queryKeys.agentControllerThreadMessages>) => void;
}

export function useAgentControllerConnection({
  agentControllerId,
  resourceId,
  projectPath,
  baseUrl = '',
  enabled = true,
  onEvent,
  onInitialState,
  onReconnectState,
  onReconnectMessagesInvalidated,
}: UseAgentControllerConnectionArgs) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [modes, setModes] = useState<AgentControllerModeInfo[]>([]);
  const { controller, session } = useAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  useEffect(() => {
    if (!enabled || !controller || !session) {
      setStatus('connecting');
      setModes([]);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const MAX_RETRIES = 10;
    const MAX_DELAY_MS = 30_000;
    let attempt = 0;

    function scheduleReconnect(activeSession: AgentControllerSession): void {
      if (disposed) return;
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        setStatus('error');
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), MAX_DELAY_MS);
      reconnectTimer = setTimeout(() => void subscribe(activeSession, true), delay);
    }

    async function subscribe(activeSession: AgentControllerSession, isReconnect: boolean): Promise<void> {
      if (disposed) return;

      if (isReconnect) {
        setStatus('reconnecting');
        try {
          const state = await activeSession.state();
          if (disposed) return;
          onReconnectState(state);
          onReconnectMessagesInvalidated(
            queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, state.threadId),
          );
        } catch {
          // Keep trying to subscribe even if state re-sync fails.
        }
      }

      try {
        const sub = await activeSession.subscribe({
          onEvent,
          onError: () => {
            unsubscribe?.();
            unsubscribe = undefined;
            scheduleReconnect(activeSession);
          },
        });
        unsubscribe = sub.unsubscribe;
        if (!disposed) {
          attempt = 0;
          setStatus('ready');
        }
      } catch {
        scheduleReconnect(activeSession);
      }
    }

    (async () => {
      try {
        const [created, agentControllerModes] = await Promise.all([
          session.create({ tags: projectPath ? { projectPath } : undefined }),
          controller.listModes(),
        ]);
        if (disposed) return;
        setModes(agentControllerModes);

        const state = await session.state();
        if (disposed) return;
        onInitialState(state, created.threadId ?? state.threadId);
        await subscribe(session, false);
      } catch {
        if (!disposed) setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      unsubscribe?.();
    };
  }, [agentControllerId, resourceId, projectPath, enabled, controller, session, onEvent, onInitialState, onReconnectState, onReconnectMessagesInvalidated]);

  return { status, modes };
}
