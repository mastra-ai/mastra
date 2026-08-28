import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useDocumentVisible } from '../../../lib/hooks/useDocumentVisible';
import { streamFeedEvents } from '../services/feedEvents';

const RETRY_MS = 3_000;

const FeedEventsContext = createContext(false);

/** No provider means no stream, so consumers fall back to polling. */
export function useFeedEventsConnected(): boolean {
  return useContext(FeedEventsContext);
}

/**
 * Holds the project's feed stream for every surface under the factory route.
 * Frames only name a work item; the comment query refetches through its own
 * authed GET.
 */
export function FeedEventsProvider({ factoryProjectId, children }: { factoryProjectId: string; children: ReactNode }) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  // A hidden tab must not hold a stream: browsers cap HTTP/1.1 at 6 connections
  // per host, so a few background tabs starve every other request to the app.
  const visible = useDocumentVisible();
  const [connected, setConnected] = useState(false);
  // Outlives the effect: a tab coming back from hidden has a gap to close too.
  const openedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    const abort = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      streamFeedEvents(
        baseUrl,
        factoryProjectId,
        {
          onEvent: ({ workItemId }) => {
            // Card counts stay on the board's own 5s poll: a fetch per event
            // would double its load to save under 5s of badge latency.
            void queryClient.invalidateQueries({ queryKey: queryKeys.workItemCommentsRoot(workItemId) });
          },
          onConnected: () => {
            setConnected(true);
            // Anything written while the stream was down was never announced.
            if (openedFor.current === factoryProjectId) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.workItemCommentsAll() });
            }
            openedFor.current = factoryProjectId;
          },
        },
        abort.signal,
      )
        .catch(() => {})
        .finally(() => {
          if (abort.signal.aborted) return;
          setConnected(false);
          retry = setTimeout(connect, RETRY_MS);
        });
    };
    connect();

    return () => {
      abort.abort();
      if (retry) clearTimeout(retry);
      setConnected(false);
    };
  }, [baseUrl, factoryProjectId, queryClient, visible]);

  return <FeedEventsContext.Provider value={connected}>{children}</FeedEventsContext.Provider>;
}
