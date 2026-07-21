import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../../web/ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerThreadMessagesArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerThreadMessages({
  agentControllerId,
  resourceId,
  projectPath,
  threadId,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerThreadMessagesArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, threadId),
    queryFn: () => session!.listMessages(threadId!),
    enabled: enabled && Boolean(session) && Boolean(threadId),
    refetchOnWindowFocus: false,
  });
}
