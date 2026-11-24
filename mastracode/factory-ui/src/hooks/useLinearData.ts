import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchLinearStatus,
  getLinearIssue,
  listLinearProjects,
  listLinearTeams,
} from '../ui/domains/factory/services/linear';
import { RequestError } from '../ui/domains/factory/services/request';
import { DETAIL_STALE_MS } from './useFactoryData';

/**
 * Linear feature/connection status through the shared React Query cache. The
 * service degrades to a disabled status instead of throwing, so consumers read
 * `data`, never `error`. Pass `enabled: false` to gate the request.
 */
export function linearStatusQueryOptions(baseUrl: string) {
  return queryOptions({ queryKey: queryKeys.linearStatus(), queryFn: () => fetchLinearStatus(baseUrl) });
}

export function useLinearStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...linearStatusQueryOptions(baseUrl), enabled });
}

export function useLinearIssueDetail(
  factoryProjectId: string | undefined,
  identifier: string | undefined,
  issueId: string | undefined,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.linearIssue(factoryProjectId, identifier, issueId),
    queryFn:
      factoryProjectId !== undefined && identifier !== undefined
        ? () => getLinearIssue(baseUrl, factoryProjectId, identifier, issueId)
        : skipToken,
    staleTime: DETAIL_STALE_MS,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 3,
  });
}

/** The connected workspace's projects (Settings intake-source picker). */
export function useLinearProjectsQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.linearProjects(),
    queryFn: () => listLinearProjects(baseUrl),
    select: data => data.projects,
    enabled,
  });
}

export function useLinearProjectListingQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.linearProjects(),
    queryFn: () => listLinearProjects(baseUrl),
    enabled,
  });
}

/** The connected workspaces' teams (Settings intake-source picker). */
export function useLinearTeamListingQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.linearTeams(),
    queryFn: () => listLinearTeams(baseUrl),
    enabled,
  });
}
