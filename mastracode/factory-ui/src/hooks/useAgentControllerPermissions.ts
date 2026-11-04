import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerPermissionsArgs {
  agentControllerId: string;
  sessionId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerPermissions({
  agentControllerId,
  sessionId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerPermissionsArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    sessionId,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerPermissions(agentControllerId, sessionId),
    queryFn: () => session!.getPermissions(),
    enabled: enabled && Boolean(session),
  });
}
