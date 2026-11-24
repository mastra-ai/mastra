/** React Query hooks for a Factory project's Knowledge page. */

import type { KnowledgeExplorerTreeRequest } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import {
  knowledgePollInterval,
  useKnowledgeChangeFeed,
} from '@mastra/playground-ui/domains/knowledge/hooks/useKnowledgeChangeFeed';
import type { KnowledgeChangeFeed } from '@mastra/playground-ui/domains/knowledge/hooks/useKnowledgeChangeFeed';
import { keepPreviousData, skipToken, useQueries, useQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
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

const isTerminalReadError = (error: unknown) =>
  error instanceof RequestError && (error.status === 404 || error.status === 422);

/**
 * Refresh gate, so pages agents write show up while the page is open. Missing and over-budget reads
 * stop polling. `paused` suspends it while the user is interacting; `live` slows it to a safety net
 * while the change stream carries updates.
 */
export function knowledgeRefetchInterval(error: unknown, paused: boolean, live = false): number | false {
  if (isTerminalReadError(error)) return false;
  if (paused) return false;
  return knowledgePollInterval(live);
}

function isProjectKnowledgeQuery(key: QueryKey, factoryProjectId: string): boolean {
  return (
    key[0] === 'factory' && typeof key[1] === 'string' && key[1].startsWith('knowledge-') && key[2] === factoryProjectId
  );
}

/** Follows the project's Knowledge change stream and refreshes its open Knowledge queries when a write lands. */
export function useKnowledgeLiveUpdates(factoryProjectId: string | undefined): boolean {
  const { baseUrl } = useApiConfig();
  const feed = useMemo<KnowledgeChangeFeed | undefined>(
    () =>
      factoryProjectId
        ? {
            follow: (signal, handlers) => streamKnowledgeChanges(baseUrl, factoryProjectId, handlers, signal),
            // A signed-out member or a missing route never heals by retrying.
            isFinal: error => error instanceof RequestError && error.status >= 400 && error.status < 500,
            queries: { predicate: query => isProjectKnowledgeQuery(query.queryKey, factoryProjectId) },
          }
        : undefined,
    [baseUrl, factoryProjectId],
  );
  return useKnowledgeChangeFeed(feed);
}

export function useKnowledgeGraph(factoryProjectId: string | undefined, paused = false, live = false) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeGraph(factoryProjectId),
    queryFn: factoryProjectId ? ({ signal }) => fetchKnowledgeGraph(baseUrl, factoryProjectId, signal) : skipToken,
    refetchInterval: query => knowledgeRefetchInterval(query.state.error, paused, live),
    retry: (failureCount, error) => !isTerminalReadError(error) && failureCount < 2,
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
    retry: (failureCount, error) => !isTerminalReadError(error) && failureCount < 2,
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
      retry: (failureCount: number, error: unknown) => !isTerminalReadError(error) && failureCount < 2,
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
    retry: (failureCount, error) => !isTerminalReadError(error) && failureCount < 2,
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
