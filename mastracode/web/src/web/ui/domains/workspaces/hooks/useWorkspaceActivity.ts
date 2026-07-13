import { useQueries } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';

/** How often idle-workspace activity is re-checked while the tab is focused. */
export const WORKSPACE_ACTIVITY_POLL_MS = 5000;

/**
 * Polls the non-creating `running` peek for each worktree's scoped session and
 * reports which workspaces have an agent run in flight. Worktrees with no live
 * session report `false` (the peek never seeds sessions), so it is safe to
 * poll for every row in the sidebar.
 */
export function useWorkspaceActivity({
  agentControllerId,
  resourceId,
  worktreePaths,
  baseUrl,
  enabled,
}: {
  agentControllerId: string;
  resourceId: string;
  worktreePaths: string[];
  baseUrl?: string;
  enabled: boolean;
}): Record<string, boolean> {
  return useQueries({
    queries: worktreePaths.map(worktreePath => ({
      queryKey: queryKeys.agentControllerRunning(agentControllerId, resourceId, worktreePath),
      queryFn: async () => {
        const { session } = createAgentControllerClient({
          agentControllerId,
          resourceId,
          scope: worktreePath,
          baseUrl,
        });
        return requireAgentControllerSession(session).running();
      },
      enabled,
      refetchInterval: WORKSPACE_ACTIVITY_POLL_MS,
      retry: false,
    })),
    combine: results =>
      Object.fromEntries(worktreePaths.map((path, index) => [path, results[index]?.data?.running === true])),
  });
}
