import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
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
  onRunsFinished?: () => void;
}

function recordsMatch(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const aEntries = Object.entries(a);
  if (aEntries.length !== Object.keys(b).length) return false;
  return aEntries.every(([path, running]) => b[path] === running);
}

function clearWorkspaceAttention(queryClient: QueryClient, scope: WorkspaceAttentionScope, path: string) {
  queryClient.setQueryData<WorkspaceAttentionState>(
    queryKeys.workspaceAttention(scope.projectRepositoryId, scope.sessionKind),
    current => {
      if (!current?.attentionByPath[path]) return current;
      const attentionByPath = { ...current.attentionByPath };
      delete attentionByPath[path];
      return { ...current, attentionByPath };
    },
  );
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
  const clearAttention = (path: string) =>
    clearWorkspaceAttention(queryClient, { projectRepositoryId, sessionKind }, path);
  return { queryClient, data, clearAttention };
}

export function useWorkspaceAttentionState(scope: WorkspaceAttentionScope) {
  const { data, clearAttention } = useWorkspaceAttentionCache(scope);
  return { attentionByPath: data.attentionByPath, clearAttention };
}

export function useWorkspaceAttention({
  projectRepositoryId,
  sessionKind,
  runningByPath,
  ready,
  onRunsFinished,
}: WorkspaceAttentionOptions): {
  attentionByPath: Record<string, true>;
  clearAttention: (path: string) => void;
} {
  const { queryClient, data, clearAttention } = useWorkspaceAttentionCache({
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
      if (!(path in runningByPath)) delete attentionByPath[path];
    }
    for (const [path, running] of Object.entries(runningByPath)) {
      if (running) delete attentionByPath[path];
      else if (current.runningByPath[path] === true) {
        attentionByPath[path] = true;
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
  }, [projectRepositoryId, queryClient, ready, runningByPath, sessionKind]);

  return { attentionByPath: data.attentionByPath, clearAttention };
}
