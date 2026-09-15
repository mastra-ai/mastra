import type { GoalObjectiveRecord } from '../../storage/domains/thread-state/base';
import { GOAL_SCORE_WAITING, GOAL_SCORER_ID } from './objective';

// =============================================================================
// Goal evaluation outcome
// =============================================================================
//
// Shared decision logic for the in-loop goal steps (streaming
// `loop/workflows/agentic-execution/goal-step.ts` and durable
// `agent/durable/workflows/steps/goal.ts`). Both steps run the goal scorer and
// must agree on how a scorer result maps onto the persisted objective record
// and the loop continuation decision — this helper is that single source of
// truth so the two sites cannot drift.

/**
 * How many *consecutive* failed judge evaluations are tolerated before the
 * objective is parked. A judge failure (thrown scorer or timed-out judge) is a
 * missing verdict, not a verdict: transient failures are retried on the next
 * loop iteration without consuming run budget, and only a judge that keeps
 * failing pauses the goal.
 */
export const MAX_CONSECUTIVE_JUDGE_FAILURES = 3;

/** Minimal structural view of a single scorer result the outcome depends on. */
export type GoalEvaluationScorerResult = {
  scorerId: string;
  score: number;
  reason?: string;
  errored?: boolean;
};

/** Minimal structural view of the completion-scorer run the outcome depends on. */
export type GoalEvaluationResult = {
  complete: boolean;
  scorers: GoalEvaluationScorerResult[];
  timedOut: boolean;
};

export type GoalEvaluationOutcome = {
  /** Whether the judge failed to produce a verdict (threw or timed out). */
  judgeFailed: boolean;
  /** The judge error/timeout cause when `judgeFailed` is true. */
  failureReason: string | undefined;
  /** Whether the goal explicitly asked to stop and wait for the user. */
  waiting: boolean;
  /** Runs consumed after this evaluation. Unchanged when the judge failed. */
  runsUsed: number;
  /** Consecutive judge failures after this evaluation (0 after a success). */
  judgeFailureCount: number;
  maxRunsReached: boolean;
  status: GoalObjectiveRecord['status'];
  pausedReason: string | undefined;
  /** Whether the auto-loop should force another iteration toward the goal. */
  shouldContinue: boolean;
};

/**
 * Maps a goal-scorer run onto the objective record update and continuation
 * decision.
 *
 * Decision rules:
 * - A judge failure consumes no run budget (`runsUsed` unchanged) — the
 *   evaluation produced no verdict.
 * - Transient judge failures keep the objective `active` and continue the loop
 *   so the next iteration retries the judge; only
 *   {@link MAX_CONSECUTIVE_JUDGE_FAILURES} consecutive failures pause the
 *   objective (with the judge error as `pausedReason`).
 * - A timed-out evaluation whose results are missing the goal scorer entirely
 *   is a judge failure too — a judge that never answered must not be read as
 *   "keep going".
 * - Otherwise the existing precedence applies: complete → done; budget
 *   exhausted (and not waiting) → paused; a "waiting" decision leaves the
 *   record `active` and only stops the auto-loop.
 */
export function resolveGoalEvaluationOutcome(args: {
  record: GoalObjectiveRecord;
  result: GoalEvaluationResult;
  maxRuns: number;
}): GoalEvaluationOutcome {
  const { record, result, maxRuns } = args;

  const erroredScorer = result.scorers.find(s => s.errored);
  // Timeout hole: the goal scorer's result can be absent from a timed-out run
  // entirely, which would otherwise read as a clean "keep working" score.
  const goalScorerMissing = result.timedOut && !result.scorers.some(s => s.scorerId === GOAL_SCORER_ID);
  const judgeFailed = !!erroredScorer || goalScorerMissing;
  const failureReason =
    erroredScorer?.reason ??
    (goalScorerMissing ? 'Goal evaluation timed out before the judge produced a verdict.' : undefined);

  // Only the built-in goal scorer uses `GOAL_SCORE_WAITING` as a sentinel;
  // attribute it by scorer id so a custom scorer that legitimately returns 0.5
  // is not misread as an explicit "waiting" checkpoint.
  const waiting =
    !judgeFailed &&
    !result.complete &&
    result.scorers.some(s => s.scorerId === GOAL_SCORER_ID && s.score === GOAL_SCORE_WAITING);

  const runsUsed = judgeFailed ? record.runsUsed : record.runsUsed + 1;
  const judgeFailureCount = judgeFailed ? (record.judgeFailureCount ?? 0) + 1 : 0;
  const maxRunsReached = runsUsed >= maxRuns;
  const judgePaused = judgeFailed && judgeFailureCount >= MAX_CONSECUTIVE_JUDGE_FAILURES;

  let status: GoalObjectiveRecord['status'] = record.status;
  let pausedReason: string | undefined;
  if (judgePaused) {
    status = 'paused';
    pausedReason = `The goal judge failed ${judgeFailureCount} consecutive times — fix the judge and resume. Last error: ${
      failureReason ?? 'unknown'
    }`;
  } else if (judgeFailed) {
    // Sub-threshold failure: leave the record as-is and retry next iteration.
  } else if (result.complete) {
    status = 'done';
  } else if (maxRunsReached && !waiting) {
    // Budget exhausted without reaching the goal: park it (visibly) instead of
    // leaving it `active` but stuck. Raising maxRuns + setting status back to
    // `active` (updateObjectiveOptions) resumes evaluation.
    status = 'paused';
    pausedReason = `Ran out of evaluation budget (${maxRuns} runs) before reaching the goal — raise maxRuns to resume.`;
  }

  const shouldContinue = !result.complete && !waiting && status === 'active' && !maxRunsReached;

  return {
    judgeFailed,
    failureReason: judgeFailed ? failureReason : undefined,
    waiting,
    runsUsed,
    judgeFailureCount,
    maxRunsReached,
    status,
    pausedReason,
    shouldContinue,
  };
}
