import { useMutation } from '@tanstack/react-query';

import { commitChanges, createWorktree, openPullRequest, pushBranch } from '../services/github';

/**
 * Mutation hooks for the per-project git write operations
 * (`/api/web/github/projects/:id/{worktree,commit,push,pr}`).
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
  return useMutation({
    mutationFn: ({ githubProjectId, branch, baseBranch }: CreateWorktreeVariables) =>
      createWorktree(githubProjectId, branch, baseBranch),
  });
}

export interface CommitChangesVariables {
  githubProjectId: string;
  message: string;
  worktreePath?: string;
}

/** Stage and commit all changes in a worktree; resolves `committed: false` on no-op. */
export function useCommitChangesMutation() {
  return useMutation({
    mutationFn: ({ githubProjectId, message, worktreePath }: CommitChangesVariables) =>
      commitChanges(githubProjectId, message, worktreePath),
  });
}

export interface PushBranchVariables {
  githubProjectId: string;
  branch: string;
  worktreePath?: string;
}

/** Push a branch back to GitHub from inside the sandbox. */
export function usePushBranchMutation() {
  return useMutation({
    mutationFn: ({ githubProjectId, branch, worktreePath }: PushBranchVariables) =>
      pushBranch(githubProjectId, branch, worktreePath),
  });
}

export interface OpenPullRequestVariables {
  githubProjectId: string;
  branch: string;
  title: string;
  body?: string;
  base?: string;
  worktreePath?: string;
}

/** Open a pull request via the sandbox `gh` CLI; resolves with the PR url. */
export function useOpenPullRequestMutation() {
  return useMutation({
    mutationFn: ({ githubProjectId, ...args }: OpenPullRequestVariables) => openPullRequest(githubProjectId, args),
  });
}
