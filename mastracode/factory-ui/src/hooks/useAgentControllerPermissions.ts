import { queryOptions, useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerPermissionsArgs {
  agentControllerId: string;
  sessionId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function agentControllerPermissionsQuery({
  agentControllerId,
  sessionId,
  baseUrl = '',
}: Omit<UseAgentControllerPermissionsArgs, 'enabled'>) {
  return queryOptions({
    queryKey: queryKeys.agentControllerPermissions(agentControllerId, sessionId),
    queryFn: () => createAgentControllerClient({ agentControllerId, sessionId, baseUrl }).session!.getPermissions(),
  });
}

export function useAgentControllerPermissions({
  agentControllerId,
  sessionId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerPermissionsArgs) {
  return useQuery({
    ...agentControllerPermissionsQuery({ agentControllerId, sessionId, baseUrl }),
    enabled: enabled && Boolean(sessionId),
  });
}
