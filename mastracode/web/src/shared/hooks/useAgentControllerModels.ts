import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../../web/ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerModelsArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerModels({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerModelsArgs) {
  const { controller } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerModels(agentControllerId),
    queryFn: async () => {
      const models = await controller!.listModels();
      return models.filter(model => model.hasApiKey);
    },
    enabled: enabled && Boolean(controller),
  });
}
