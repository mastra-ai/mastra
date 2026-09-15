import type { RequestContext } from '../../request-context';
import type { GoalObjectiveRecord } from '../../storage/domains/thread-state/base';

interface GoalObjectiveCache {
  threadId: string;
  objective: GoalObjectiveRecord | null;
}

const GOAL_OBJECTIVE_CACHE_KEY = '__mastra_goal_objective_cache';

export function clearCachedGoalObjective(requestContext: RequestContext | undefined): void {
  requestContext?.delete(GOAL_OBJECTIVE_CACHE_KEY);
}

export function cacheGoalObjective(
  requestContext: RequestContext | undefined,
  threadId: string,
  objective: GoalObjectiveRecord | undefined,
): void {
  requestContext?.set(GOAL_OBJECTIVE_CACHE_KEY, {
    threadId,
    objective: objective ?? null,
  } satisfies GoalObjectiveCache);
}

export function takeCachedGoalObjective(
  requestContext: RequestContext | undefined,
  threadId: string,
): GoalObjectiveCache | undefined {
  const cached = requestContext?.get(GOAL_OBJECTIVE_CACHE_KEY) as GoalObjectiveCache | undefined;
  clearCachedGoalObjective(requestContext);
  return cached?.threadId === threadId ? cached : undefined;
}
