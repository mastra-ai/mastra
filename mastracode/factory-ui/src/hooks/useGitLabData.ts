import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchGitLabStatus,
  getGitLabIssue,
  listGitLabIssues,
  listGitLabProjects,
} from '../ui/domains/factory/services/gitlab';
import { DETAIL_STALE_MS, INTAKE_POLL_MS } from './useFactoryData';

/**
 * GitLab connection status through the shared React Query cache. The service
 * degrades to a disabled status instead of throwing, so consumers read `data`,
 * never `error` — same contract as `useLinearStatusQuery`.
 */
export function useGitLabStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.gitlabStatus(),
    queryFn: () => fetchGitLabStatus(baseUrl),
    enabled,
  });
}

/**
 * Projects the connected credential can reach. Gated on a live connection:
 * the endpoint asks the integration to call GitLab, so there is nothing to
 * fetch before one exists.
 */
export function useGitLabProjectsQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.gitlabProjects(),
    queryFn: () => listGitLabProjects(baseUrl),
    enabled,
  });
}

/**
 * The Factory project's GitLab issues, one cursor page at a time as the board
 * column is scrolled. The server applies the caller's project selection and the
 * source bindings; disabled until GitLab intake is ready for this project.
 */
export function useGitLabIssuesQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.gitlabIssues(factoryProjectId),
    queryFn: factoryProjectId
      ? ({ pageParam }) => listGitLabIssues(baseUrl, factoryProjectId, pageParam || undefined)
      : skipToken,
    initialPageParam: '',
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: factoryProjectId !== undefined,
    select: data => data.pages.flatMap(page => page.issues),
    // New intake must appear without a reload; the endpoint proxies the GitLab
    // API, so poll on the same gentle cadence as the other intake feeds.
    refetchInterval: INTAKE_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/** One GitLab issue's body and comments, for the expanded card. */
export function useGitLabIssueDetail(issueId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.gitlabIssue(issueId),
    queryFn: issueId !== undefined ? () => getGitLabIssue(baseUrl, issueId) : skipToken,
    staleTime: DETAIL_STALE_MS,
  });
}
