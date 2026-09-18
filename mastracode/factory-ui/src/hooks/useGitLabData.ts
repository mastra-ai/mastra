import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchGitLabProjects,
  fetchGitLabStatus,
  getGitLabIssue,
  listGitLabIssues,
} from '../ui/domains/factory/services/gitlab';
import { DETAIL_STALE_MS, INTAKE_POLL_MS } from './useFactoryData';

export function useGitLabStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.gitlabStatus(),
    queryFn: () => fetchGitLabStatus(baseUrl),
    enabled,
  });
}

export function useGitLabProjectsQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.gitlabProjects(),
    queryFn: () => fetchGitLabProjects(baseUrl),
    enabled,
  });
}

export function useGitLabIssuesQuery(factoryProjectId: string | undefined, board: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.gitlabIssues(factoryProjectId, board),
    queryFn:
      factoryProjectId && board
        ? ({ pageParam }) => listGitLabIssues(baseUrl, factoryProjectId, board, pageParam || undefined)
        : skipToken,
    initialPageParam: '',
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: factoryProjectId !== undefined && board !== undefined,
    select: data => data.pages.flatMap(page => page.issues),
    refetchInterval: INTAKE_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

export function useGitLabIssueDetail(factoryProjectId: string | undefined, issueId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.gitlabIssue(factoryProjectId, issueId),
    queryFn:
      factoryProjectId !== undefined && issueId !== undefined
        ? () => getGitLabIssue(baseUrl, factoryProjectId, issueId)
        : skipToken,
    staleTime: DETAIL_STALE_MS,
  });
}
