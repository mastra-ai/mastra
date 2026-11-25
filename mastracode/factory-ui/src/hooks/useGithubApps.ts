import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  connectOwnGithub,
  deleteOwnGithubPat,
  fetchGithubSwitchStatus,
  fetchOwnGithub,
  saveOwnGithubPat,
  switchGithubApps,
} from '../ui/domains/workspaces/services/githubApps';

/** The org's GitHub app switch status; `null` for users who may not switch it. */
export function useGithubSwitchQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.githubSwitch(),
    queryFn: () => fetchGithubSwitchStatus(baseUrl),
    enabled,
    retry: false,
  });
}

export function useSwitchGithubAppsMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => switchGithubApps(baseUrl),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.githubSwitch() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.githubStatus() }),
      ]),
  });
}

/** The signed-in user's own GitHub connection and token, in a switched org. */
export function useOwnGithubQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({ queryKey: queryKeys.githubOwn(), queryFn: () => fetchOwnGithub(baseUrl), enabled, retry: false });
}

function useInvalidateOwnGithub() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.githubOwn() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.githubStatus() }),
    ]);
}

export function useConnectOwnGithubMutation() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateOwnGithub();
  return useMutation({ mutationFn: () => connectOwnGithub(baseUrl), onSettled: invalidate });
}

export function useSaveOwnGithubPatMutation() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateOwnGithub();
  return useMutation({ mutationFn: (token: string) => saveOwnGithubPat(baseUrl, token), onSettled: invalidate });
}

export function useDeleteOwnGithubPatMutation() {
  const { baseUrl } = useApiConfig();
  const invalidate = useInvalidateOwnGithub();
  return useMutation({ mutationFn: () => deleteOwnGithubPat(baseUrl), onSettled: invalidate });
}
