import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchGitLabProjects, fetchGitLabStatus } from '../ui/domains/factory/services/gitlab';

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
