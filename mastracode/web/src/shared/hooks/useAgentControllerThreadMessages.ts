import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../../web/ui/domains/chat/services/agentControllerClient';

/**
 * Cap the initial transcript fetch so opening a long thread doesn't pull (and
 * render) its entire history at once, which freezes the browser. The message
 * list is not virtualized yet, so this bound is the primary guard against the
 * lag on long Mastra Code sessions. Older messages are intentionally not loaded
 * until a "load more" affordance exists.
 */
const DEFAULT_INITIAL_MESSAGE_LIMIT = 100;

interface UseAgentControllerThreadMessagesArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  limit?: number;
}

export function useAgentControllerThreadMessages({
  agentControllerId,
  resourceId,
  scope,
  threadId,
  baseUrl = '',
  enabled = true,
  limit = DEFAULT_INITIAL_MESSAGE_LIMIT,
}: UseAgentControllerThreadMessagesArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: [...queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, threadId), limit],
    queryFn: () => session!.listMessages(threadId!, limit),
    enabled: enabled && Boolean(session) && Boolean(threadId),
    refetchOnWindowFocus: false,
  });
}
