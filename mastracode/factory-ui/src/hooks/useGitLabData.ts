import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchGitLabProjects, fetchGitLabStatus, listGitLabIssues } from '../ui/domains/factory/services/gitlab';
import { INTAKE_POLL_MS } from './useFactoryData';

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
