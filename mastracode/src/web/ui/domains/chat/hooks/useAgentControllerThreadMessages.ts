import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useAgentControllerClient } from './useAgentControllerClient';

interface UseAgentControllerThreadMessagesArgs {
  agentControllerId: string;
  resourceId: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerThreadMessages({
  agentControllerId,
  resourceId,
  threadId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerThreadMessagesArgs) {
  const { session } = useAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useQuery({
    queryKey: queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, threadId),
    queryFn: () => session!.listMessages(threadId!),
    enabled: enabled && Boolean(session) && Boolean(threadId),
    refetchOnWindowFocus: false,
  });
}
