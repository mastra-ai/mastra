import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { updateCachedSessionTitle } from '../../../../hooks/useWorkspaces';
import { renameSession } from '../services/user-sessions';

export function useRenameSession(factoryId: string, sessionId: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => renameSession(baseUrl, sessionId, title),
    onSuccess: title => {
      void updateCachedSessionTitle(queryClient, factoryId, sessionId, title);
      void queryClient.resetQueries({
        queryKey: queryKeys.userSession(sessionId),
        predicate: query => query.state.data === undefined,
      });
    },
  });
}
