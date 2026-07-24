import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { deleteGithubPat, fetchGithubPatStatus, saveGithubPat } from '../../web/ui/domains/workspaces/services/github';
import type { GithubPatKind } from '../../web/ui/domains/workspaces/services/github';

/**
 * Which GitHub Personal Access Tokens the org has configured for `gh` CLI
 * auth inside sandboxes (worker + optional reviewer). The tokens themselves
 * never reach the browser — only these configured flags.
 */
export function useGithubPatStatusQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubPat(),
    queryFn: () => fetchGithubPatStatus(baseUrl),
    enabled,
    retry: false,
  });
}

export function useSaveGithubPatMutation(kind: GithubPatKind = 'default') {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => saveGithubPat(baseUrl, token, kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.githubPat() }),
  });
}

export function useRemoveGithubPatMutation(kind: GithubPatKind = 'default') {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteGithubPat(baseUrl, kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.githubPat() }),
  });
}
