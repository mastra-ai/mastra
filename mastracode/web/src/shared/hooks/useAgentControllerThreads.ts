import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../../web/ui/domains/chat/services/agentControllerClient';

export const AGENT_CONTROLLER_THREAD_PAGE_SIZE = 20;

interface UseAgentControllerThreadsArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerThreads({
  agentControllerId,
  resourceId,
  projectPath,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerThreadsArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerThreads(agentControllerId, resourceId, projectPath),
    queryFn: () =>
      session!.listThreads({
        limit: AGENT_CONTROLLER_THREAD_PAGE_SIZE,
        tags: projectPath ? { projectPath } : undefined,
      }),
    enabled: enabled && Boolean(session),
  });
}
