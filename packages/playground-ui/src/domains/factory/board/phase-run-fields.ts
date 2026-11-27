export const MAX_PHASE_INSTRUCTIONS = 1000;
export const MAX_PHASE_OBJECTIVE = 2000;
export const MAX_PHASE_GOAL_RUNS = 50;

export interface PhaseGoal {
  objective: string;
  maxRuns?: number;
}

export function phaseGoalRunsValid(maxRuns: number | undefined): boolean {
  return maxRuns === undefined || (Number.isInteger(maxRuns) && maxRuns >= 1 && maxRuns <= MAX_PHASE_GOAL_RUNS);
}

/** Whether a phase's instructions and goal fit what Factory saves. */
export function phaseRunFieldsValid(instructions: string, goal: PhaseGoal | undefined): boolean {
  return (
    instructions.length <= MAX_PHASE_INSTRUCTIONS &&
    (goal?.objective.length ?? 0) <= MAX_PHASE_OBJECTIVE &&
    phaseGoalRunsValid(goal?.maxRuns)
  );
}
