import type { runStreamCompletionScorers } from '../../loop/network/validation';

import { GOAL_SCORER_ID } from './objective';

type JudgeResult = Awaited<ReturnType<typeof runStreamCompletionScorers>>;

/**
 * Synthesize the shape `runStreamCompletionScorers` returns for a scorer that
 * threw, so a failure raised outside the scorer run (resolving the judge model,
 * building the scorer) takes the same judge-failure path as one raised inside it.
 */
export function erroredJudgeResult(reason: string): JudgeResult {
  return {
    complete: false,
    completionReason: undefined,
    scorers: [
      {
        score: 0,
        passed: false,
        reason,
        scorerId: GOAL_SCORER_ID,
        scorerName: 'Goal (LLM)',
        duration: 0,
        errored: true,
      },
    ],
    totalDuration: 0,
    timedOut: false,
  };
}

/**
 * Why this evaluation produced no usable verdict, or `undefined` if it did.
 *
 * Two shapes mean the judge failed, and both are otherwise indistinguishable
 * from a legitimate "keep working" (score 0) result:
 * - a scorer that threw, flagged `errored`
 * - a scorer that never answered: on timeout its promise is dropped, so the goal
 *   scorer is missing from `scorers` entirely and the silence would otherwise
 *   read as "not complete, keep going"
 */
export function judgeFailureReason(result: JudgeResult): string | undefined {
  const errored = result.scorers.find(s => s.errored);
  if (errored) return errored.reason ?? 'The goal judge failed to evaluate the objective.';
  if (result.scorers.length === 0) {
    return result.timedOut
      ? 'The goal judge timed out before returning a verdict.'
      : 'The goal judge did not return a verdict.';
  }
  return undefined;
}
