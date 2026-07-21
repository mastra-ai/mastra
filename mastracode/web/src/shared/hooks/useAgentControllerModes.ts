import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../../web/ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerModesArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerModes({
  agentControllerId,
  resourceId,
  projectPath,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerModesArgs) {
  const { controller } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerModes(agentControllerId),
    queryFn: () => controller!.listModes(),
    enabled: enabled && Boolean(controller),
    staleTime: Infinity,
  });
}
