import { useChatSessionContext } from './useChatSessionContext';
import { useChatRuntime } from './useChatRuntime';
import { useAgentControllerGoal } from '../../../../hooks/useAgentControllerGoal';
import type { ChatGoal } from '../services/goal';
import { normalizeGoalSnapshot } from '../services/goal';
import { AGENT_CONTROLLER_ID } from '../services/constants';

export interface ChatGoalValue {
  goal: ChatGoal | undefined;
}

/**
 * Authoritative goal state: the GET query is the source of truth, while the
 * streamed `goal_evaluation` snapshot covers the window while the refetch
 * triggered by that same event is still in flight. GoalPanel, GoalStatus, and
 * the /goal command all consume this so they can never disagree.
 */
export function useChatGoal(): ChatGoalValue {
  const { resourceId, projectPath, baseUrl, sessionEnabled } = useChatSessionContext();
  const runtime = useChatRuntime();
  const query = useAgentControllerGoal({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  });

  if (!sessionEnabled) return { goal: undefined };

  // Before the query has resolved, the streamed `goal_evaluation` snapshot is
  // all we have. Once resolved, query data is authoritative — `null` means no
  // goal and must never fall back to an older snapshot.
  if (!query.isSuccess) {
    return { goal: runtime.goal ? normalizeGoalSnapshot(runtime.goal) : undefined };
  }
  return { goal: query.data ?? undefined };
}
