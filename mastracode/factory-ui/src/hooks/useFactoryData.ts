import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  getRepositoryIssue,
  getRepositoryPullRequest,
  listRepositoryIssues,
  listRepositoryPullRequests,
} from '../ui/domains/factory/services/factory';

/** Board intake candidates come from external APIs (GitHub / Linear via the
 * server) — poll on a gentler cadence than the DB-backed work-items list. */
export const INTAKE_POLL_MS = 30_000;

/** Back-off once the feed fails: each poll burns the installation's mint budget,
 * but the feed must still self-heal after the connection is repaired. */
export const INTAKE_ERROR_POLL_MS = 5 * 60_000;

function intakePollInterval(query: { state: { status: string } }): number {
  return query.state.status === 'error' ? INTAKE_ERROR_POLL_MS : INTAKE_POLL_MS;
}

/**
 * Open issues for a GitHub project, loaded one page at a time as the list is
 * scrolled; disabled until a github project is active.
 */
export function useProjectIssuesQuery(projectRepositoryId: string | undefined, label?: string) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.githubIssues(projectRepositoryId, label),
    queryFn: projectRepositoryId
      ? ({ pageParam }) => listRepositoryIssues(baseUrl, projectRepositoryId, pageParam, label)
      : skipToken,
    initialPageParam: 1,
    getNextPageParam: lastPage => lastPage.nextPage,
    select: data => data.pages.flatMap(page => page.issues),
    // New intake must show up on the board without a reload. The endpoint
    // proxies the live GitHub API (and a refetch replays every loaded page),
    // so poll gently and refresh when the user returns to the tab.
    refetchInterval: intakePollInterval,
    refetchOnWindowFocus: true,
  });
}

/** Open (non-draft) pull requests for a GitHub project, one page at a time. */
export function useProjectPullRequestsQuery(projectRepositoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.githubPulls(projectRepositoryId),
    queryFn: projectRepositoryId
      ? ({ pageParam }) => listRepositoryPullRequests(baseUrl, projectRepositoryId, pageParam)
      : skipToken,
    initialPageParam: 1,
    getNextPageParam: lastPage => lastPage.nextPage,
    select: data => data.pages.flatMap(page => page.pullRequests),
    // Same intake-freshness contract as the issues feed above.
    refetchInterval: intakePollInterval,
    refetchOnWindowFocus: true,
  });
}

/** One issue's card detail (meta + markdown description), fetched when its card opens. */
export function useGitHubIssueDetail(projectRepositoryId: string | undefined, number: number | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubIssue(projectRepositoryId, number),
    queryFn:
      projectRepositoryId !== undefined && number !== undefined
        ? () => getRepositoryIssue(baseUrl, projectRepositoryId, number)
        : skipToken,
  });
}

/** One pull request's card detail (meta + markdown description), fetched when its card opens. */
export function useGitHubPullRequestDetail(projectRepositoryId: string | undefined, number: number | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubPull(projectRepositoryId, number),
    queryFn:
      projectRepositoryId !== undefined && number !== undefined
        ? () => getRepositoryPullRequest(baseUrl, projectRepositoryId, number)
        : skipToken,
  });
}
