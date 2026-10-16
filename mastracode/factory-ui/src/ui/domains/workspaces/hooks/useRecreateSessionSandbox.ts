import { toast } from '@mastra/playground-ui/components/Toaster';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { recreateSessionSandbox } from '../services/user-sessions';

interface RecreateSessionSandboxTarget {
  sessionId: string;
  factoryId: string | undefined;
  workspacePath: string;
  threadId: string;
}

export function useRecreateSessionSandbox(
  { sessionId, factoryId, workspacePath, threadId }: RecreateSessionSandboxTarget,
  { onSuccess }: { onSuccess?: () => void } = {},
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['recreate-session-sandbox', sessionId],
    mutationFn: () => recreateSessionSandbox(baseUrl, sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceChanges(workspacePath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceFiles(workspacePath, threadId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(sessionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(factoryId) });
      toast('Sandbox recreated. Send a message to continue.');
      onSuccess?.();
    },
  });
}
