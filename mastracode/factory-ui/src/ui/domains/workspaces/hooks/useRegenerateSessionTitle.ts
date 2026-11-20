import { toast } from '@mastra/playground-ui/components/Toaster';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { updateCachedSessionTitle } from '../../../../hooks/useWorkspaces';
import { regenerateSessionTitle } from '../services/user-sessions';

export function useRegenerateSessionTitle(factoryId: string, sessionId: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const mutationKey = ['regenerate-session-title', sessionId];
  const regenerating = useIsMutating({ mutationKey }) > 0;
  const { mutate } = useMutation({
    mutationKey,
    mutationFn: () => regenerateSessionTitle(baseUrl, sessionId),
    onSuccess: title => {
      void updateCachedSessionTitle(queryClient, factoryId, sessionId, title);
      void queryClient.resetQueries({
        queryKey: queryKeys.userSession(sessionId),
        predicate: query => query.state.data === undefined,
      });
      toast(`Renamed to “${title}”`);
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to regenerate title'),
  });
  return { regenerate: () => mutate(), regenerating };
}
