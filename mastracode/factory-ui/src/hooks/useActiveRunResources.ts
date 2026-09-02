import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { createAgentControllerClient, requireAgentController } from '../ui/domains/chat/services/agentControllerClient';
import { useFeedPollInterval } from '../ui/domains/factory/context/FeedEventsProvider';

interface ActiveRunResourcesOptions {
  agentControllerId: string;
  resourceIds: string[];
}

/**
 * Which of the given resources have a run in flight. `/active-runs` returns the
 * controller's whole registry, so every caller shares one cache — workspaces
 * and user sessions alike, both keyed by their own sessionId as resourceId.
 * The feed stream announces every run start and end.
 */
export function useActiveRunResources({
  agentControllerId,
  resourceIds,
}: ActiveRunResourcesOptions): Record<string, boolean> {
  const { baseUrl } = useApiConfig();
  const refetchInterval = useFeedPollInterval(5_000);
  const query = useQuery({
    queryKey: queryKeys.agentControllerActivity(agentControllerId, baseUrl),
    queryFn: async () => {
      const { controller } = createAgentControllerClient({ agentControllerId, baseUrl });
      return requireAgentController(controller).listActiveRuns();
    },
    enabled: resourceIds.length > 0,
    refetchInterval,
    retry: false,
  });
  const running = new Set((query.data ?? []).map(run => run.resourceId));
  return Object.fromEntries(resourceIds.map(id => [id, running.has(id)]));
}
