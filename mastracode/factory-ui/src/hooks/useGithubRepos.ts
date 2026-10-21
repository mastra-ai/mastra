import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { listGithubRepos } from '../ui/domains/workspaces/services/github';

export function useGithubReposQuery(query: string | undefined, enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubRepos(query),
    queryFn: () => listGithubRepos(baseUrl, query),
    enabled,
    // Typing keeps the previous matches on screen instead of flashing skeletons per keystroke.
    placeholderData: keepPreviousData,
    // Repository access is granted on GitHub in another tab; pick it up when the user comes back.
    refetchOnWindowFocus: true,
  });
}

/**
 * Re-read GitHub installations and repositories, bypassing the server's
 * repository cache, so access just granted on GitHub shows up immediately.
 */
export function useRefreshGithubReposMutation(query: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Status re-syncs the org's installations (new GitHub accounts) before repos list them.
      await queryClient.refetchQueries({ queryKey: queryKeys.githubStatus() });
      return listGithubRepos(baseUrl, query, { refresh: true });
    },
    onSuccess: repos => {
      queryClient.setQueryData(queryKeys.githubRepos(query), repos);
      void queryClient.invalidateQueries({
        queryKey: ['github', 'repos'],
        predicate: q => q.queryKey[2] !== (query ?? null),
      });
    },
  });
}
