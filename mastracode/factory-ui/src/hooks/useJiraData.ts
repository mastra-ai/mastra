import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchJiraStatus, listJiraIssues, listJiraProjects } from '../ui/domains/factory/services/jira';
import { INTAKE_POLL_MS } from './useFactoryData';

/**
 * Jira feature status through the shared React Query cache. The service
 * degrades to a disabled status instead of throwing, so consumers read
 * `data`, never `error`. Pass `enabled: false` to gate the request.
 */
export function useJiraStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.jiraStatus(),
    queryFn: () => fetchJiraStatus(baseUrl),
    enabled,
  });
}

/**
 * Active Jira issues for the viewed Factory, loaded one cursor page at a time
 * as the list is scrolled. Requests and the cache are keyed by
 * `factoryProjectId` — the server scopes results to the sources routed to that
 * Factory, so a global cache would leak one board's issues into another.
 */
export function useJiraIssuesQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.jiraIssues(factoryProjectId),
    queryFn: factoryProjectId
      ? ({ pageParam }) => listJiraIssues(baseUrl, factoryProjectId, pageParam || undefined)
      : skipToken,
    initialPageParam: '',
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: factoryProjectId !== undefined,
    select: data => data.pages.flatMap(page => page.issues),
    // New intake must show up on the board without a reload; the endpoint
    // proxies the Jira API, so poll on the gentle intake cadence.
    refetchInterval: INTAKE_POLL_MS,
    refetchOnWindowFocus: true,
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
