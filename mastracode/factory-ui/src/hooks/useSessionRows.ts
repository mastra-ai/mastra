import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

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
    // Refreshed by the feed provider and on return to a hidden tab.
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
  const read = useQuery(sessionRowsQueryOptions(baseUrl, factoryProjectId, request));
  const layout = { factoryProjectId, groupBy: request.groupBy };
  const [lastRead, setLastRead] = useState({ ...layout, rows: read.data });
  if (read.data && read.data !== lastRead.rows) setLastRead({ ...layout, rows: read.data });
  const sameLayout = lastRead.factoryProjectId === factoryProjectId && lastRead.groupBy === request.groupBy;
  return { read, shown: read.data ?? (sameLayout ? lastRead.rows : undefined) };
}

export function useSessionActivityQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery(sessionActivityQueryOptions(baseUrl, factoryProjectId));
}
