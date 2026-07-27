import { useMutation } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { createUserSession, pushBranch } from '../../web/ui/domains/workspaces/services/github';

/**
 * Mutation hooks for the per-project git write operations
 * (`/web/github/projects/:id/{sessions,commit,push,pr}`).
 *
 * Thin wrappers over the services: callers get `isPending`/`error` for UI
 * state, and failures surface as `GitOpError` (with `code`, `status`, and
 * `authRequired` for 401s). None of these touch the query cache — worktree and
 * project persistence stays with the consuming flow.
 */

export interface CreateUserSessionVariables {
  projectRepositoryId: string;
  branch: string;
  baseBranch?: string;
}

/** Create or reuse a Factory session. Its workspace is materialized by AgentController on session creation. */
export function useCreateUserSessionMutation() {
  const { baseUrl } = useApiConfig();
  return useMutation({
    mutationFn: ({ projectRepositoryId, branch, baseBranch }: CreateUserSessionVariables) =>
      createUserSession(baseUrl, projectRepositoryId, branch, baseBranch),
  });
}

export interface PushBranchVariables {
  projectRepositoryId: string;
  branch: string;
  sessionId: string;
}

/** Push a Factory session branch back to GitHub. */
export function usePushBranchMutation() {
  const { baseUrl } = useApiConfig();
  return useMutation({
    mutationFn: ({ projectRepositoryId, branch, sessionId }: PushBranchVariables) =>
      pushBranch(baseUrl, projectRepositoryId, branch, sessionId),
  });
}
