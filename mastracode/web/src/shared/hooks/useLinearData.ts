import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchLinearStatus, listLinearIssues, listLinearProjects } from '../../web/ui/domains/factory/services/linear';

/**
 * Linear feature/connection status through the shared React Query cache. The
 * service degrades to a disabled status instead of throwing, so consumers read
 * `data`, never `error`. Pass `enabled: false` to gate the request.
 */
export function useLinearStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.linearStatus(),
    queryFn: () => fetchLinearStatus(baseUrl),
    enabled,
  });
}

/**
 * The connected workspace's active issues, loaded one cursor page at a time as
 * the list is scrolled. The server applies the caller's intake config (project
 * selection); disabled until Linear is connected.
 */
export function useLinearIssuesQuery(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.linearIssues(githubProjectId),
    queryFn: githubProjectId
      ? ({ pageParam }) => listLinearIssues(baseUrl, githubProjectId, pageParam || undefined)
      : skipToken,
    initialPageParam: '',
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: githubProjectId !== undefined,
    select: data => data.pages.flatMap(page => page.issues),
  });
}

/** The connected workspace's projects (Settings intake-source picker). */
export function useLinearProjectsQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.linearProjects(),
    queryFn: () => listLinearProjects(baseUrl),
    enabled,
  });
}
