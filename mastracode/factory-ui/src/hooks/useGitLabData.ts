import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchGitLabProjects,
  fetchGitLabStatus,
  getGitLabMergeRequest,
  getGitLabIssue,
} from '../ui/domains/factory/services/gitlab';
import { DETAIL_STALE_MS } from './useFactoryData';

export function gitLabStatusQueryOptions(baseUrl: string) {
  return queryOptions({ queryKey: queryKeys.gitlabStatus(baseUrl), queryFn: () => fetchGitLabStatus(baseUrl) });
}

export function useGitLabStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...gitLabStatusQueryOptions(baseUrl), enabled });
}

export function useGitLabProjectsQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.gitlabProjects(baseUrl),
    queryFn: () => fetchGitLabProjects(baseUrl),
    enabled,
  });
}

export function useGitLabIssueDetail(factoryProjectId: string | undefined, issueId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.gitlabIssue(baseUrl, factoryProjectId, issueId),
    queryFn:
      factoryProjectId !== undefined && issueId !== undefined
        ? () => getGitLabIssue(baseUrl, factoryProjectId, issueId)
        : skipToken,
    staleTime: DETAIL_STALE_MS,
  });
}

export function useGitLabMergeRequestDetail(
  factoryProjectId: string | undefined,
  projectRepositoryId: string | undefined,
  number: number | undefined,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.gitlabPull(baseUrl, factoryProjectId, projectRepositoryId, number),
    queryFn:
      factoryProjectId && projectRepositoryId && number
        ? () => getGitLabMergeRequest(baseUrl, factoryProjectId, projectRepositoryId, number)
        : skipToken,
    staleTime: DETAIL_STALE_MS,
  });
}
