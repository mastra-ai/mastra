import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { listGithubRepos } from '../ui/domains/workspaces/services/github';

/** Repositories a picker shows before anything is typed: the most recently pushed ones. */
export const RECENT_REPOSITORY_LIMIT = 8;
const SEARCH_REPOSITORY_LIMIT = 50;

/**
 * Listing every repository is slow for accounts with hundreds of them, so pickers ask for the few most recently
 * pushed ones until the user types, then search by name on the server.
 */
function repositoryLimit(query: string | undefined) {
  return query ? SEARCH_REPOSITORY_LIMIT : RECENT_REPOSITORY_LIMIT;
}

export function useGithubReposQuery(query: string | undefined, enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubRepos(query),
    queryFn: () => listGithubRepos(baseUrl, query, { limit: repositoryLimit(query) }),
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
      return listGithubRepos(baseUrl, query, { refresh: true, limit: repositoryLimit(query) });
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
