/**
 * React Query hooks for the Documents page.
 *
 * The inventory polls slowly (the index only changes when a run materializes
 * the repo) and speeds up briefly after a refresh so the page catches the
 * new sync state. A document body is cached per kind and never retried on a
 * 404 — that means the kind is unknown or the project has not synced yet,
 * and the inventory already says so.
 */

import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchFactoryDocument,
  fetchFactoryDocuments,
  refreshFactoryDocuments,
} from '../ui/domains/factory/services/documents';
import { RequestError } from '../ui/domains/factory/services/request';

export const DOCUMENTS_POLL_MS = 30_000;
export const DOCUMENTS_REFRESHING_POLL_MS = 2_000;

export function useFactoryDocuments(factoryProjectId: string | undefined, options?: { refreshing?: boolean }) {
  const { baseUrl } = useApiConfig();
  const refreshing = options?.refreshing ?? false;
  return useQuery({
    queryKey: queryKeys.factoryDocuments(factoryProjectId),
    queryFn: factoryProjectId ? ({ signal }) => fetchFactoryDocuments(baseUrl, factoryProjectId, signal) : skipToken,
    refetchInterval: refreshing ? DOCUMENTS_REFRESHING_POLL_MS : DOCUMENTS_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useFactoryDocument(factoryProjectId: string | undefined, kind: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryDocument(factoryProjectId, kind),
    queryFn:
      factoryProjectId && kind
        ? ({ signal }) => fetchFactoryDocument(baseUrl, factoryProjectId, kind, signal)
        : skipToken,
    staleTime: 60_000,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 2,
  });
}

/** Re-sync the inventory from a live sandbox, then refetch every documents query. */
export function useRefreshFactoryDocuments(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!factoryProjectId) throw new Error('Factory project is required');
      return refreshFactoryDocuments(baseUrl, factoryProjectId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factoryDocumentsRoot(factoryProjectId) });
    },
  });
}
