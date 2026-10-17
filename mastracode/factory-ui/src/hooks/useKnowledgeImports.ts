import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { KnowledgeImportFilters } from '../ui/domains/factory/services/knowledge-imports';
import {
  fetchKnowledgeImportRun,
  fetchKnowledgeImporters,
  fetchKnowledgeImportRuns,
} from '../ui/domains/factory/services/knowledge-imports';

export function useKnowledgeImporters(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeImporters(factoryProjectId),
    queryFn: factoryProjectId ? ({ signal }) => fetchKnowledgeImporters(baseUrl, factoryProjectId, signal) : skipToken,
    refetchInterval: 5_000,
  });
}

export function useKnowledgeImportRuns(
  factoryProjectId: string | undefined,
  importerId: string | undefined,
  filters: KnowledgeImportFilters,
) {
  const { baseUrl } = useApiConfig();
  const initialPageParam: string | undefined = undefined;
  const queryFn =
    factoryProjectId && importerId
      ? ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
          fetchKnowledgeImportRuns(baseUrl, factoryProjectId, importerId, filters, pageParam, signal)
      : skipToken;
  return useInfiniteQuery({
    queryKey: queryKeys.knowledgeImportRuns(factoryProjectId, importerId, JSON.stringify(filters)),
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
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeImportRun(factoryProjectId, importerId, runId),
    queryFn:
      factoryProjectId && importerId && runId
        ? ({ signal }) => fetchKnowledgeImportRun(baseUrl, factoryProjectId, importerId, runId, signal)
        : skipToken,
    refetchInterval: query =>
      query.state.data?.run.status === 'queued' || query.state.data?.run.status === 'running' ? 2_000 : false,
  });
}
