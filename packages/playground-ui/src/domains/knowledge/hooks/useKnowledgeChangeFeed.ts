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

/** Runs `refresh` when asked: one at a time, at least MIN_REFRESH_GAP_MS after the previous one ended, asks during one run it once more. */
function refreshRounds(refresh: () => Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let requested = false;
  let stopped = false;
  let lastEnd = Number.NEGATIVE_INFINITY;
  const schedule = () => {
    timer = setTimeout(run, Math.max(BURST_MS, lastEnd + MIN_REFRESH_GAP_MS - Date.now()));
  };
  const run = async () => {
    timer = undefined;
    requested = false;
    running = true;
    try {
      await refresh();
    } finally {
      running = false;
      lastEnd = Date.now();
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
 * refresh runs at a time, each at least MIN_REFRESH_GAP_MS after the previous one ended, and the notices that
 * arrive meanwhile start a single refresh after it. A read already running, a poll or a refresh from before the
 * tab was hidden, is joined rather than restarted, since cancelling it in the browser does not stop it on the
 * server; its answer may predate the change, so one more refresh follows. The server never runs two reads of a
 * query for one tab.
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
    const refresh = refreshRounds(async () => {
      const answersMayPredateChange = queryClient.isFetching(feed.queries) > 0;
      // The default `cancelRefetch: true` would start a second read beside the running one.
      await queryClient.invalidateQueries(feed.queries, { cancelRefetch: false });
      if (answersMayPredateChange) refresh.request();
    });
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
