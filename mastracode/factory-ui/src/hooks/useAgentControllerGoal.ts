import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';
import { normalizeGoalRecord, type ChatGoal } from '../ui/domains/chat/services/goal';

interface UseAgentControllerGoalArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

/**
 * Authoritative goal record for one session. Resolves to `null` when no goal
 * is set — never `undefined`, so an empty result is cacheable and a cleared
 * goal cannot fall back to stale data.
 */
export function useAgentControllerGoal(args: UseAgentControllerGoalArgs) {
  const { agentControllerId, resourceId, scope, baseUrl = '', enabled = true } = args;
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, scope, baseUrl, enabled });
  return useQuery({
    queryKey: queryKeys.agentControllerGoal(agentControllerId, resourceId, scope),
    enabled: enabled && Boolean(resourceId && session),
    staleTime: 0,
    queryFn: async (): Promise<ChatGoal | null> => {
      const record = await requireAgentControllerSession(session).getGoal();
      return record ? normalizeGoalRecord(record) : null;
    },
  });
}
