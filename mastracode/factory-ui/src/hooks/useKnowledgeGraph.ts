/** React Query hooks for a Factory project's Knowledge page. */

import type { KnowledgeExplorerTreeRequest } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import { keepPreviousData, skipToken, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { useDocumentVisible } from '../ui/lib/hooks/useDocumentVisible';
import {
  fetchKnowledgeActivity,
  fetchKnowledgeGraph,
  fetchKnowledgePage,
  fetchKnowledgeSearch,
  fetchKnowledgeTreeLevel,
  streamKnowledgeChanges,
} from '../ui/domains/factory/services/knowledge';
import { RequestError } from '../ui/domains/factory/services/request';

const MIN_SEARCH_LENGTH = 2;
const POLL_MS = 5_000;
/**
 * While the change stream is open it announces writes made through this server process. Writes from another
 * Factory replica are not on it, so a slow poll still catches those.
 */
const LIVE_POLL_MS = 60_000;
const RETRY_MS = 3_000;
/** Writes arrive in bursts (a page and its notes); one refetch covers the burst. */
const BURST_MS = 150;

/**
 * Refresh gate, so pages agents write show up while the page is open. Only a 404 is terminal; transient
 * errors keep polling. `paused` suspends it while the user is interacting; `live` slows it to a safety net
 * while the change stream carries updates.
 */
export function knowledgeRefetchInterval(error: unknown, paused: boolean, live = false): number | false {
  if (error instanceof RequestError && error.status === 404) return false;
  if (paused) return false;
  return live ? LIVE_POLL_MS : POLL_MS;
}

function isProjectKnowledgeQuery(key: QueryKey, factoryProjectId: string): boolean {
  return (
    key[0] === 'factory' && typeof key[1] === 'string' && key[1].startsWith('knowledge-') && key[2] === factoryProjectId
  );
}

/**
 * Follows the project's Knowledge change stream while the tab is visible and refetches the project's
 * Knowledge queries when a write lands. Returns whether the stream is open; when it is not (an older server,
 * a dropped connection) the queries keep polling.
 */
export function useKnowledgeLiveUpdates(factoryProjectId: string | undefined): boolean {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  // A hidden tab must not hold a stream: browsers cap HTTP/1.1 connections per host.
  const visible = useDocumentVisible();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!visible || !factoryProjectId) return;
    const abort = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let burst: ReturnType<typeof setTimeout> | undefined;
    const refresh = () =>
      void queryClient.invalidateQueries({
        predicate: query => isProjectKnowledgeQuery(query.queryKey, factoryProjectId),
      });

    const connect = () => {
      streamKnowledgeChanges(
        baseUrl,
        factoryProjectId,
        {
          onChange: () => {
            clearTimeout(burst);
            burst = setTimeout(refresh, BURST_MS);
          },
          onConnected: () => {
            setConnected(true);
            // Whatever landed while no stream was open was never announced.
            refresh();
          },
        },
        abort.signal,
      )
        .then(() => false)
        .catch((error: unknown) => error instanceof RequestError && error.status >= 400 && error.status < 500)
        .then(fatal => {
          if (abort.signal.aborted) return;
          setConnected(false);
          // A signed-out member or a missing route never heals by retrying; polling carries on.
          if (!fatal) retry = setTimeout(connect, RETRY_MS);
        });
    };
    connect();

    return () => {
      abort.abort();
      clearTimeout(retry);
      clearTimeout(burst);
      setConnected(false);
    };
  }, [baseUrl, factoryProjectId, queryClient, visible]);

  return connected;
}

const notFound = (error: unknown) => error instanceof RequestError && error.status === 404;

export function useKnowledgeGraph(factoryProjectId: string | undefined, paused = false, live = false) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeGraph(factoryProjectId),
    queryFn: factoryProjectId ? ({ signal }) => fetchKnowledgeGraph(baseUrl, factoryProjectId, signal) : skipToken,
    refetchInterval: query => knowledgeRefetchInterval(query.state.error, paused, live),
    retry: (failureCount, error) => !notFound(error) && failureCount < 2,
  });
}

export function useKnowledgePage(
  factoryProjectId: string | undefined,
  pageId: string | null,
  noteCursor?: string,
  live = false,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgePage(factoryProjectId, pageId, noteCursor),
    queryFn:
      factoryProjectId && pageId
        ? ({ signal }) => fetchKnowledgePage(baseUrl, factoryProjectId, pageId, noteCursor, signal)
        : skipToken,
    // Only the first notes chunk polls; later chunks are fetched once as the user loads them.
    refetchInterval: query => (noteCursor ? false : knowledgeRefetchInterval(query.state.error, false, live)),
    retry: (failureCount, error) => !notFound(error) && failureCount < 2,
  });
}

/** Tree levels for the explorer's lazily loaded sidebar, one query per request, in order. */
export function useKnowledgeTreeLevels(
  factoryProjectId: string | undefined,
  requests: KnowledgeExplorerTreeRequest[],
  live = false,
) {
  const { baseUrl } = useApiConfig();
  return useQueries({
    queries: requests.map(request => ({
      queryKey: queryKeys.knowledgeTreeLevel(factoryProjectId, request.parentId, request.cursor),
      queryFn: factoryProjectId
        ? ({ signal }: { signal: AbortSignal }) => fetchKnowledgeTreeLevel(baseUrl, factoryProjectId, request, signal)
        : skipToken,
      // A level's first chunk refreshes, so new children appear in the tree and the page's child list.
      refetchInterval: (query: { state: { error: unknown } }) =>
        request.cursor ? false : knowledgeRefetchInterval(query.state.error, false, live),
      retry: (failureCount: number, error: unknown) => !notFound(error) && failureCount < 2,
    })),
  });
}

export function useKnowledgeActivity(factoryProjectId: string | undefined, pageId: string, live = false) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeActivity(factoryProjectId, pageId),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchKnowledgeActivity(baseUrl, factoryProjectId, pageId, signal)
      : skipToken,
    refetchInterval: query => knowledgeRefetchInterval(query.state.error, false, live),
    retry: (failureCount, error) => !notFound(error) && failureCount < 2,
  });
}

export function useKnowledgeSearch(factoryProjectId: string | undefined, query: string) {
  const { baseUrl } = useApiConfig();
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.knowledgeSearch(factoryProjectId, trimmed),
    queryFn:
      factoryProjectId && trimmed.length >= MIN_SEARCH_LENGTH
        ? ({ signal }) => fetchKnowledgeSearch(baseUrl, factoryProjectId, trimmed, signal)
        : skipToken,
    placeholderData: keepPreviousData,
  });
}
