import { queryOptions, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { createAgentControllerClient, requireAgentController } from '../ui/domains/chat/services/agentControllerClient';

interface ActiveRunResourcesOptions {
  agentControllerId: string;
  resourceIds: string[];
}

/** `/active-runs` is the controller's whole registry, so every caller shares one poll, keyed by sessionId as resourceId. */
function activeRunsQuery(agentControllerId: string, baseUrl: string) {
  return queryOptions({
    queryKey: queryKeys.agentControllerActivity(agentControllerId, baseUrl),
    queryFn: async () => {
      const { controller } = createAgentControllerClient({ agentControllerId, baseUrl });
      return requireAgentController(controller).listActiveRuns();
    },
    refetchInterval: 5_000,
    retry: false,
  });
}

/** Every resource the controller has a run on, whether or not this tab has listed its session yet. */
export function useActiveRunResourceIds(agentControllerId: string): ReadonlySet<string> {
  const { baseUrl } = useApiConfig();
  const { data } = useQuery(activeRunsQuery(agentControllerId, baseUrl));
  return useMemo(
    () => new Set((data ?? []).flatMap(run => (run.resourceId === undefined ? [] : [run.resourceId]))),
    [data],
  );
}

/** Which of the given resources have a run in flight. */
export function useActiveRunResources({
  agentControllerId,
  resourceIds,
}: ActiveRunResourcesOptions): Record<string, boolean> {
  const running = useActiveRunResourceIds(agentControllerId);
  return Object.fromEntries(resourceIds.map(id => [id, running.has(id)]));
}
