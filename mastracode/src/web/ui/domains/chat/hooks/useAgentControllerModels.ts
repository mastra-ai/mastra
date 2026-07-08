import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useAgentControllerClient } from './useAgentControllerClient';

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
  const { controller } = useAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useQuery({
    queryKey: queryKeys.agentControllerModels(agentControllerId),
    queryFn: async () => {
      const models = await controller!.listModels();
      return models.filter(model => model.hasApiKey);
    },
    enabled: enabled && Boolean(controller),
  });
}
