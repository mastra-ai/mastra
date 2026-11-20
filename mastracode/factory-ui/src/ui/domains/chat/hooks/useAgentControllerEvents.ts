import type { AgentControllerEvent } from '@mastra/client-js';
import { useEffect, useRef, useState } from 'react';

import { useRecentlyVisible } from '../../../lib/hooks/useDocumentVisible';
import type { AgentControllerSession } from '../services/agentControllerClient';

export type SseConnectionState = 'never' | 'connected' | 'dropped';

interface UseAgentControllerEventsArgs {
  session: AgentControllerSession | null;
  enabled: boolean;
  epoch: number;
  onEvent: (event: AgentControllerEvent, opensStream: boolean) => void;
  onConnectedChange: (connected: boolean) => void;
}

interface SharedSubscription {
  state: SseConnectionState;
  /** A subscribe attempt is in flight — do not start another. */
  connecting: boolean;
  /** Id of the latest stream attempt; ids are unique across subscriptions. */
  stream: number;
  /** The latest stream has delivered its first event. */
  opened: boolean;
  eventListeners: Set<(event: AgentControllerEvent, opensStream: boolean) => void>;
  stateListeners: Set<(state: SseConnectionState) => void>;
  unsubscribe?: () => void;
  teardown?: ReturnType<typeof setTimeout>;
  disposed?: boolean;
}

const subscriptions = new WeakMap<AgentControllerSession, SharedSubscription>();
let lastStream = 0;

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
  const stream = ++lastStream;
  subscription.stream = stream;
  subscription.opened = false;

  void session
    .subscribe({
      displayState: false,
      onEvent: event => {
        if (subscription.stream !== stream) return;
        const opensStream = !subscription.opened;
        subscription.opened = true;
        for (const listener of subscription.eventListeners) listener(event, opensStream);
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
      stream: 0,
      opened: false,
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
  // A hidden tab must not hold a stream: browsers cap HTTP/1.1 at 6 connections
  // per host, so a few background tabs starve every other request to the app.
  // A tab hidden past the grace period tears the subscription down through the
  // normal cleanup path; regaining visibility re-subscribes and re-syncs like
  // any reconnect. A quick tab switch keeps the stream.
  const visible = useRecentlyVisible();
  const onEventRef = useRef(onEvent);
  const onConnectedChangeRef = useRef(onConnectedChange);
  // Initial state (the reply in flight) arrives once per stream; a remount attached past it reopens the stream.
  const seenOpening = useRef(0);

  onEventRef.current = onEvent;
  onConnectedChangeRef.current = onConnectedChange;

  useEffect(() => {
    if (!enabled || !session || !epoch || !visible) return;

    const subscription = getSubscription(session);
    const missedOpening =
      subscription.state === 'connected' && subscription.opened && seenOpening.current !== subscription.stream;
    const handleEvent = (event: AgentControllerEvent, opensStream: boolean) => {
      if (opensStream) seenOpening.current = subscription.stream;
      onEventRef.current(event, opensStream);
    };
    const handleState = (state: SseConnectionState) => {
      onConnectedChangeRef.current(state === 'connected');
      setConnectionState(state);
    };

    subscription.eventListeners.add(handleEvent);
    subscription.stateListeners.add(handleState);
    if (missedOpening) setState(subscription, 'dropped');
    else handleState(subscription.state);
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
  }, [enabled, session, epoch, visible]);

  return connectionState;
}
