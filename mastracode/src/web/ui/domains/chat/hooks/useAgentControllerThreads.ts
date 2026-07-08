import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useAgentControllerClient } from './useAgentControllerClient';

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
  const { session } = useAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

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
