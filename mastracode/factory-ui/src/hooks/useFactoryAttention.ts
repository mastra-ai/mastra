import { skipToken, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { useFeedEventsConnected } from '../ui/domains/factory/context/FeedEventsProvider';
import {
  fetchFactoryAttention,
  markAllFactoryAttentionRead,
  updateFactoryAttentionReceipt,
} from '../ui/domains/factory/services/attention';
import type {
  FactoryAttentionItem,
  FactoryAttentionReceiptAction,
  FactoryAttentionTier,
  FactoryAttentionView,
} from '../ui/domains/factory/services/attention';

/** The badge's standing safety net, and the page's fallback while its stream is down. */
export const ATTENTION_POLL_MS = 5_000;

export function useFactoryAttention(
  factoryProjectId: string | undefined,
  view: FactoryAttentionView,
  limit: number,
  tier?: FactoryAttentionTier,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryAttention(factoryProjectId, view, limit, tier),
    queryFn: factoryProjectId
      ? ({ signal }) =>
          fetchFactoryAttention(baseUrl, factoryProjectId, { view, limit, signal, ...(tier ? { tier } : {}) })
      : skipToken,
    refetchInterval: ATTENTION_POLL_MS,
    staleTime: 2_000,
  });
}

export function useFactoryAttentionHistory(
  factoryProjectId: string | undefined,
  view: FactoryAttentionView,
  search: string,
) {
  const { baseUrl } = useApiConfig();
  const connected = useFeedEventsConnected();
  const initialPageParam: string | undefined = undefined;
  const queryFn = factoryProjectId
    ? ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
        fetchFactoryAttention(baseUrl, factoryProjectId, { view, before: pageParam, limit: 25, search, signal })
    : skipToken;
  return useInfiniteQuery({
    queryKey: [...queryKeys.factoryAttention(factoryProjectId, view, 25), 'history', search],
    queryFn,
    initialPageParam,
    getNextPageParam: lastPage => lastPage.nextCursor,
    // The stream announces every attention change; the poll only bridges
    // the window where no stream is up.
    refetchInterval: connected ? false : ATTENTION_POLL_MS,
    staleTime: 2_000,
  });
}

export function useFactoryAttentionReceiptAction(
  factoryProjectId: string | undefined,
  action: FactoryAttentionReceiptAction,
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: FactoryAttentionItem) => {
      if (!factoryProjectId) throw new Error('Factory project is required');
      return updateFactoryAttentionReceipt(baseUrl, factoryProjectId, item, action);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(factoryProjectId) });
    },
  });
}

export function useMarkAllFactoryAttentionRead(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!factoryProjectId) throw new Error('Factory project is required');
      return markAllFactoryAttentionRead(baseUrl, factoryProjectId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(factoryProjectId) });
    },
  });
}
