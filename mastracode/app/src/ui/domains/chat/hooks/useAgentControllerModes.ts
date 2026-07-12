import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '#shared/api/keys';

import { createAgentControllerClient } from '../services/agentControllerClient';

interface UseAgentControllerModesArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerModes({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerModesArgs) {
  const { controller } = createAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useQuery({
    queryKey: queryKeys.agentControllerModes(agentControllerId),
    queryFn: () => controller!.listModes(),
    enabled: enabled && Boolean(controller),
    staleTime: Infinity,
  });
}
