import { toast } from '@mastra/playground-ui/components/Toaster';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { takeUserSessionOwnership } from '../services/user-sessions';

export function useTakeSessionOwnership(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, expectedOwnerId }: { sessionId: string; expectedOwnerId: string }) =>
      takeUserSessionOwnership(baseUrl, sessionId, expectedOwnerId),
    onSuccess: (_session, { sessionId }) => {
      toast('You own this session now');
      // The server wrote the takeover into the session's threads.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerSessionThreadMessages(AGENT_CONTROLLER_ID, sessionId),
      });
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to take ownership'),
    // A refusal means the owner moved under the viewer, and the model catalog follows the owner's credentials.
    onSettled: (_session, _error, { sessionId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(sessionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(factoryId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.availableModels() });
    },
  });
}
