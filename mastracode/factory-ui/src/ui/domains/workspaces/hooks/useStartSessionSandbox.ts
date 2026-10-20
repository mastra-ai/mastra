import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { startSessionSandbox } from '../services/user-sessions';

/** Start a session's sandbox, then reload its files, changes and processes from it. */
export function useStartSessionSandbox(workspacePath: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['start-session-sandbox', workspacePath],
    mutationFn: () => startSessionSandbox(baseUrl, workspacePath),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceTreeScope(workspacePath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceChanges(workspacePath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceProcessesScope(workspacePath) });
    },
  });
}
