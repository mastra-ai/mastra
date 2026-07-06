import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { listGithubRepos } from '../services/github';

export function useGithubReposQuery(query: string | undefined, enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubRepos(query),
    queryFn: () => listGithubRepos(baseUrl, query),
    enabled,
  });
}
