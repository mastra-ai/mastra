import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { getRepositoryIssue, getRepositoryPullRequest } from '../ui/domains/factory/services/factory';

// A description barely moves and each read spends the installation mint budget.
export const DETAIL_STALE_MS = 5 * 60_000;

export function useGitHubIssueDetail(projectRepositoryId: string | undefined, number: number | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubIssue(projectRepositoryId, number),
    queryFn:
      projectRepositoryId !== undefined && number !== undefined
        ? () => getRepositoryIssue(baseUrl, projectRepositoryId, number)
        : skipToken,
    staleTime: DETAIL_STALE_MS,
  });
}

export function useGitHubPullRequestDetail(projectRepositoryId: string | undefined, number: number | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubPull(projectRepositoryId, number),
    queryFn:
      projectRepositoryId !== undefined && number !== undefined
        ? () => getRepositoryPullRequest(baseUrl, projectRepositoryId, number)
        : skipToken,
    staleTime: DETAIL_STALE_MS,
  });
}
