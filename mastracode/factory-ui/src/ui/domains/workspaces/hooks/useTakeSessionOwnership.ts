import { toast } from '@mastra/playground-ui/components/Toaster';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { takeUserSessionOwnership } from '../services/user-sessions';

export function useTakeSessionOwnership(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, expectedOwnerId }: { sessionId: string; expectedOwnerId: string }) =>
      takeUserSessionOwnership(baseUrl, sessionId, expectedOwnerId),
    onSuccess: (_session, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(sessionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(factoryId) });
      toast('You own this session now');
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to take ownership'),
  });
}
