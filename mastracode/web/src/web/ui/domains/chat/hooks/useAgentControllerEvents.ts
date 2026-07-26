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
  /** A subscribe attempt is in flight — do not start another. */
  connecting: boolean;
  eventListeners: Set<(event: AgentControllerEvent) => void>;
  stateListeners: Set<(state: SseConnectionState) => void>;
  unsubscribe?: () => void;
  teardown?: ReturnType<typeof setTimeout>;
  disposed?: boolean;
}

const subscriptions = new WeakMap<AgentControllerSession, SharedSubscription>();

function setState(subscription: SharedSubscription, state: SseConnectionState) {
  if (subscription.state === state) return;
  subscription.state = state;
  for (const listener of subscription.stateListeners) listener(state);
}

/**
 * Start a stream attempt unless one is already established or in flight.
 *
 * Callers re-invoke this on every sync epoch bump; that is what retries a
 * dropped (or never-established) stream after the state re-sync completes.
 * A healthy or still-connecting stream must NOT be torn down by an epoch
 * bump: while the stream is disconnected the session-state query polls
 * every second (see useAgentControllerSessionSync), so cancelling the
 * in-flight subscribe on each successful poll livelocks — the stream can
 * never finish connecting, which keeps the poll alive, which keeps
 * cancelling the stream.
 */
function ensureConnected(session: AgentControllerSession, subscription: SharedSubscription) {
  if (subscription.connecting || subscription.state === 'connected') return;

  subscription.unsubscribe?.();
  subscription.unsubscribe = undefined;
  subscription.connecting = true;

  void session
    .subscribe({
      onEvent: event => {
        for (const listener of subscription.eventListeners) listener(event);
      },
      onError: () => {
        if (subscription.state === 'connected') setState(subscription, 'dropped');
      },
    })
    .then(
      sub => {
        subscription.connecting = false;
        if (subscription.disposed) {
          sub.unsubscribe();
          return;
        }
        subscription.unsubscribe = sub.unsubscribe;
        setState(subscription, 'connected');
      },
      () => {
        subscription.connecting = false;
        if (subscription.state === 'connected') setState(subscription, 'dropped');
      },
    );
}

function getSubscription(session: AgentControllerSession) {
  let subscription = subscriptions.get(session);
  if (!subscription) {
    subscription = {
      state: 'never',
      connecting: false,
      eventListeners: new Set(),
      stateListeners: new Set(),
    };
    subscriptions.set(session, subscription);
  }

  if (subscription.teardown) {
    clearTimeout(subscription.teardown);
    subscription.teardown = undefined;
  }

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

    const subscription = getSubscription(session);
    const handleEvent = (event: AgentControllerEvent) => onEventRef.current(event);
    const handleState = (state: SseConnectionState) => {
      onConnectedChangeRef.current(state === 'connected');
      setConnectionState(state);
    };

    subscription.eventListeners.add(handleEvent);
    subscription.stateListeners.add(handleState);
    handleState(subscription.state);
    ensureConnected(session, subscription);

    return () => {
      subscription.eventListeners.delete(handleEvent);
      subscription.stateListeners.delete(handleState);
      if (subscription.eventListeners.size > 0 || subscription.stateListeners.size > 0) return;

      subscription.teardown = setTimeout(() => {
        if (subscription.eventListeners.size > 0 || subscription.stateListeners.size > 0) return;
        subscription.disposed = true;
        subscription.unsubscribe?.();
        subscriptions.delete(session);
      }, 0);
    };
  }, [enabled, session, epoch]);

  return connectionState;
}
