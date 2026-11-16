import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchJiraStatus, getJiraIssue, listJiraProjects } from '../ui/domains/factory/services/jira';
import { DETAIL_STALE_MS } from './useFactoryData';

/**
 * Jira feature status through the shared React Query cache. The service
 * degrades to a disabled status instead of throwing, so consumers read
 * `data`, never `error`. Pass `enabled: false` to gate the request.
 */
export function jiraStatusQueryOptions(baseUrl: string) {
  return queryOptions({ queryKey: queryKeys.jiraStatus(), queryFn: () => fetchJiraStatus(baseUrl) });
}

export function useJiraStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...jiraStatusQueryOptions(baseUrl), enabled });
}

export function useJiraIssueDetail(
  factoryProjectId: string | undefined,
  identifier: string | undefined,
  issueRef: string | undefined,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.jiraIssue(factoryProjectId, identifier, issueRef),
    queryFn:
      factoryProjectId && identifier && issueRef
        ? () => getJiraIssue(baseUrl, factoryProjectId, identifier, issueRef)
        : skipToken,
    staleTime: DETAIL_STALE_MS,
  });
}

/** The Jira site's projects (Settings intake-source picker). */
export function useJiraProjectsQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.jiraProjects(),
    queryFn: () => listJiraProjects(baseUrl),
    enabled,
  });
}
