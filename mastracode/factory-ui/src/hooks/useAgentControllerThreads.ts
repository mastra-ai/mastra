import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

export const AGENT_CONTROLLER_THREAD_PAGE_SIZE = 20;

interface UseAgentControllerThreadsArgs {
  agentControllerId: string;
  sessionId: string;
  /**
   * Thread metadata that marks this session's threads (`{ factorySessionId }`).
   * Sessions share their Factory's or user's resource, so without it the list
   * holds every thread of that resource.
   */
  threadTags?: Record<string, string>;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerThreads({
  agentControllerId,
  sessionId,
  threadTags,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerThreadsArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    sessionId,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: [...queryKeys.agentControllerThreads(agentControllerId, sessionId), threadTags ?? null],
    queryFn: () =>
      session!.listThreads({
        limit: AGENT_CONTROLLER_THREAD_PAGE_SIZE,
        tags: threadTags,
      }),
    enabled: enabled && Boolean(session),
  });
}
