import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient, requireAgentController } from '../ui/domains/chat/services/agentControllerClient';

/** How often workspace activity is re-checked while the tab is focused. */
export const WORKSPACE_ACTIVITY_POLL_MS = 5000;

interface WorkspaceActivityOptions {
  agentControllerId: string;
  resourceId: string;
  workspaceIds: string[];
  baseUrl?: string;
  enabled: boolean;
}

/**
 * Which workspaces have an agent run in flight, from one controller-wide poll
 * of the server's in-memory active-run list. A row is running when an active
 * run belongs to its session's resource. The query identity is constant, so
 * neither navigation nor workspace-set changes can reset it (a reset reads as
 * every run flipping idle for one render and fires completion sounds).
 */
export function useWorkspaceActivity({
  agentControllerId,
  resourceId,
  workspaceIds,
  baseUrl,
  enabled,
}: WorkspaceActivityOptions): Record<string, boolean> {
  const query = useQuery({
    queryKey: queryKeys.agentControllerActivity(agentControllerId),
    queryFn: async () => {
      const { controller } = createAgentControllerClient({ agentControllerId, resourceId, baseUrl });
      return requireAgentController(controller).listActiveRuns();
    },
    enabled,
    refetchInterval: WORKSPACE_ACTIVITY_POLL_MS,
    retry: false,
  });
  const runs = query.data ?? [];
  return Object.fromEntries(workspaceIds.map(id => [id, runs.some(run => run.resourceId === id)]));
}
