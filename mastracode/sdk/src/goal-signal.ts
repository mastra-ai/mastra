import type { GoalState } from './goal-manager.js';

export function createGoalReminderSignal(goal: GoalState) {
  return {
    type: 'system-reminder' as const,
    contents: goal.objective,
    attributes: { type: 'goal' },
    metadata: {
      goalId: goal.id,
      // Must match the key the TUI reads (`goalMaxTurns`). It previously used
      // `maxTurns`, so the reminder rendered without its attempt budget.
      goalMaxTurns: goal.maxTurns,
      judgeModelId: goal.judgeModelId,
    },
  };
}
