import { useMutation } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import type { PrepareProgress } from '../../web/ui/domains/workspaces/services/github';
import { ensureRepoMaterialized } from '../../web/ui/domains/workspaces/services/github';

export interface EnsureRepoMaterializedVariables {
  githubProjectId: string;
  /**
   * Live server-side preparation steps (SSE). Deliberately a caller-supplied
   * callback rather than cache state — progress is transient UI feedback.
   */
  onProgress?: (event: PrepareProgress) => void;
}

/**
 * Materialize a GitHub project into its cloud sandbox (provision/reattach +
 * clone/pull). Resolves the `MaterializeResult` with the resourceId to open the
 * project; failures carry the server's error `code` (e.g.
 * `sandbox_not_configured`) for distinct UI handling.
 */
export function useEnsureRepoMaterializedMutation() {
  const { baseUrl } = useApiConfig();
  return useMutation({
    mutationFn: ({ githubProjectId, onProgress }: EnsureRepoMaterializedVariables) =>
      ensureRepoMaterialized(baseUrl, githubProjectId, onProgress),
  });
}
