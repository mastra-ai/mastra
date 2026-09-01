import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useDocumentVisible } from '../../../lib/hooks/useDocumentVisible';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { streamFeedEvents } from '../services/feedEvents';
import { RequestError } from '../services/request';

const RETRY_MS = 3_000;

const FeedEventsContext = createContext(false);

/** No provider means no stream, so consumers fall back to polling. */
export function useFeedEventsConnected(): boolean {
  return useContext(FeedEventsContext);
}

/**
 * Holds the project's feed stream for every surface under the factory route.
 * Three frame kinds: a session frame (run started/ended, workspace
 * materialized) refreshes session-scoped truths, a work-item frame refreshes
 * its comments, and a plain frame refreshes the attention and decision
 * projections. The queries refetch through their own authed GET.
 */
export function FeedEventsProvider({ factoryProjectId, children }: { factoryProjectId: string; children: ReactNode }) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  // A hidden tab must not hold a stream: browsers cap HTTP/1.1 at 6 connections
  // per host, so a few background tabs starve every other request to the app.
  const visible = useDocumentVisible();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const abort = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;

    const refreshAttention = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(factoryProjectId) });
    const refreshRunActivity = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, baseUrl) });
    // The stream is scoped to the factory project, the sessions cache to a
    // repository: without the repository id on the frame, refresh them all.
    const refreshSessions = () => void queryClient.invalidateQueries({ queryKey: queryKeys.sessionsRoot() });
    const refreshDecisions = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.factoryDecisionsRoot(factoryProjectId) });

    const connect = () => {
      streamFeedEvents(
        baseUrl,
        factoryProjectId,
        {
          onEvent: ({ workItemId, sessionId }) => {
            // A session frame moves session-scoped truths only; the attention
            // and decision projections did not change.
            if (sessionId) {
              refreshRunActivity();
              refreshSessions();
              return;
            }
            if (workItemId) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.workItemCommentsRoot(workItemId) });
            }
            refreshAttention();
            refreshDecisions();
          },
          onConnected: () => {
            setConnected(true);
            // Whatever landed while this tab held no stream was never announced.
            void queryClient.invalidateQueries({ queryKey: queryKeys.workItemCommentsAll() });
            refreshAttention();
            refreshRunActivity();
            refreshSessions();
            refreshDecisions();
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
      if (retry) clearTimeout(retry);
      setConnected(false);
    };
  }, [baseUrl, factoryProjectId, queryClient, visible]);

  return <FeedEventsContext.Provider value={connected}>{children}</FeedEventsContext.Provider>;
}
