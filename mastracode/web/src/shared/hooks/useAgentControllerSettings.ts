import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../../web/ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerSettingsArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerSettings({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerSettingsArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId, scope),
    queryFn: async () => {
      const state = await session!.state();
      return state.settings ?? null;
    },
    enabled: enabled && Boolean(session),
  });
}
