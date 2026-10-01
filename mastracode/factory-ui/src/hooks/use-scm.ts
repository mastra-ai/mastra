import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { ScmActionResult, ScmDiff, ScmStatus } from '../api/types';

/**
 * Git staging state for the SCM panel. Polls gently while mounted so agent
 * commits and external `git add`s show up without a manual refresh.
 */
export function useScmStatus(workspacePath: string | undefined, { enabled = true }: { enabled?: boolean } = {}) {
  const { client } = useApiConfig();
  const url = workspacePath ? `/web/workspace/scm/status?${new URLSearchParams({ workspacePath })}` : undefined;
  return useQuery<ScmStatus>({
    queryKey: queryKeys.scmStatus(workspacePath),
    enabled,
    refetchInterval: 5000,
    queryFn: url ? () => client.get<ScmStatus>(url) : skipToken,
  });
}

/** Unstaged unified diff for one file — the source for per-hunk staging. */
export function useScmDiff(
  workspacePath: string | undefined,
  filePath: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client } = useApiConfig();
  const url =
    workspacePath && filePath
      ? `/web/workspace/scm/diff?${new URLSearchParams({ workspacePath, path: filePath })}`
      : undefined;
  return useQuery<ScmDiff>({
    queryKey: queryKeys.scmDiff(workspacePath, filePath),
    enabled,
    queryFn: url ? () => client.get<ScmDiff>(url) : skipToken,
  });
}

interface ScmMutationVariables {
  workspacePath: string;
}

function useScmInvalidation() {
  const qc = useQueryClient();
  return (workspacePath: string) => {
    void qc.invalidateQueries({ queryKey: queryKeys.scmStatus(workspacePath) });
    void qc.invalidateQueries({ queryKey: ['scm-diff', workspacePath] });
    void qc.invalidateQueries({ queryKey: queryKeys.workspaceChanges(workspacePath) });
    void qc.invalidateQueries({ queryKey: ['editor-file-original', workspacePath] });
  };
}

export function useScmStageMutation(direction: 'stage' | 'unstage') {
  const { client } = useApiConfig();
  const invalidate = useScmInvalidation();
  return useMutation({
    mutationFn: (vars: ScmMutationVariables & { paths: string[] }) =>
      client.post<ScmActionResult>(
        `/web/workspace/scm/${direction}?${new URLSearchParams({ workspacePath: vars.workspacePath })}`,
        { paths: vars.paths },
      ),
    onSettled: (_data, _error, vars) => invalidate(vars.workspacePath),
  });
}

export function useScmStageHunkMutation() {
  const { client } = useApiConfig();
  const invalidate = useScmInvalidation();
  return useMutation({
    mutationFn: (vars: ScmMutationVariables & { patch: string }) =>
      client.post<ScmActionResult>(
        `/web/workspace/scm/stage-hunk?${new URLSearchParams({ workspacePath: vars.workspacePath })}`,
        { patch: vars.patch },
      ),
    onSettled: (_data, _error, vars) => invalidate(vars.workspacePath),
  });
}

export function useScmCommitMutation() {
  const { client } = useApiConfig();
  const invalidate = useScmInvalidation();
  return useMutation({
    mutationFn: (vars: ScmMutationVariables & { message: string }) =>
      client.post<ScmActionResult>(
        `/web/workspace/scm/commit?${new URLSearchParams({ workspacePath: vars.workspacePath })}`,
        { message: vars.message },
      ),
    onSettled: (_data, _error, vars) => invalidate(vars.workspacePath),
  });
}
