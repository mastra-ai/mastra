import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { listProjectIssues, listProjectPullRequests } from '../services/factory';

/** Open issues for a GitHub project; disabled until a github project is active. */
export function useProjectIssuesQuery(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubIssues(githubProjectId),
    queryFn: () => listProjectIssues(baseUrl, githubProjectId!),
    enabled: Boolean(githubProjectId),
  });
}

/** Open (non-draft) pull requests for a GitHub project. */
export function useProjectPullRequestsQuery(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubPulls(githubProjectId),
    queryFn: () => listProjectPullRequests(baseUrl, githubProjectId!),
    enabled: Boolean(githubProjectId),
  });
}
