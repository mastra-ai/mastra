import type {
  HarnessSessionSnapshot,
  RemoteHarnessEventUnsubscribe,
  RemoteHarnessSessionOptions,
  RemoteHarnessSubscriptionOptions,
  RemoteSession,
} from '@mastra/client-js';
import type { HarnessEvent } from '@mastra/core/harness/v1';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useMastraClient } from '../mastra-client-context';

export interface UseRemoteHarnessSessionOptions {
  /** Enables the hook. Disabled hooks keep no active refresh or event subscription. */
  enabled?: boolean;
  /** Opens an event subscription against the remote session. Defaults to true. */
  subscribe?: boolean;
  /** Allows the underlying client-js subscription to reconnect after retryable failures. Defaults to true. */
  reconnect?: boolean;
  /** Initial replay cursor passed through to client-js as Last-Event-ID. */
  lastEventId?: string;
  /** Refreshes the durable session snapshot after events. Defaults to true and coalesces concurrent refreshes. */
  refreshOnEvent?: boolean;
  /** Maximum recent events retained in hook state. Set to 0 to keep only callbacks. */
  maxEvents?: number;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
  onReplayGap?: () => void | Promise<void>;
}

export interface UseHarnessSessionOptions extends RemoteHarnessSessionOptions, UseRemoteHarnessSessionOptions {
  /** Harness resource name. Defaults to the server's default Harness. */
  harnessName?: string;
}

export interface UseRemoteHarnessSessionResult {
  session: RemoteSession | undefined;
  snapshot: HarnessSessionSnapshot | undefined;
  events: HarnessEvent[];
  pendingInbox: HarnessSessionSnapshot['pendingInbox'];
  durableWork: HarnessSessionSnapshot['durableWork'];
  isLoading: boolean;
  isSubscribed: boolean;
  error: Error | undefined;
  refresh: () => Promise<HarnessSessionSnapshot | undefined>;
}

const DEFAULT_MAX_EVENTS = 100;
const EMPTY_PENDING_INBOX: HarnessSessionSnapshot['pendingInbox'] = [];
const EMPTY_DURABLE_WORK: HarnessSessionSnapshot['durableWork'] = {
  active: [],
  recentTerminal: [],
  truncated: false,
  sessionOwnedOnly: true,
};
const useCommittedRefEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useHarnessSession(options: UseHarnessSessionOptions = {}): UseRemoteHarnessSessionResult {
  const {
    harnessName = 'default',
    enabled = true,
    subscribe,
    reconnect,
    lastEventId,
    refreshOnEvent,
    maxEvents,
    onEvent,
    onError,
    onReplayGap,
    ...sessionOptions
  } = options;
  const client = useMastraClient();
  const [session, setSession] = useState<RemoteSession>();
  const [openError, setOpenError] = useState<Error>();
  const [isOpening, setIsOpening] = useState(false);
  const sessionOptionsKey = useMemo(() => JSON.stringify(sessionOptions), [sessionOptions]);

  useEffect(() => {
    if (!enabled) {
      setSession(undefined);
      setOpenError(undefined);
      setIsOpening(false);
      return;
    }

    let active = true;
    setSession(undefined);
    setOpenError(undefined);
    setIsOpening(true);
    void client
      .getHarness(harnessName)
      .session(sessionOptions)
      .then(remoteSession => {
        if (active) setSession(remoteSession);
      })
      .catch(error => {
        if (active) {
          setSession(undefined);
          setOpenError(asError(error));
        }
      })
      .finally(() => {
        if (active) setIsOpening(false);
      });

    return () => {
      active = false;
    };
    // sessionOptionsKey intentionally captures the create/open DTO without
    // requiring callers to memoize object literals.
  }, [client, enabled, harnessName, sessionOptionsKey]);

  const state = useRemoteHarnessSession(session, {
    enabled: enabled && openError === undefined,
    subscribe,
    reconnect,
    lastEventId,
    refreshOnEvent,
    maxEvents,
    onEvent,
    onError,
    onReplayGap,
  });

  return { ...state, isLoading: isOpening || state.isLoading, error: openError ?? state.error };
}

