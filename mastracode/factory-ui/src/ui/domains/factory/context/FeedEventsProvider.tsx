import type { FeedFrame } from '@mastra/factory/feed-frame';
import { hashKey, useQueryClient } from '@tanstack/react-query';
import type { Query, QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../api/config';
import { cardMoveMutationKey, queryKeys } from '../../../../api/keys';
import { useRecentlyVisible } from '../../../lib/hooks/useDocumentVisible';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { streamFeedEvents } from '../services/feedEvents';
import { RequestError } from '../services/request';
import type { BoardSnapshot } from '../services/workItems';
import { fitsNarrowRead, readNamedSessionCards, withNamedSessionCards } from './sessionCards';
import type { NamedChanges } from './sessionCards';

const RETRY_MS = 3_000;
/** Frames this close together refresh the board once. */
const BOARD_REFRESH_SETTLE_MS = 300;
/** Cards move on their own (rules, runs, ingestion, other tabs): without the stream only this poll shows it, and frames refresh a busy board no faster. */
const BOARD_FALLBACK_POLL_MS = 5_000;
/** While frames refresh the board, a poll only bounds how long a write that never announced itself stays hidden. */
const FEED_SAFETY_POLL_MS = 60_000;

interface PendingRead {
  whole: boolean;
  named: NamedChanges;
}

const nothingNamed = (): NamedChanges => ({ cards: new Set(), sessions: new Set() });
const wholeRead = (): PendingRead => ({ whole: true, named: nothingNamed() });

/**
 * Holds the project's feed stream for every surface under the factory route.
 * A frame says what changed; the queries it invalidates refetch through their
 * own authed GET, and the session list reads only the cards and sessions a
 * frame names.
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
    const factsKey = queryKeys.boardFacts(factoryProjectId);
    const sessionListHash = hashKey(queryKeys.workItemsWithSessions(factoryProjectId));
    let sessionList = wholeRead();
    const boardKeys = [
      cardsKey,
      factsKey,
      queryKeys.factoryDecisionsRoot(factoryProjectId),
      queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, baseUrl),
    ];
    // One read per query at a time, with at most one more queued behind it: a frame cancelling a slow
    // read for the next would starve a busy board, and a read that never ends holds up only its own query.
    const reading = new Map<string, PendingRead | undefined>();
    const moveInFlight = () => queryClient.isMutating({ mutationKey: cardMoveMutationKey(factoryProjectId) }) > 0;
    const invalidate = (query: Query) => queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true });
    const patchSessionList = async (query: Query, named: NamedChanges) => {
      if (!fitsNarrowRead(named) || query.state.data === undefined) return invalidate(query);
      let read: BoardSnapshot;
      try {
        read = await readNamedSessionCards(baseUrl, factoryProjectId, named, abort.signal);
      } catch {
        return abort.signal.aborted ? undefined : invalidate(query);
      }
      if (moveInFlight()) return;
      queryClient.setQueryData<BoardSnapshot>(query.queryKey, list => list && withNamedSessionCards(list, read, named));
    };
    const reread = (boardKey: QueryKey, query: Query, pending: PendingRead) => {
      // A card read taken mid-move puts the card back in the column it is leaving; the move re-reads the cards when it lands.
      if (boardKey === cardsKey && moveInFlight()) return;
      // A server that predates these reads answers 404 for good: asking again on every frame cannot change it.
      if (boardKey === factsKey && query.state.error instanceof RequestError && query.state.error.status === 404) {
        return;
      }
      if (reading.has(query.queryHash)) {
        const queued = reading.get(query.queryHash) ?? { whole: false, named: nothingNamed() };
        queued.whole ||= pending.whole;
        for (const card of pending.named.cards) queued.named.cards.add(card);
        for (const session of pending.named.sessions) queued.named.sessions.add(session);
        reading.set(query.queryHash, queued);
        return;
      }
      reading.set(query.queryHash, undefined);
      const read =
        query.queryHash === sessionListHash && !pending.whole
          ? patchSessionList(query, pending.named)
          : invalidate(query);
      void read.finally(() => {
        const queued = reading.get(query.queryHash);
        reading.delete(query.queryHash);
        if (queued && !abort.signal.aborted) reread(boardKey, query, queued);
      });
    };
    const refreshBoard = () => {
      if (settling) return;
      const wait = Math.max(BOARD_REFRESH_SETTLE_MS, lastRefreshAt + BOARD_FALLBACK_POLL_MS - Date.now());
      settling = setTimeout(() => {
        settling = undefined;
        lastRefreshAt = Date.now();
        const sessionListRead = sessionList;
        sessionList = { whole: false, named: nothingNamed() };
        const sessionListChanged =
          sessionListRead.whole || sessionListRead.named.cards.size > 0 || sessionListRead.named.sessions.size > 0;
        for (const boardKey of boardKeys) {
          // Each query under a key waits only for itself: a session's few cards never queue behind the whole board.
          for (const query of queryClient.getQueryCache().findAll({ queryKey: boardKey })) {
            if (query.queryHash !== sessionListHash) reread(boardKey, query, wholeRead());
            else if (sessionListChanged) reread(boardKey, query, sessionListRead);
          }
        }
      }, wait);
    };
    // The only poll for cards and decisions: it takes a frame's path, so it never reads cards mid-move either.
    // While the stream holds, every card write names its cards, so the safety poll leaves the session list alone.
    const poll = setInterval(() => {
      if (!streaming) sessionList.whole = true;
      if (!streaming || Date.now() - lastRefreshAt >= FEED_SAFETY_POLL_MS) refreshBoard();
    }, BOARD_FALLBACK_POLL_MS);
    const heard = (frame: FeedFrame) => {
      if (!frame.cards) sessionList.whole = true;
      for (const card of frame.cards ?? []) sessionList.named.cards.add(card);
      for (const session of frame.sessions ?? []) sessionList.named.sessions.add(session);
      refreshBoard();
    };

    const connect = () => {
      streamFeedEvents(
        baseUrl,
        factoryProjectId,
        {
          onEvent: heard,
          onConnected: () => {
            streaming = true;
            // Whatever landed while this tab held no stream was never announced.
            sessionList.whole = true;
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
