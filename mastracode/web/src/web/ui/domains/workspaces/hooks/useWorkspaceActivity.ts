import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';

/** How often workspace activity is re-checked while the tab is focused. */
export const WORKSPACE_ACTIVITY_POLL_MS = 5000;

/**
 * Reports which workspaces have an agent run in flight, from a single thread
 * listing. Threads are stamped with their worktree's `projectPath` tag and the
 * server annotates each with its run state (`active`/`idle`) — backed by the
 * same per-thread tracking the signals `ifIdle` path uses — so one poll covers
 * every worktree sharing the resourceId instead of a request per row.
 */
export function useWorkspaceActivity({
  agentControllerId,
  resourceId,
  projectPath,
  worktreePaths,
  baseUrl,
  enabled,
}: {
  agentControllerId: string;
  resourceId: string;
  /** The active worktree's path — the session scope the listing is read through. */
  projectPath: string | undefined;
  worktreePaths: string[];
  baseUrl?: string;
  enabled: boolean;
}): Record<string, boolean> {
  const query = useQuery({
    queryKey: queryKeys.agentControllerActivity(agentControllerId, resourceId),
    queryFn: async () => {
      // A thread listing spans the whole resource regardless of session scope,
      // so read through the already-live active-worktree session rather than
      // seeding a new one.
      const { session } = createAgentControllerClient({
        agentControllerId,
        resourceId,
        scope: projectPath,
        baseUrl,
      });
      return requireAgentControllerSession(session).listThreads();
    },
    enabled,
    refetchInterval: WORKSPACE_ACTIVITY_POLL_MS,
    retry: false,
  });
  const threads = query.data ?? [];
  return Object.fromEntries(
    worktreePaths.map(path => [
      path,
      threads.some(thread => thread.tags?.projectPath === path && thread.state === 'active'),
    ]),
  );
}