export function useRemoteHarnessSession(
  session: RemoteSession | null | undefined,
  options: UseRemoteHarnessSessionOptions = {},
): UseRemoteHarnessSessionResult {
  const {
    enabled = true,
    subscribe = true,
    reconnect = true,
    lastEventId,
    refreshOnEvent = true,
    maxEvents = DEFAULT_MAX_EVENTS,
    onEvent,
    onError,
    onReplayGap,
  } = options;
  const [snapshot, setSnapshot] = useState<HarnessSessionSnapshot>();
  const [events, setEvents] = useState<HarnessEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error>();
  const mounted = useRef(false);
  const refreshSessionRef = useRef<() => Promise<HarnessSessionSnapshot | undefined>>(async () => undefined);
  const callbacks = useRef({ onError, onEvent, onReplayGap });
  const eventOptions = useRef({ maxEvents, refreshOnEvent });
  const refreshInFlight = useRef<Promise<HarnessSessionSnapshot | undefined> | undefined>(undefined);
  const refreshQueued = useRef(false);
  const queuedRefreshPromise = useRef<Promise<HarnessSessionSnapshot | undefined> | undefined>(undefined);
  const resolveQueuedRefresh = useRef<((snapshot: HarnessSessionSnapshot | undefined) => void) | undefined>(undefined);
  const rejectQueuedRefresh = useRef<((error: unknown) => void) | undefined>(undefined);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => refreshSessionRef.current(), []);
  const clearQueuedRefresh = useCallback(() => {
    queuedRefreshPromise.current = undefined;
    resolveQueuedRefresh.current = undefined;
    rejectQueuedRefresh.current = undefined;
  }, []);
  const getQueuedRefreshPromise = useCallback(() => {
    if (queuedRefreshPromise.current === undefined) {
      queuedRefreshPromise.current = new Promise<HarnessSessionSnapshot | undefined>((resolve, reject) => {
        resolveQueuedRefresh.current = resolve;
        rejectQueuedRefresh.current = reject;
      });
    }
    return queuedRefreshPromise.current;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      refreshQueued.current = false;
      resolveQueuedRefresh.current?.(undefined);
      clearQueuedRefresh();
    };
  }, [clearQueuedRefresh]);

  useCommittedRefEffect(() => {
    callbacks.current = { onError, onEvent, onReplayGap };
    eventOptions.current = { maxEvents, refreshOnEvent };
  });

  useEffect(() => {
    setEvents(prev => trimEvents(prev, maxEvents));
  }, [maxEvents]);

  useEffect(() => {
    refreshGeneration.current += 1;
    refreshInFlight.current = undefined;
    refreshQueued.current = false;
    resolveQueuedRefresh.current?.(undefined);
    clearQueuedRefresh();
    const generation = refreshGeneration.current;

    refreshSessionRef.current = async () => {
      if (!enabled || !session || !mounted.current) return undefined;
      if (refreshInFlight.current !== undefined) {
        refreshQueued.current = true;
        return getQueuedRefreshPromise();
      }

      setIsLoading(true);
      const request = session
        .refresh()
        .then(nextSnapshot => {
          if (mounted.current && refreshGeneration.current === generation) {
            setSnapshot(nextSnapshot);
            setError(undefined);
          }
          return nextSnapshot;
        })
        .catch(caught => {
          if (mounted.current && refreshGeneration.current === generation) setError(asError(caught));
          throw caught;
        })
        .finally(() => {
          if (!mounted.current || refreshGeneration.current !== generation) return;
          if (refreshInFlight.current === request) refreshInFlight.current = undefined;
          const shouldRefreshAgain = refreshQueued.current;
          refreshQueued.current = false;

          if (shouldRefreshAgain) {
            const resolveQueued = resolveQueuedRefresh.current;
            const rejectQueued = rejectQueuedRefresh.current;
            clearQueuedRefresh();
            const queuedRefresh = refreshSessionRef.current();
            void queuedRefresh.then(resolveQueued, rejectQueued);
          } else {
            setIsLoading(false);
          }
        });

      refreshInFlight.current = request;
      return request;
    };
  }, [clearQueuedRefresh, enabled, getQueuedRefreshPromise, session]);

  useEffect(() => {
    setSnapshot(undefined);
    setEvents([]);
    setError(undefined);
    if (!enabled || !session) {
      setIsLoading(false);
      return;
    }

    void refreshSessionRef.current().catch(() => {});
  }, [enabled, session]);

  useEffect(() => {
    if (!enabled || !session || !subscribe) {
      setIsSubscribed(false);
      return;
    }

    let active = true;
    let unsubscribe: RemoteHarnessEventUnsubscribe | undefined;
    const reportError = async (caught: unknown) => {
      if (!active || !mounted.current) return;
      if (active && mounted.current) setError(asError(caught));
      try {
        await callbacks.current.onError?.(caught);
      } catch (errorCallbackFailure) {
        if (active && mounted.current) setError(asError(errorCallbackFailure));
      }
    };
    const refreshIfActive = async () => {
      if (!active || !mounted.current) return;
      await refreshSessionRef.current().catch(reportError);
    };
    const subscriptionOptions: RemoteHarnessSubscriptionOptions = {
      reconnect,
      lastEventId,
      onError: async caught => {
        if (isTerminalSubscriptionError(caught, reconnect) && active && mounted.current) setIsSubscribed(false);
        await reportError(caught);
      },
      onReplayGap: async () => {
        await refreshIfActive();
        try {
          await callbacks.current.onReplayGap?.();
        } catch (caught) {
          await reportError(caught);
        }
      },
    };

    setIsSubscribed(false);
    try {
      unsubscribe = session.subscribe(async event => {
        if (!active || !mounted.current) return;
        setEvents(prev => appendEvent(prev, event, eventOptions.current.maxEvents));
        if (eventOptions.current.refreshOnEvent) {
          void refreshIfActive();
        }
        try {
          await callbacks.current.onEvent?.(event);
        } catch (caught) {
          await reportError(caught);
        }
      }, subscriptionOptions);
    } catch (caught) {
      void reportError(caught);
      return;
    }
    setIsSubscribed(true);

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [enabled, lastEventId, reconnect, session, subscribe]);

  return {
    session: session ?? undefined,
    snapshot,
    events,
    pendingInbox: snapshot?.pendingInbox ?? EMPTY_PENDING_INBOX,
    durableWork: snapshot?.durableWork ?? EMPTY_DURABLE_WORK,
    isLoading,
    isSubscribed,
    error,
    refresh,
  };
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function appendEvent(events: HarnessEvent[], event: HarnessEvent, maxEvents: number): HarnessEvent[] {
  return trimEvents([...events, event], maxEvents);
}

function trimEvents(events: HarnessEvent[], maxEvents: number): HarnessEvent[] {
  if (maxEvents <= 0) return events.length === 0 ? events : [];
  return events.length <= maxEvents ? events : events.slice(-maxEvents);
}

function isTerminalSubscriptionError(error: unknown, reconnect: boolean): boolean {
  if (!reconnect) return true;
  const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : undefined;
  return status !== undefined && status >= 400 && status < 500;
}
