import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { queryKeys } from '../../../api/keys';

export function useInvalidateWorkspaceChangesOnRunCompletion(
  workspacePath: string | undefined,
  threadId: string | undefined,
  busy: boolean,
) {
  const queryClient = useQueryClient();
  const previous = useRef({ workspacePath, busy });

  useEffect(() => {
    const runCompleted = previous.current.workspacePath === workspacePath && previous.current.busy && !busy;
    previous.current = { workspacePath, busy };

    if (runCompleted && workspacePath) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceChanges(workspacePath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceFileScope(workspacePath) });
      if (threadId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceFiles(workspacePath, threadId) });
      }
    }
  }, [busy, queryClient, threadId, workspacePath]);
}
