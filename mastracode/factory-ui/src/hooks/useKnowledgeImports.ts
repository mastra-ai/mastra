import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { KnowledgeImportFilters } from '../ui/domains/factory/services/knowledge-imports';
import {
  fetchKnowledgeImportRun,
  fetchKnowledgeImporters,
  fetchKnowledgeImportRuns,
} from '../ui/domains/factory/services/knowledge-imports';

export function useKnowledgeImporters(factoryProjectId: string | undefined, threadId?: string) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeImporters(factoryProjectId, threadId),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchKnowledgeImporters(baseUrl, factoryProjectId, threadId, signal)
      : skipToken,
    refetchInterval: 5_000,
  });
}

export function useKnowledgeImportRuns(
  factoryProjectId: string | undefined,
  importerId: string | undefined,
  filters: KnowledgeImportFilters,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  const initialPageParam: string | undefined = undefined;
  const queryFn =
    factoryProjectId && importerId
      ? ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
          fetchKnowledgeImportRuns(baseUrl, factoryProjectId, importerId, filters, pageParam, threadId, signal)
      : skipToken;
  return useInfiniteQuery({
    queryKey: queryKeys.knowledgeImportRuns(factoryProjectId, importerId, threadId, JSON.stringify(filters)),
    queryFn,
    initialPageParam,
    getNextPageParam: lastPage => lastPage.nextCursor,
    refetchInterval: 5_000,
  });
}

export function useKnowledgeImportRun(
  factoryProjectId: string | undefined,
  importerId: string | undefined,
  runId: string | undefined,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.knowledgeImportRun(factoryProjectId, importerId, runId, threadId),
    queryFn: ({ pageParam, signal }) => {
      if (!factoryProjectId || !importerId || !runId) throw new Error('A Knowledge import run is required.');
      return fetchKnowledgeImportRun(
        baseUrl,
        factoryProjectId,
        importerId,
        runId,
        pageParam || undefined,
        threadId,
        signal,
      );
    },
    initialPageParam: '',
    getNextPageParam: page => page.nextCursor,
    enabled: Boolean(factoryProjectId && importerId && runId),
    refetchInterval: query => {
      const run = query.state.data?.pages[0]?.run;
      return run?.status === 'queued' || run?.status === 'running' ? 2_000 : false;
    },
  });
}
