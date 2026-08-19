import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { createAgentControllerClient, requireAgentController } from '../ui/domains/chat/services/agentControllerClient';

interface ActiveRunResourcesOptions {
  agentControllerId: string;
  resourceIds: string[];
}

/**
 * Which of the given resources have a run in flight. `/active-runs` returns the
 * controller's whole registry, so every caller shares one poll — workspaces and
 * user sessions alike, both keyed by their own sessionId as resourceId.
 */
export function useActiveRunResources({
  agentControllerId,
  resourceIds,
}: ActiveRunResourcesOptions): Record<string, boolean> {
  const { baseUrl } = useApiConfig();
  const query = useQuery({
    queryKey: queryKeys.agentControllerActivity(agentControllerId),
    queryFn: async () => {
      const { controller } = createAgentControllerClient({ agentControllerId, baseUrl });
      return requireAgentController(controller).listActiveRuns();
    },
    enabled: resourceIds.length > 0,
    refetchInterval: 5_000,
    retry: false,
  });
  const running = new Set((query.data ?? []).map(run => run.resourceId));
  return Object.fromEntries(resourceIds.map(id => [id, running.has(id)]));
}
