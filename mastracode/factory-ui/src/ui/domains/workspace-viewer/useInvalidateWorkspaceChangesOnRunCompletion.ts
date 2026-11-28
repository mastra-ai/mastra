import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { factoryWebKeys } from '@mastra/react/hooks/factory';

export function useInvalidateWorkspaceChangesOnRunCompletion(workspacePath: string | undefined, busy: boolean) {
  const queryClient = useQueryClient();
  const previous = useRef({ workspacePath, busy });

  useEffect(() => {
    const runCompleted = previous.current.workspacePath === workspacePath && previous.current.busy && !busy;
    previous.current = { workspacePath, busy };

    if (runCompleted && workspacePath) {
      void queryClient.invalidateQueries({ queryKey: factoryWebKeys.workspaceChanges(workspacePath) });
      void queryClient.invalidateQueries({ queryKey: factoryWebKeys.workspaceFileScope(workspacePath) });
      void queryClient.invalidateQueries({ queryKey: factoryWebKeys.workspaceTreeScope(workspacePath) });
    }
  }, [busy, queryClient, workspacePath]);
}
