import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { listProjectIssues, listProjectPullRequests, startProjectIssueTriage } from '../services/factory';
import type { GithubIssue, GithubIssuePage } from '../services/factory';

/**
 * Open issues for a GitHub project, loaded one page at a time as the list is
 * scrolled; disabled until a github project is active.
 */
export function useProjectIssuesQuery(
  githubProjectId: string | undefined,
  label?: string,
  options?: { refetchInterval?: number | false },
) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.githubIssues(githubProjectId, label),
    queryFn: ({ pageParam }) => listProjectIssues(baseUrl, githubProjectId!, pageParam, label),
    initialPageParam: 1,
    getNextPageParam: lastPage => lastPage.nextPage,
    enabled: Boolean(githubProjectId),
    refetchInterval: options?.refetchInterval,
    select: data => data.pages.flatMap(page => page.issues),
  });
}

function removeIssueFromPages(
  data: InfiniteData<GithubIssuePage> | undefined,
  issueNumber: number,
): InfiniteData<GithubIssuePage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(page => ({
      ...page,
      issues: page.issues.filter(issue => issue.number !== issueNumber),
    })),
  };
}

function upsertIssueInFirstPage(
  data: InfiniteData<GithubIssuePage> | undefined,
  issue: GithubIssue,
): InfiniteData<GithubIssuePage> | undefined {
  if (!data) return data;
  const pages = data.pages.map((page, index) => {
    const issues = page.issues.filter(candidate => candidate.number !== issue.number);
    return { ...page, issues: index === 0 ? [issue, ...issues] : issues };
  });
  return { ...data, pages };
}

export function useStartIssueTriageMutation(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (issue: GithubIssue) => startProjectIssueTriage(baseUrl, githubProjectId!, issue),
    onSuccess: async (_result, issue) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.githubIssues(githubProjectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.githubIssues(githubProjectId, 'queued') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.githubIssues(githubProjectId, 'auto-triaged') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.githubIssues(githubProjectId, 'needs-approval') }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workItems(githubProjectId) }),
      ]);

      const queuedIssue = {
        ...issue,
        labels: Array.from(new Set([...issue.labels, 'queued', 'auto-triaged'])),
      };
      queryClient.setQueryData<InfiniteData<GithubIssuePage>>(queryKeys.githubIssues(githubProjectId), data =>
        removeIssueFromPages(data, issue.number),
      );
      queryClient.setQueryData<InfiniteData<GithubIssuePage>>(
        queryKeys.githubIssues(githubProjectId, 'auto-triaged'),
        data => upsertIssueInFirstPage(data, queuedIssue),
      );
    },
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
