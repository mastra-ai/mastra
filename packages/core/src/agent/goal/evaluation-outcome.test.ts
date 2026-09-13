import { describe, expect, it } from 'vitest';

import type { GoalObjectiveRecord } from '../../storage/domains/thread-state/base';

import {
  MAX_CONSECUTIVE_JUDGE_FAILURES,
  resolveGoalEvaluationOutcome,
  type GoalEvaluationResult,
} from './evaluation-outcome';
import { GOAL_SCORE_WAITING, GOAL_SCORER_ID } from './objective';

function record(overrides: Partial<GoalObjectiveRecord> = {}): GoalObjectiveRecord {
  return {
    objective: 'Ship the feature',
    status: 'active',
    runsUsed: 0,
    maxRuns: 5,
    startedAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function evaluation(overrides: Partial<GoalEvaluationResult> = {}): GoalEvaluationResult {
  return {
    complete: false,
    scorers: [{ scorerId: GOAL_SCORER_ID, score: 0 }],
    timedOut: false,
    ...overrides,
  };
}

describe('resolveGoalEvaluationOutcome', () => {
  it('keep-working verdict consumes a run and continues the loop', () => {
    const outcome = resolveGoalEvaluationOutcome({ record: record(), result: evaluation(), maxRuns: 5 });
    expect(outcome).toMatchObject({
      judgeFailed: false,
      waiting: false,
      runsUsed: 1,
      judgeFailureCount: 0,
      status: 'active',
      shouldContinue: true,
    });
  });

  it('complete verdict marks the objective done and stops the loop', () => {
    const outcome = resolveGoalEvaluationOutcome({
      record: record(),
      result: evaluation({ complete: true, scorers: [{ scorerId: GOAL_SCORER_ID, score: 1 }] }),
      maxRuns: 5,
    });
    expect(outcome).toMatchObject({ status: 'done', runsUsed: 1, shouldContinue: false });
  });

  it('waiting verdict stops the loop but keeps the record active', () => {
    const outcome = resolveGoalEvaluationOutcome({
      record: record(),
      result: evaluation({ scorers: [{ scorerId: GOAL_SCORER_ID, score: GOAL_SCORE_WAITING }] }),
      maxRuns: 5,
    });
    expect(outcome).toMatchObject({ waiting: true, status: 'active', runsUsed: 1, shouldContinue: false });
    expect(outcome.pausedReason).toBeUndefined();
  });

  it('budget exhaustion pauses the objective with a reason', () => {
    const outcome = resolveGoalEvaluationOutcome({ record: record({ runsUsed: 4 }), result: evaluation(), maxRuns: 5 });
    expect(outcome).toMatchObject({ runsUsed: 5, maxRunsReached: true, status: 'paused', shouldContinue: false });
    expect(outcome.pausedReason).toContain('budget');
  });

  it('a judge failure consumes no run budget and retries on the next iteration', () => {
    const outcome = resolveGoalEvaluationOutcome({
      record: record({ runsUsed: 2 }),
      result: evaluation({ scorers: [{ scorerId: GOAL_SCORER_ID, score: 0, errored: true, reason: 'boom' }] }),
      maxRuns: 5,
    });
    expect(outcome).toMatchObject({
      judgeFailed: true,
      runsUsed: 2,
      judgeFailureCount: 1,
      status: 'active',
      shouldContinue: true,
    });
    expect(outcome.pausedReason).toBeUndefined();
  });

  it('pauses only after MAX_CONSECUTIVE_JUDGE_FAILURES consecutive failures, carrying the judge error', () => {
    const outcome = resolveGoalEvaluationOutcome({
      record: record({ judgeFailureCount: MAX_CONSECUTIVE_JUDGE_FAILURES - 1 }),
      result: evaluation({ scorers: [{ scorerId: GOAL_SCORER_ID, score: 0, errored: true, reason: 'boom' }] }),
      maxRuns: 5,
    });
    expect(outcome).toMatchObject({
      judgeFailed: true,
      judgeFailureCount: MAX_CONSECUTIVE_JUDGE_FAILURES,
      status: 'paused',
      shouldContinue: false,
      runsUsed: 0,
    });
    expect(outcome.pausedReason).toContain('boom');
  });

  it('a successful verdict resets the consecutive-failure count', () => {
    const outcome = resolveGoalEvaluationOutcome({
      record: record({ judgeFailureCount: 2 }),
      result: evaluation(),
      maxRuns: 5,
    });
    expect(outcome.judgeFailureCount).toBe(0);
  });

  it('a timed-out run missing the goal scorer result counts as a judge failure', () => {
    const outcome = resolveGoalEvaluationOutcome({
      record: record(),
      result: evaluation({ timedOut: true, scorers: [] }),
      maxRuns: 5,
    });
    expect(outcome).toMatchObject({ judgeFailed: true, judgeFailureCount: 1, runsUsed: 0, status: 'active' });
  });

  it('a timed-out run that still has the goal scorer verdict is not a judge failure', () => {
    const outcome = resolveGoalEvaluationOutcome({
      record: record(),
      result: evaluation({ timedOut: true }),
      maxRuns: 5,
    });
    expect(outcome).toMatchObject({ judgeFailed: false, runsUsed: 1, shouldContinue: true });
  });
});
