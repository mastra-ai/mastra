import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useAgentControllerClient } from './useAgentControllerClient';

interface UseAgentControllerSettingsArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerSettings({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerSettingsArgs) {
  const { session } = useAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useQuery({
    queryKey: queryKeys.agentControllerSettings(agentControllerId, resourceId),
    queryFn: async () => {
      const state = await session!.state();
      return state.settings ?? null;
    },
    enabled: enabled && Boolean(session),
  });
}
