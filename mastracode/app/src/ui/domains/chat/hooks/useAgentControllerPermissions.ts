import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '#shared/api/keys';

import { createAgentControllerClient } from '../services/agentControllerClient';

interface UseAgentControllerPermissionsArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerPermissions({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerPermissionsArgs) {
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useQuery({
    queryKey: queryKeys.agentControllerPermissions(agentControllerId, resourceId),
    queryFn: () => session!.getPermissions(),
    enabled: enabled && Boolean(session),
  });
}
