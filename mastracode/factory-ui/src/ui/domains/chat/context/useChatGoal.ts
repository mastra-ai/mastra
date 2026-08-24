import { useChatSessionContext } from './useChatSessionContext';
import { useChatRuntime } from './useChatRuntime';
import { useAgentControllerGoal } from '../../../../hooks/useAgentControllerGoalMutations';
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

  const streamed = runtime.goal ? normalizeGoalSnapshot(runtime.goal) : undefined;
  if (query.isFetching && streamed) {
    return { goal: streamed };
  }
  return { goal: query.data ?? streamed };
}
