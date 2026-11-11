import { useQueryClient } from '@tanstack/react-query';
import type { Query, QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../api/config';
import { cardMoveMutationKey, queryKeys } from '../../../../api/keys';
import { useRecentlyVisible } from '../../../lib/hooks/useDocumentVisible';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { streamFeedEvents } from '../services/feedEvents';
import { RequestError } from '../services/request';

const RETRY_MS = 3_000;
/** Frames this close together refresh the board once. */
const BOARD_REFRESH_SETTLE_MS = 300;
/** Cards move on their own (rules, runs, ingestion, other tabs): without the stream only this poll shows it, and frames refresh a busy board no faster. */
const BOARD_FALLBACK_POLL_MS = 5_000;
/** While frames refresh the board, a poll only bounds how long a write that never announced itself stays hidden. */
const FEED_SAFETY_POLL_MS = 60_000;

/**
 * Holds the project's feed stream for every surface under the factory route.
 * A frame only says the board changed; the queries it invalidates refetch
 * through their own authed GET.
 */
export function FeedEventsProvider({ factoryProjectId, children }: { factoryProjectId: string; children: ReactNode }) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  // A hidden tab must not hold a stream: browsers cap HTTP/1.1 at 6 connections
  // per host, so a few background tabs starve every other request to the app.
  // A quick tab switch keeps the stream; only a tab left hidden releases it.
  const visible = useRecentlyVisible();

  useEffect(() => {
    if (!visible) return;

    const abort = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let settling: ReturnType<typeof setTimeout> | undefined;
    let lastRefreshAt = Number.NEGATIVE_INFINITY;
    let streaming = false;
    const cardsKey = queryKeys.workItems(factoryProjectId);
    const boardKeys = [
      cardsKey,
      queryKeys.boardFacts(factoryProjectId),
      queryKeys.factoryDecisionsRoot(factoryProjectId),
      queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, baseUrl),
    ];
    // One read per query at a time, with at most one more queued behind it: a frame cancelling a slow
    // read for the next would starve a busy board, and a read that never ends holds up only its own query.
    const reading = new Map<string, { again: boolean }>();
    const reread = (boardKey: QueryKey, query: Query) => {
      // A card read taken mid-move puts the card back in the column it is leaving; the move re-reads the cards when it lands.
      if (boardKey === cardsKey && queryClient.isMutating({ mutationKey: cardMoveMutationKey(factoryProjectId) }) > 0) {
        return;
      }
      const inFlight = reading.get(query.queryHash);
      if (inFlight) {
        inFlight.again = true;
        return;
      }
      const read = { again: false };
      reading.set(query.queryHash, read);
      void queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true }).finally(() => {
        reading.delete(query.queryHash);
        if (read.again && !abort.signal.aborted) reread(boardKey, query);
      });
    };
    const refreshBoard = () => {
      if (settling) return;
      const wait = Math.max(BOARD_REFRESH_SETTLE_MS, lastRefreshAt + BOARD_FALLBACK_POLL_MS - Date.now());
      settling = setTimeout(() => {
        settling = undefined;
        lastRefreshAt = Date.now();
        for (const boardKey of boardKeys) {
          // Each query under a key waits only for itself: a session's few cards never queue behind the whole board.
          for (const query of queryClient.getQueryCache().findAll({ queryKey: boardKey })) reread(boardKey, query);
        }
      }, wait);
    };
    // The only poll for cards and decisions: it takes a frame's path, so it never reads cards mid-move either.
    const poll = setInterval(() => {
      if (!streaming || Date.now() - lastRefreshAt >= FEED_SAFETY_POLL_MS) refreshBoard();
    }, BOARD_FALLBACK_POLL_MS);

    const connect = () => {
      streamFeedEvents(
        baseUrl,
        factoryProjectId,
        {
          onEvent: refreshBoard,
          onConnected: () => {
            streaming = true;
            // Whatever landed while this tab held no stream was never announced.
            refreshBoard();
          },
        },
        abort.signal,
      )
        .then(() => false)
        .catch((error: unknown) => error instanceof RequestError && error.status >= 400 && error.status < 500)
        .then(fatal => {
          if (abort.signal.aborted) return;
          streaming = false;
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
      clearInterval(poll);
    };
  }, [baseUrl, factoryProjectId, queryClient, visible]);

  return children;
}
