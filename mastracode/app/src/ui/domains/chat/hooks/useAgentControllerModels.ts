import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '#shared/api/keys';

import { createAgentControllerClient } from '../services/agentControllerClient';

interface UseAgentControllerModelsArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerModels({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerModelsArgs) {
  const { controller } = createAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useQuery({
    queryKey: queryKeys.agentControllerModels(agentControllerId),
    queryFn: () => controller!.listModels(),
    enabled: enabled && Boolean(controller),
  });
}
