import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { listGithubRepos } from '../services/github';

export function useGithubReposQuery(query: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.githubRepos(query),
    queryFn: () => listGithubRepos(query),
    enabled,
  });
}
