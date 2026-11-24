import { useQueryClient } from '@tanstack/react-query';
import type { QueryFilters } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

/** Agents write Knowledge while it is open. Without the change stream, the open queries poll at this interval. */
const POLL_MS = 5_000;
/**
 * The stream carries writes made in the server process the page is connected to. Behind a load balancer,
 * writes on another replica are not on it, so a slow poll still catches those.
 */
const LIVE_POLL_MS = 60_000;
const RECONNECT_MS = 5_000;
/** A burst of writes (a page and its notes) refreshes once. */
const BURST_MS = 150;
/** A refresh rereads every open Knowledge query, the whole page graph included. */
const MIN_REFRESH_GAP_MS = 5_000;

export const knowledgePollInterval = (live: boolean) => (live ? LIVE_POLL_MS : POLL_MS);

export interface KnowledgeChangeFeed {
  /** Opens the change stream, calls `onConnected` once it is open and `onChange` per notice, and settles when it ends. */
  follow(signal: AbortSignal, handlers: { onConnected: () => void; onChange: () => void }): Promise<void>;
  /** A failure retrying cannot fix, such as a server without the stream or a refused caller. */
  isFinal(error: unknown): boolean;
  /** The queries a change makes stale. */
  queries: QueryFilters;
}

function onVisibilityChange(notify: () => void) {
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
}
const pageVisible = () => document.visibilityState !== 'hidden';

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
  });
}

/** Runs `refresh` when asked: one at a time, starts at least MIN_REFRESH_GAP_MS apart, asks during one run it once more. */
function refreshRounds(refresh: () => Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let requested = false;
  let stopped = false;
  let lastStart = Number.NEGATIVE_INFINITY;
  const schedule = () => {
    timer = setTimeout(run, Math.max(BURST_MS, lastStart + MIN_REFRESH_GAP_MS - Date.now()));
  };
  const run = async () => {
    timer = undefined;
    requested = false;
    running = true;
    lastStart = Date.now();
    try {
      await refresh();
    } finally {
      running = false;
      if (requested && !stopped) schedule();
    }
  };
  return {
    request: () => {
      requested = true;
      if (!running && !timer && !stopped) schedule();
    },
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

/**
 * Follows `feed` while the tab is visible and refreshes its queries when a change arrives. Returns whether the
 * stream is open, so the queries poll only while it isn't.
 *
 * An agent writing continuously sends a notice per write, and each refresh rereads the whole page graph. So one
 * refresh runs at a time, at most one per MIN_REFRESH_GAP_MS, and the notices that arrive meanwhile start a
 * single refresh after it: the server never runs two graph reads for one tab.
 *
 * The stream holds an HTTP connection open, and a browser allows about six per host over HTTP/1.1. A hidden tab
 * closes its stream, and reconnects and refreshes when it is shown again.
 */
export function useKnowledgeChangeFeed(feed: KnowledgeChangeFeed | undefined): boolean {
  const queryClient = useQueryClient();
  const visible = useSyncExternalStore(onVisibilityChange, pageVisible, () => true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!feed || !visible) return;
    const abort = new AbortController();
    const refresh = refreshRounds(() => queryClient.invalidateQueries(feed.queries));
    void (async () => {
      while (!abort.signal.aborted) {
        try {
          await feed.follow(abort.signal, {
            onConnected: () => {
              setLive(true);
              // Writes may have landed while no stream was open.
              refresh.request();
            },
            onChange: refresh.request,
          });
        } catch (error) {
          // Falls back to polling: for good when retrying can't help, otherwise until it reconnects.
          if (feed.isFinal(error)) {
            setLive(false);
            return;
          }
        }
        if (abort.signal.aborted) return;
        setLive(false);
        await sleep(RECONNECT_MS, abort.signal);
      }
    })();
    return () => {
      abort.abort();
      refresh.stop();
      setLive(false);
    };
  }, [feed, queryClient, visible]);

  return live;
}
