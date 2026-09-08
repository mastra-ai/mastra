import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchGitLabStatus, listGitLabProjects } from '../ui/domains/factory/services/gitlab';

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
