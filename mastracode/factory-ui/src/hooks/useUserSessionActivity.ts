import { queryOptions, useQueries } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

/** How often each visible user session is polled for run activity while the sidebar is focused. */
export const USER_SESSION_ACTIVITY_POLL_MS = 5000;

/**
 * Reports which user sessions currently have an agent run in flight. User
 * sessions each have their own `resourceId` (=== their sessionId), so unlike
 * factory workspaces they cannot share a single thread listing — the hook
 * fires one poll per session, which is fine as long as callers pass only the
 * sessions actually rendered in the sidebar.
 */
export function useUserSessionActivity({
  baseUrl,
  sessionIds,
  enabled,
}: {
  baseUrl: string;
  sessionIds: string[];
  enabled: boolean;
}): Record<string, boolean> {
  const queries = useQueries({
    queries: sessionIds.map(sessionId =>
      queryOptions({
        queryKey: queryKeys.agentControllerSessionActivity(AGENT_CONTROLLER_ID, sessionId),
        queryFn: async () => {
          const { session } = createAgentControllerClient({
            agentControllerId: AGENT_CONTROLLER_ID,
            resourceId: sessionId,
            baseUrl,
          });
          return requireAgentControllerSession(session).listThreads();
        },
        enabled,
        refetchInterval: USER_SESSION_ACTIVITY_POLL_MS,
        retry: false,
      }),
    ),
  });

  const activeBySessionId: Record<string, boolean> = {};
  sessionIds.forEach((sessionId, index) => {
    const query = queries[index];
    activeBySessionId[sessionId] = query?.data?.some(thread => thread.state === 'active') ?? false;
  });
  return activeBySessionId;
}
