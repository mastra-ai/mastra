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

/** Which workspaces have a run in flight. Factory binds one resource per session, so the row key is the run's resourceId. */
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
