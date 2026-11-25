import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchIncidentioStatus,
  getIncidentioIssue,
  listIncidentioFollowUpSources,
} from '../ui/domains/factory/services/incidentio';
import { DETAIL_STALE_MS } from './useFactoryData';

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
export function incidentioStatusQueryOptions(baseUrl: string) {
  return queryOptions({ queryKey: queryKeys.incidentioStatus(), queryFn: () => fetchIncidentioStatus(baseUrl) });
}

export function useIncidentioStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...incidentioStatusQueryOptions(baseUrl), enabled });
}

export function useIncidentioIssueDetail(factoryProjectId: string | undefined, issueRef: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.incidentioIssue(factoryProjectId, issueRef),
    queryFn: factoryProjectId && issueRef ? () => getIncidentioIssue(baseUrl, factoryProjectId, issueRef) : skipToken,
    staleTime: DETAIL_STALE_MS,
  });
}
