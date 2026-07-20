import { useMutation } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { createWorktree, pushBranch } from '../../web/ui/domains/workspaces/services/github';

/**
 * Mutation hooks for the per-project git write operations
 * (`/web/github/repositories/:id/{worktree,commit,push,pr}`).
 *
 * Thin wrappers over the services: callers get `isPending`/`error` for UI
 * state, and failures surface as `GitOpError` (with `code`, `status`, and
 * `authRequired` for 401s). None of these touch the query cache — worktree and
 * project persistence stays with the consuming flow.
 */

export interface CreateWorktreeVariables {
  githubProjectId: string;
  branch: string;
  baseBranch?: string;
}

/** Create (or reuse) a git worktree + feature branch inside the project's sandbox. */
export function useCreateWorktreeMutation() {
  const { baseUrl } = useApiConfig();
  return useMutation({
    mutationFn: ({ githubProjectId, branch, baseBranch }: CreateWorktreeVariables) =>
      createWorktree(baseUrl, githubProjectId, branch, baseBranch),
  });
}

export interface PushBranchVariables {
  githubProjectId: string;
  branch: string;
  worktreePath?: string;
}

/** Push a branch back to GitHub from inside the sandbox. */
export function usePushBranchMutation() {
  const { baseUrl } = useApiConfig();
  return useMutation({
    mutationFn: ({ githubProjectId, branch, worktreePath }: PushBranchVariables) =>
      pushBranch(baseUrl, githubProjectId, branch, worktreePath),
  });
}
