import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { commitTimeMs, fetchRepositoryCommits } from '../ui/domains/factory/services/commits';
import type { RepositoryCommit, RepositoryCommitsPage } from '../ui/domains/factory/services/commits';

const GITHUB_MAX_COMMITS_PER_PAGE = 100;
// GitHub is the source, not our database, so a poll here costs a rate-limited call; a page visit is enough.
const NEWEST_COMMITS_STALE_MS = 60_000;
const FIRST_OLDER_PAGE = 2;

interface LoadedCommits {
  commits: RepositoryCommit[];
  oldestMs: number | undefined;
}

function loadedCommits(pages: RepositoryCommitsPage[]): LoadedCommits {
  const commits = pages.flatMap(page => page.commits);
  let oldestMs: number | undefined;
  for (const commit of commits) {
    const atMs = commitTimeMs(commit);
    if (atMs !== undefined && (oldestMs === undefined || atMs < oldestMs)) oldestMs = atMs;
  }
  return { commits, oldestMs };
}

const selectNewestCommits = (page: RepositoryCommitsPage) => loadedCommits([page]);
const selectOlderCommits = (data: InfiniteData<RepositoryCommitsPage, number>) => loadedCommits(data.pages);

function nextOlderPageNumber(
  page: RepositoryCommitsPage,
  pages: RepositoryCommitsPage[],
  pageNumber: number,
): number | undefined {
  const pageFull = page.commits.length === GITHUB_MAX_COMMITS_PER_PAGE;
  const repeatsPreviousPage = pages.at(-2)?.commits.at(-1)?.sha === page.commits.at(-1)?.sha;
  return pageFull && !repeatsPreviousPage ? pageNumber + 1 : undefined;
}

function uniqueBySha(commits: RepositoryCommit[]): RepositoryCommit[] {
  const seenShas = new Set<string>();
  return commits.filter(commit => {
    if (seenShas.has(commit.sha)) return false;
    seenShas.add(commit.sha);
    return true;
  });
}

export function useRepositoryCommits(projectRepositoryId: string | undefined, viewStartMs: number) {
  const { baseUrl } = useApiConfig();
  const newest = useQuery({
    queryKey: queryKeys.githubCommits(projectRepositoryId),
    queryFn: projectRepositoryId
      ? ({ signal }) =>
          fetchRepositoryCommits(baseUrl, projectRepositoryId, { limit: GITHUB_MAX_COMMITS_PER_PAGE, signal })
      : skipToken,
    staleTime: NEWEST_COMMITS_STALE_MS,
    select: selectNewestCommits,
  });

  const newestSha = newest.data?.commits[0]?.sha;
  const newestPageFull = newest.data?.commits.length === GITHUB_MAX_COMMITS_PER_PAGE;
  const newestReachesView = newest.data?.oldestMs !== undefined && newest.data.oldestMs <= viewStartMs;
  const needsOlder = newestPageFull && !newestReachesView;
  const older = useInfiniteQuery({
    queryKey: queryKeys.githubCommitHistory(projectRepositoryId, newestSha),
    queryFn:
      projectRepositoryId && newestSha
        ? ({ pageParam, signal }) =>
            fetchRepositoryCommits(baseUrl, projectRepositoryId, {
              limit: GITHUB_MAX_COMMITS_PER_PAGE,
              fromSha: newestSha,
              page: pageParam,
              signal,
            })
        : skipToken,
    initialPageParam: FIRST_OLDER_PAGE,
    getNextPageParam: nextOlderPageNumber,
    enabled: needsOlder,
    staleTime: Infinity,
    select: selectOlderCommits,
  });

  const { data: loadedOlderCommits, fetchNextPage, refetch } = older;
  const olderReachesView = loadedOlderCommits?.oldestMs !== undefined && loadedOlderCommits.oldestMs <= viewStartMs;
  const wantsOlderPage = needsOlder && older.hasNextPage && !olderReachesView && !older.isFetching && !older.isError;
  // A page can land without a render that shows it fetching, so key on the loaded pages too.
  useEffect(() => {
    if (wantsOlderPage) void fetchNextPage();
  }, [wantsOlderPage, loadedOlderCommits, fetchNextPage]);

  const commits = useMemo(
    () => newest.data && uniqueBySha([...newest.data.commits, ...(older.data?.commits ?? [])]),
    [newest.data, older.data],
  );

  return {
    commits,
    loadingFailed: newest.isLoadingError,
    olderFailed: needsOlder && older.isError,
    retryOlder: () => void (older.isFetchNextPageError ? fetchNextPage() : refetch()),
  };
}
