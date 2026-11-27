import { toast } from '@mastra/playground-ui/components/Toaster';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { connectLinear, migrateLinearWorkspaces } from '../ui/domains/factory/services/linear';
import { linearStatusQueryOptions, useLinearStatusQuery } from './useLinearData';
import { useConnectPlatformProviderMutation } from './usePlatformConnections';

/**
 * `redirecting`: the page is leaving for Linear. `done`: the popup finished and the
 * connection is active. `activating`: it finished but the connection isn't active yet.
 * `failed`: it didn't finish.
 */
export type LinearConnectOutcome = 'redirecting' | 'done' | 'activating' | 'failed';

/**
 * Connect a Linear workspace the way this server supports. A Platform server
 * connects through Mastra Connect in a popup and refreshes Linear's status
 * before resolving. A self-managed server leaves for its own OAuth flow.
 *
 * A Platform reconnect is a fresh connect too: workspaces moved onto Mastra
 * Connect were imported, and imported connections can't be reauthorized in
 * place.
 */
export function useLinearConnect() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const platformConnect = useConnectPlatformProviderMutation('linear');
  const platform = useLinearStatusQuery().data?.mode === 'platform';

  const connect = async (
    options: { workspaceId?: string; beforeRedirect?: () => void } = {},
  ): Promise<LinearConnectOutcome> => {
    let status = await queryClient.query({ ...linearStatusQueryOptions(baseUrl), staleTime: 'static' });
    // Without a status the server's mode is unknown; leaving for self-managed OAuth would be a guess.
    if (status.mode !== 'platform' && (status.reason === 'unavailable' || status.reason === 'auth_required')) {
      status = await queryClient.fetchQuery({ ...linearStatusQueryOptions(baseUrl), staleTime: 0 });
    }
    if (status.mode !== 'platform' && status.reason === 'auth_required') {
      toast.error('Sign in again to connect Linear.');
      return 'failed';
    }
    if (status.mode !== 'platform' && status.reason === 'unavailable') {
      toast.error("Couldn't reach Factory to connect Linear. Try again.");
      return 'failed';
    }
    if (status.mode !== 'platform') {
      options.beforeRedirect?.();
      connectLinear(baseUrl, options.workspaceId);
      return 'redirecting';
    }
    try {
      const connection = await platformConnect.mutateAsync({});
      if (!connection) {
        toast.success('Linear authorization completed. The connection is activating.');
        return 'activating';
      }
      toast.success('Linear connected');
      return 'done';
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect Linear');
      return 'failed';
    }
  };

  return { connect, pending: platformConnect.isPending, platform };
}

/**
 * An organization admin's manual retry of the move from the platform's legacy
 * Linear connection to Mastra Connect. The server runs the move on its own.
 */
export function useMigrateLinearMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => migrateLinearWorkspaces(baseUrl),
    onSuccess: ({ migration }) => {
      if (migration.required) {
        toast.error(migration.lastError?.message ?? "Some Linear workspaces haven't moved to Mastra Connect yet.");
      } else {
        toast.success('Linear workspaces moved to Mastra Connect');
      }
    },
    onError: error => toast.error(error.message),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.linearStatus() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.linearProjects() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.linearTeams() }),
        queryClient.invalidateQueries({ queryKey: ['linear', 'issue'] }),
      ]),
  });
}
