import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import { queryKeys } from '../api/keys';
import { playDoneSound } from '../ui/domains/settings/services/doneSound';

interface WorkspaceAttentionState {
  runningByPath: Record<string, boolean>;
  attentionByPath: Record<string, true>;
}

interface WorkspaceAttentionScope {
  projectRepositoryId: string | undefined;
  sessionKind: 'factory' | 'user';
}

interface WorkspaceAttentionOptions extends WorkspaceAttentionScope {
  runningByPath: Record<string, boolean>;
  ready: boolean;
  /**
   * Session the viewer has open: it never advertises attention — the reader is
   * already there. Its done sound still plays, calling back a backgrounded tab.
   */
  openPath: string | undefined;
  onRunsFinished?: () => void;
}

function recordsMatch(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const aEntries = Object.entries(a);
  if (aEntries.length !== Object.keys(b).length) return false;
  return aEntries.every(([path, running]) => b[path] === running);
}

function useWorkspaceAttentionCache({ projectRepositoryId, sessionKind }: WorkspaceAttentionScope) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.workspaceAttention(projectRepositoryId, sessionKind);
  const { data } = useQuery<WorkspaceAttentionState>({
    queryKey,
    queryFn: () => ({ runningByPath: {}, attentionByPath: {} }),
    enabled: false,
    initialData: () => ({ runningByPath: {}, attentionByPath: {} }),
  });
  return { queryClient, data };
}

export function useWorkspaceAttentionState(scope: WorkspaceAttentionScope) {
  const { data } = useWorkspaceAttentionCache(scope);
  return { attentionByPath: data.attentionByPath };
}

export function useWorkspaceAttention({
  projectRepositoryId,
  sessionKind,
  runningByPath,
  ready,
  openPath,
  onRunsFinished,
}: WorkspaceAttentionOptions): {
  attentionByPath: Record<string, true>;
} {
  const { queryClient, data } = useWorkspaceAttentionCache({
    projectRepositoryId,
    sessionKind,
  });
  const runsFinished = useEffectEvent(() => onRunsFinished?.());

  useEffect(() => {
    if (!ready) return;
    const queryKey = queryKeys.workspaceAttention(projectRepositoryId, sessionKind);
    const current = queryClient.getQueryData<WorkspaceAttentionState>(queryKey) ?? {
      runningByPath: {},
      attentionByPath: {},
    };
    const attentionByPath = { ...current.attentionByPath };
    const finished: string[] = [];

    for (const path of Object.keys(attentionByPath)) {
      if (!(path in runningByPath) || path === openPath) delete attentionByPath[path];
    }
    for (const [path, running] of Object.entries(runningByPath)) {
      if (running) delete attentionByPath[path];
      else if (current.runningByPath[path] === true) {
        if (path !== openPath) attentionByPath[path] = true;
        finished.push(path);
      }
    }

    const attentionChanged =
      Object.keys(attentionByPath).length !== Object.keys(current.attentionByPath).length ||
      Object.keys(attentionByPath).some(path => current.attentionByPath[path] !== true);
    if (!attentionChanged && recordsMatch(current.runningByPath, runningByPath)) return;

    queryClient.setQueryData<WorkspaceAttentionState>(queryKey, { runningByPath, attentionByPath });
    if (finished.length > 0) {
      playDoneSound();
      runsFinished();
    }
  }, [openPath, projectRepositoryId, queryClient, ready, runningByPath, sessionKind]);

  return { attentionByPath: data.attentionByPath };
}
