import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchJiraStatus, listJiraIssues, listJiraProjects } from '../ui/domains/factory/services/jira';
import { INTAKE_POLL_MS } from './useFactoryData';

/**
 * Jira feature status through the shared React Query cache. The service
 * degrades to a disabled status instead of throwing, so consumers read `data`,
 * never `error`. Pass `enabled: false` to gate the request.
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
 * The selected Jira projects' active issues, loaded one cursor page at a time
 * as the list is scrolled. The server applies the caller's intake config
 * (project selection); pass `enabled: false` until the Jira feed is active.
 */
export function useJiraIssuesQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.jiraIssues(),
    queryFn: ({ pageParam }) => listJiraIssues(baseUrl, pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled,
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
