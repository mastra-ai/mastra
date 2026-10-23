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

/** Each linked repository's next page; a repository drops out once it is exhausted. */
type RepositoryPages = Record<string, number>;

function firstPages(projectRepositoryIds: readonly string[]): RepositoryPages {
  return Object.fromEntries(projectRepositoryIds.map(id => [id, 1]));
}

function remainingPages(pages: RepositoryPages): RepositoryPages | undefined {
  return Object.keys(pages).length > 0 ? pages : undefined;
}

/**
 * Read one page from every repository still holding more. A repository whose
 * read fails is skipped so one broken link cannot blank every other
 * repository's intake; the feed only errors when every repository fails, and
 * the next poll retries them all from page one.
 */
async function loadRepositoryPages<T>(
  pages: RepositoryPages,
  load: (projectRepositoryId: string, page: number) => Promise<{ items: T[]; nextPage: number | null }>,
): Promise<{ items: T[]; next: RepositoryPages }> {
  const entries = Object.entries(pages);
  const results = await Promise.allSettled(entries.map(([id, page]) => load(id, page)));
  const failure = results.find(result => result.status === 'rejected');
  if (failure && results.every(result => result.status === 'rejected')) throw failure.reason;

  const items: T[] = [];
  const next: RepositoryPages = {};
  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;
    items.push(...result.value.items);
    if (result.value.nextPage !== null) next[entries[index]![0]] = result.value.nextPage;
  });
  return { items, next };
}

/**
 * Open issues across a Factory's linked GitHub repositories, loaded one page
 * per repository at a time as the list is scrolled; disabled without any.
 */
export function useProjectIssuesQuery(projectRepositoryIds: readonly string[], label?: string) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.githubIssues(projectRepositoryIds, label),
    queryFn:
      projectRepositoryIds.length > 0
        ? ({ pageParam }) =>
            loadRepositoryPages(pageParam, async (id, page) => {
              const result = await listRepositoryIssues(baseUrl, id, page, label);
              return { items: result.issues, nextPage: result.nextPage };
            })
        : skipToken,
    initialPageParam: firstPages(projectRepositoryIds),
    getNextPageParam: lastPage => remainingPages(lastPage.next),
    select: data => data.pages.flatMap(page => page.items),
    // New intake must show up on the board without a reload. The endpoint
    // proxies the live GitHub API (and a refetch replays every loaded page),
    // so poll gently and refresh when the user returns to the tab.
    refetchInterval: intakePollInterval,
    refetchOnWindowFocus: true,
  });
}

/** Open (non-draft) pull requests across a Factory's linked GitHub repositories. */
export function useProjectPullRequestsQuery(projectRepositoryIds: readonly string[]) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.githubPulls(projectRepositoryIds),
    queryFn:
      projectRepositoryIds.length > 0
        ? ({ pageParam }) =>
            loadRepositoryPages(pageParam, async (id, page) => {
              const result = await listRepositoryPullRequests(baseUrl, id, page);
              return { items: result.pullRequests, nextPage: result.nextPage };
            })
        : skipToken,
    initialPageParam: firstPages(projectRepositoryIds),
    getNextPageParam: lastPage => remainingPages(lastPage.next),
    select: data => data.pages.flatMap(page => page.items),
    // Same intake-freshness contract as the issues feed above.
    refetchInterval: intakePollInterval,
    refetchOnWindowFocus: true,
  });
}

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
