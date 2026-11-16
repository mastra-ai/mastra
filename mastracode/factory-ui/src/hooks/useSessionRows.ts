import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { SessionRowsRequest } from '../api/types';
import { fetchSessionActivity, fetchSessionRows } from '../ui/domains/workspaces/services/sessionRowReads';
import { UNMATERIALIZED_POLL_MS } from './useWorkspaces';

export function sessionRowsQueryOptions(
  baseUrl: string,
  factoryProjectId: string | undefined,
  request: SessionRowsRequest,
) {
  return queryOptions({
    queryKey: queryKeys.sessionRows(factoryProjectId, request),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchSessionRows(baseUrl, factoryProjectId, request, signal)
      : skipToken,
    // The feed provider refreshes this. A hidden tab holds no stream and polls nothing, so refresh immediately on return.
    refetchOnWindowFocus: true,
    refetchInterval: query => (query.state.data?.settling ? UNMATERIALIZED_POLL_MS : false),
  });
}

export function sessionActivityQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.sessionActivity(factoryProjectId),
    queryFn: factoryProjectId ? ({ signal }) => fetchSessionActivity(baseUrl, factoryProjectId, signal) : skipToken,
    refetchOnWindowFocus: true,
    refetchInterval: query => (query.state.data?.settling ? UNMATERIALIZED_POLL_MS : false),
  });
}

export function useSessionRowsQuery(factoryProjectId: string | undefined, request: SessionRowsRequest) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    ...sessionRowsQueryOptions(baseUrl, factoryProjectId, request),
    // Another Factory's rows, or rows grouped another way, can't stand in while these load.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === (factoryProjectId ?? null) && previousQuery.queryKey[3].groupBy === request.groupBy
        ? previous
        : undefined,
  });
}

export function useSessionActivityQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery(sessionActivityQueryOptions(baseUrl, factoryProjectId));
}
