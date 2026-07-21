import type { GoalState } from './goal-manager.js';

export function createGoalReminderSignal(goal: GoalState) {
  return {
    type: 'system-reminder' as const,
    contents: goal.objective,
    attributes: { type: 'goal' },
    metadata: {
      goalId: goal.id,
      maxTurns: goal.maxTurns,
      judgeModelId: goal.judgeModelId,
    },
  };
}
