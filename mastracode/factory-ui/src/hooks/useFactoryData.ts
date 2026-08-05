import { skipToken, useInfiniteQuery, useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  listRepositoryIssues,
  listRepositoryPullRequests,
  startRepositoryIssueTriage,
} from '../ui/domains/factory/services/factory';
import type { GithubIssue } from '../ui/domains/factory/services/factory';

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

export function useStartIssueTriageMutation(projectRepositoryId: string | undefined, factoryProjectId?: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const mutationKey = ['factory', 'triage-issue', projectRepositoryId] as const;
  const mutation = useMutation({
    mutationKey,
    mutationFn: (issue: GithubIssue) => startRepositoryIssueTriage(baseUrl, projectRepositoryId!, issue),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.githubIssues(projectRepositoryId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.githubIssues(projectRepositoryId, 'auto-triaged') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
    },
  });
  const pendingIssueNumbers = useMutationState({
    filters: { mutationKey, status: 'pending' },
    select: pending => {
      const variables = pending.state.variables;
      return isGithubIssue(variables) ? variables.number : undefined;
    },
  }).filter(number => number !== undefined);
  return { triage: mutation, pendingIssueNumbers };
}

function isGithubIssue(value: unknown): value is GithubIssue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return 'number' in value && typeof value.number === 'number';
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
