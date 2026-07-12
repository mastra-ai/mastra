import { useInfiniteQuery } from '@tanstack/react-query';
import { useApiConfig } from '#shared/api/config';
import { queryKeys } from '#shared/api/keys';
import { listProjectIssues, listProjectPullRequests } from '../services/factory';

/**
 * Open issues for a GitHub project, loaded one page at a time as the list is
 * scrolled; disabled until a github project is active.
 */
export function useProjectIssuesQuery(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.githubIssues(githubProjectId),
    queryFn: ({ pageParam }) => listProjectIssues(baseUrl, githubProjectId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: lastPage => lastPage.nextPage,
    enabled: Boolean(githubProjectId),
    select: data => data.pages.flatMap(page => page.issues),
  });
}

/** Open (non-draft) pull requests for a GitHub project, one page at a time. */
export function useProjectPullRequestsQuery(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.githubPulls(githubProjectId),
    queryFn: ({ pageParam }) => listProjectPullRequests(baseUrl, githubProjectId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: lastPage => lastPage.nextPage,
    enabled: Boolean(githubProjectId),
    select: data => data.pages.flatMap(page => page.pullRequests),
  });
}
