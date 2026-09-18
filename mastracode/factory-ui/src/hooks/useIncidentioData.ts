import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchIncidentioStatus,
  getIncidentioIssue,
  listIncidentioFollowUpSources,
  listIncidentioIssues,
} from '../ui/domains/factory/services/incidentio';
import { DETAIL_STALE_MS, INTAKE_POLL_MS } from './useFactoryData';

export function useIncidentioSourcesQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.incidentioSources(),
    queryFn: () => listIncidentioFollowUpSources(baseUrl),
    enabled,
  });
}

/**
 * incident.io feature status through the shared React Query cache. Explicit
 * server answers (including 401 → `auth_required`) resolve as data; transient
 * failures throw, so a failed background refetch keeps the last known status
 * instead of collapsing the feed. Pass `enabled: false` to gate the request.
 */
export function useIncidentioStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.incidentioStatus(),
    queryFn: () => fetchIncidentioStatus(baseUrl),
    enabled,
  });
}

/**
 * Follow-ups for the viewed Factory, loaded one cursor page at a time as the
 * list is scrolled. Requests and the cache are keyed by `factoryProjectId` —
 * the server scopes results to the sources routed to that Factory.
 */
export function useIncidentioIssuesQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.incidentioIssues(factoryProjectId),
    queryFn: factoryProjectId
      ? ({ pageParam }) => listIncidentioIssues(baseUrl, factoryProjectId, pageParam || undefined)
      : skipToken,
    initialPageParam: '',
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: factoryProjectId !== undefined,
    select: data => data.pages.flatMap(page => page.issues),
    // New intake must show up on the board without a reload; the endpoint
    // proxies the incident.io API, so poll on the gentle intake cadence.
    refetchInterval: INTAKE_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useIncidentioIssueDetail(factoryProjectId: string | undefined, issueRef: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.incidentioIssue(factoryProjectId, issueRef),
    queryFn: factoryProjectId && issueRef ? () => getIncidentioIssue(baseUrl, factoryProjectId, issueRef) : skipToken,
    staleTime: DETAIL_STALE_MS,
  });
}
