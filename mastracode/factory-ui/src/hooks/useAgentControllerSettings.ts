import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerSettingsArgs {
  agentControllerId: string;
  sessionId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerSettings({
  agentControllerId,
  sessionId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerSettingsArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    sessionId,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerSettings(agentControllerId, sessionId),
    queryFn: async () => {
      const state = await requireAgentControllerSession(session).state();
      if (!state.settings) throw new Error('Session settings are unavailable');
      return state.settings;
    },
    enabled: enabled && Boolean(session),
  });
}
