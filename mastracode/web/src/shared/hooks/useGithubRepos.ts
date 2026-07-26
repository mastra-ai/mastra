import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { listGithubRepos } from '../../web/ui/domains/workspaces/services/github';

export function useGithubReposQuery(query: string | undefined, enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubRepos(query),
    queryFn: () => listGithubRepos(baseUrl, query),
    enabled,
  });
}
