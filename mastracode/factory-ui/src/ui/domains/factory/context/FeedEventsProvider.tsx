import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useRecentlyVisible } from '../../../lib/hooks/useDocumentVisible';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { streamFeedEvents } from '../services/feedEvents';
import { RequestError } from '../services/request';

const RETRY_MS = 3_000;
/** Frames this close together refresh the board once. */
const BOARD_REFRESH_SETTLE_MS = 300;
/** A busy board refreshes at most this often, about the pace it used to poll at. */
const BOARD_REFRESH_MIN_GAP_MS = 3_000;
/** While frames refresh the board, a poll only bounds how long a write that never announced itself stays hidden. */
const FEED_SAFETY_POLL_MS = 60_000;

const FeedEventsContext = createContext(false);

/** No provider means no stream, so consumers fall back to polling. */
export function useFeedEventsConnected(): boolean {
  return useContext(FeedEventsContext);
}

/** How often a board query polls: rarely while the stream refreshes it, at `fallbackMs` without one. */
export function useFeedPollInterval(fallbackMs: number): number {
  return useFeedEventsConnected() ? FEED_SAFETY_POLL_MS : fallbackMs;
}

/**
 * Holds the project's feed stream for every surface under the factory route.
 * A frame carries a work item id at most; the queries it invalidates refetch
 * through their own authed GET.
 */
export function FeedEventsProvider({ factoryProjectId, children }: { factoryProjectId: string; children: ReactNode }) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  // A hidden tab must not hold a stream: browsers cap HTTP/1.1 at 6 connections
  // per host, so a few background tabs starve every other request to the app.
  // A quick tab switch keeps the stream; only a tab left hidden releases it.
  const visible = useRecentlyVisible();
  const [connected, setConnected] = useState(false);
  const streamedProject = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!visible) return;

    const abort = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let settling: ReturnType<typeof setTimeout> | undefined;
    let refreshing: Promise<unknown> = Promise.resolve();
    let lastRefreshAt = Number.NEGATIVE_INFINITY;
    const boardKeys = [
      queryKeys.workItems(factoryProjectId),
      queryKeys.factoryDecisionsRoot(factoryProjectId),
      queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, baseUrl),
    ];
    // One refresh at a time: a frame cancelling a slow board read for the next would starve a busy board.
    const refreshBoard = () => {
      if (settling) return;
      const wait = Math.max(BOARD_REFRESH_SETTLE_MS, lastRefreshAt + BOARD_REFRESH_MIN_GAP_MS - Date.now());
      settling = setTimeout(() => {
        refreshing = refreshing.then(() => {
          settling = undefined;
          if (abort.signal.aborted) return;
          lastRefreshAt = Date.now();
          return Promise.all(boardKeys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
        });
      }, wait);
    };

    const connect = () => {
      streamFeedEvents(
        baseUrl,
        factoryProjectId,
        {
          onEvent: ({ workItemId }) => {
            refreshBoard();
            if (workItemId) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.workItemCommentsRoot(workItemId) });
            }
          },
          onConnected: () => {
            setConnected(true);
            // Whatever landed while this tab held no stream was never announced. A project's
            // first stream opens right after the page read its board, so that board is current.
            if (streamedProject.current === factoryProjectId) refreshBoard();
            streamedProject.current = factoryProjectId;
            void queryClient.invalidateQueries({ queryKey: queryKeys.workItemCommentsAll() });
          },
        },
        abort.signal,
      )
        .then(() => false)
        .catch((error: unknown) => error instanceof RequestError && error.status >= 400 && error.status < 500)
        .then(fatal => {
          if (abort.signal.aborted) return;
          setConnected(false);
          // An expired session or a deleted project never heals by retrying;
          // the fallback poll carries the feed from here.
          if (!fatal) retry = setTimeout(connect, RETRY_MS);
        });
    };
    connect();

    return () => {
      abort.abort();
      clearTimeout(retry);
      clearTimeout(settling);
      setConnected(false);
    };
  }, [baseUrl, factoryProjectId, queryClient, visible]);

  return <FeedEventsContext.Provider value={connected}>{children}</FeedEventsContext.Provider>;
}
