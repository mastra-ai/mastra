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

interface SharedSubscription {
  state: SseConnectionState;
  eventListeners: Set<(event: AgentControllerEvent) => void>;
  stateListeners: Set<(state: SseConnectionState) => void>;
  unsubscribe?: () => void;
  teardown?: ReturnType<typeof setTimeout>;
  disposed?: boolean;
}

const subscriptions = new WeakMap<AgentControllerSession, Map<number, SharedSubscription>>();

function getSubscription(session: AgentControllerSession, epoch: number) {
  let sessionSubscriptions = subscriptions.get(session);
  if (!sessionSubscriptions) {
    sessionSubscriptions = new Map();
    subscriptions.set(session, sessionSubscriptions);
  }

  let subscription = sessionSubscriptions.get(epoch);
  if (subscription) {
    if (subscription.teardown) {
      clearTimeout(subscription.teardown);
      subscription.teardown = undefined;
    }
    return subscription;
  }

  subscription = {
    state: 'never',
    eventListeners: new Set(),
    stateListeners: new Set(),
  };
  sessionSubscriptions.set(epoch, subscription);

  const setState = (state: SseConnectionState) => {
    if (subscription?.state === state) return;
    subscription!.state = state;
    for (const listener of subscription!.stateListeners) listener(state);
  };

  void session
    .subscribe({
      onEvent: event => {
        for (const listener of subscription!.eventListeners) listener(event);
      },
      onError: () => {
        if (subscription?.state === 'connected') setState('dropped');
      },
    })
    .then(
      sub => {
        if (subscription!.disposed) {
          sub.unsubscribe();
          return;
        }
        subscription!.unsubscribe = sub.unsubscribe;
        setState('connected');
      },
      () => {
        if (subscription?.state === 'connected') setState('dropped');
      },
    );

  return subscription;
}

export function useAgentControllerEvents({
  session,
  enabled,
  epoch,
  onEvent,
  onConnectedChange,
}: UseAgentControllerEventsArgs) {
  const [connectionState, setConnectionState] = useState<SseConnectionState>('never');
  const onEventRef = useRef(onEvent);
  const onConnectedChangeRef = useRef(onConnectedChange);

  onEventRef.current = onEvent;
  onConnectedChangeRef.current = onConnectedChange;

  useEffect(() => {
    if (!enabled || !session || !epoch) return;

    const subscription = getSubscription(session, epoch);
    const handleEvent = (event: AgentControllerEvent) => onEventRef.current(event);
    const handleState = (state: SseConnectionState) => {
      onConnectedChangeRef.current(state === 'connected');
      setConnectionState(state);
    };

    subscription.eventListeners.add(handleEvent);
    subscription.stateListeners.add(handleState);
    handleState(subscription.state);

    return () => {
      subscription.eventListeners.delete(handleEvent);
      subscription.stateListeners.delete(handleState);
      if (subscription.eventListeners.size > 0 || subscription.stateListeners.size > 0) return;

      subscription.teardown = setTimeout(() => {
        if (subscription.eventListeners.size > 0 || subscription.stateListeners.size > 0) return;
        subscription.disposed = true;
        subscription.unsubscribe?.();
        subscriptions.get(session)?.delete(epoch);
      }, 0);
    };
  }, [enabled, session, epoch]);

  return connectionState;
}
