import type { AgentControllerGoalRecord } from '@mastra/client-js';

import type { GoalSnapshot } from './runtime';

/** One goal shape for the registry, GoalPanel, and GoalStatus regardless of source. */
export interface ChatGoal {
  objective: string;
  status: 'active' | 'paused' | 'done';
  runsUsed: number;
  maxRuns?: number;
  reason?: string;
}

export function normalizeGoalRecord(record: AgentControllerGoalRecord): ChatGoal {
  return {
    objective: record.objective,
    status: record.status,
    runsUsed: record.runsUsed,
    ...(record.maxRuns !== undefined ? { maxRuns: record.maxRuns } : {}),
    ...(record.pausedReason !== undefined ? { reason: record.pausedReason } : {}),
  };
}

export function normalizeGoalSnapshot(snapshot: GoalSnapshot): ChatGoal {
  return {
    objective: snapshot.objective,
    status: snapshot.status,
    runsUsed: snapshot.iteration,
    ...(snapshot.maxRuns ? { maxRuns: snapshot.maxRuns } : {}),
    ...(snapshot.reason !== undefined ? { reason: snapshot.reason } : {}),
  };
}

export const GOAL_SUBCOMMANDS = ['status', 'pause', 'resume', 'clear'] as const;

export function formatGoalStatus(goal: ChatGoal | undefined): string {
  if (!goal || goal.status === 'done') return 'No active goal.';
  const usage = goal.maxRuns ? ` (${goal.runsUsed}/${goal.maxRuns} runs used)` : '';
  const stateLine =
    goal.status === 'active' ? `Goal is active${usage}.` : `Goal is paused${usage}. Use /goal resume to continue.`;
  return [stateLine, `Objective: ${goal.objective}`, ...(goal.reason ? [`Reason: ${goal.reason}`] : [])].join('\n');
}
