/**
 * Tests for the goal-judge failure-mode taxonomy.
 *
 * The judge loop classifies every failure into one of four kinds:
 *
 *   - `timeout`           → retried once with backoff, then paused with
 *                           reason `judge_timeout`.
 *   - `provider_error`    → not retried, paused with `judge_provider_error`.
 *   - `invalid_verdict`   → not retried, paused with `judge_invalid_verdict`.
 *                           Crucially, NEVER falls through to `'continue'`.
 *   - `max_turns`         → existing budget-exhausted branch; stamps
 *                           `lastFailure.kind: 'max_turns'` for introspection.
 *
 * The failure kind is persisted on `GoalState.lastFailure` so a recovered
 * session can introspect what went wrong without re-running the judge.
 */

import { describe, expect, it } from 'vitest';

import type { GoalState } from '../../storage/domains/harness';

import { setupHarness } from './__test-utils__';
import { HarnessGoalJudgeFailedError } from './errors';
import type { HarnessEvent } from './events';
import type { Session } from './session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TestJudgeHook {
  (goal: GoalState): Promise<{ decision: 'done' | 'continue' | 'waiting'; reason: string }>;
}

function installJudge(session: Session, fn: TestJudgeHook): void {
  (session as unknown as { __testJudge: TestJudgeHook }).__testJudge = fn;
}

function recordEvents(session: Session, types?: HarnessEvent['type'][]): HarnessEvent[] {
  const events: HarnessEvent[] = [];
  session.subscribe(e => {
    if (!types || types.includes(e.type)) events.push(e);
  });
  return events;
}

class AbortLikeError extends Error {
  override readonly name = 'AbortError';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Goal judge — timeout classification + retry', () => {
  it('retries an AbortError once, then pauses with reason "judge_timeout"', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });

    let calls = 0;
    installJudge(session, async () => {
      calls += 1;
      throw new AbortLikeError('aborted');
    });
    const events = recordEvents(session, ['goal_paused', 'goal_judged']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'kick off' });
    // The retry backoff is 1s; jump past it. We're patient with setImmediate
    // drains here because the runner awaits the backoff.
    await new Promise(resolve => setTimeout(resolve, 1200));

    expect(calls).toBe(2);
    expect(session.getGoal()?.status).toBe('paused');
    const paused = events.find(e => e.type === 'goal_paused') as { reason: string } | undefined;
    expect(paused?.reason).toBe('judge_timeout');
    expect(session.getGoal()?.lastFailure?.kind).toBe('timeout');
    expect(events.some(e => e.type === 'goal_judged')).toBe(false);
  });

  it('retries when the message text matches a network-timeout class', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });

    let calls = 0;
    installJudge(session, async () => {
      calls += 1;
      throw new Error('connect ECONNRESET 10.0.0.1:443');
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'kick off' });
    await new Promise(resolve => setTimeout(resolve, 1200));

    expect(calls).toBe(2);
    expect(session.getGoal()?.lastFailure?.kind).toBe('timeout');
  });
});

describe('Goal judge — provider-error classification (no retry)', () => {
  it('classifies a generic Error as provider_error and pauses without retry', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });

    let calls = 0;
    installJudge(session, async () => {
      calls += 1;
      throw new Error('unexpected status 500');
    });
    const events = recordEvents(session, ['goal_paused']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'kick off' });
    await new Promise(resolve => setImmediate(resolve));

    expect(calls).toBe(1);
    expect(session.getGoal()?.status).toBe('paused');
    const paused = events.find(e => e.type === 'goal_paused') as { reason: string } | undefined;
    expect(paused?.reason).toBe('judge_provider_error');
    expect(session.getGoal()?.lastFailure?.kind).toBe('provider_error');
    expect(session.getGoal()?.lastFailure?.message).toContain('unexpected status 500');
  });
});

describe('Goal judge — invalid-verdict classification (no retry, never continues)', () => {
  it('pauses with reason "judge_invalid_verdict" and never enqueues a continuation', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });

    let calls = 0;
    installJudge(session, async () => {
      calls += 1;
      // Simulate the schema-validation path: the schema would throw this
      // for a malformed `full.object`. The hook short-circuits the
      // schema-parsing call (which fires only when the hook is absent),
      // so we replicate its terminal error directly.
      throw new HarnessGoalJudgeFailedError('invalid_verdict', 'malformed verdict shape');
    });
    const events = recordEvents(session, ['goal_paused', 'goal_judged']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'kick off' });
    await new Promise(resolve => setImmediate(resolve));

    expect(calls).toBe(1);
    expect(session.getGoal()?.status).toBe('paused');
    const paused = events.find(e => e.type === 'goal_paused') as { reason: string } | undefined;
    expect(paused?.reason).toBe('judge_invalid_verdict');
    expect(session.getGoal()?.lastFailure?.kind).toBe('invalid_verdict');
    // The regression guard from the requirements: invalid verdict must
    // NEVER fall through as `'continue'` — no continuation in the queue.
    expect(session.getRecord().pendingQueue ?? []).toEqual([]);
    expect(events.some(e => e.type === 'goal_judged')).toBe(false);
  });
});

describe('Goal judge — max_turns classification', () => {
  it('stamps lastFailure.kind = "max_turns" when the budget is exhausted', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', maxTurns: 1, kickoff: false });

    installJudge(session, async () => ({ decision: 'continue', reason: 'keep going' }));
    const events = recordEvents(session, ['goal_paused']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'kick off' });
    await new Promise(resolve => setImmediate(resolve));

    expect(session.getGoal()?.status).toBe('paused');
    const paused = events.find(e => e.type === 'goal_paused') as { reason: string } | undefined;
    expect(paused?.reason).toBe('budget_exhausted');
    expect(session.getGoal()?.lastFailure?.kind).toBe('max_turns');
  });
});

describe('Goal judge — lastFailure clearing on successful resume', () => {
  it('clears a prior lastFailure on the next successful judge verdict', async () => {
    // Regression: a pause-then-resume-then-success cycle previously left
    // `lastFailure` attached to the goal, misleading callers that inspect
    // recovered state. A successful judge tick must clear it.
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });

    let phase: 'fail' | 'succeed' = 'fail';
    installJudge(session, async () => {
      if (phase === 'fail') throw new Error('boom');
      return { decision: 'continue', reason: 'keep going' };
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });
    await session.message({ content: 'kick off' });
    await new Promise(resolve => setImmediate(resolve));

    expect(session.getGoal()?.status).toBe('paused');
    expect(session.getGoal()?.lastFailure?.kind).toBe('provider_error');

    // Flip the judge to success and resume.
    phase = 'succeed';
    await session.resumeGoal();
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 2' });
    await session.message({ content: 'try again' });
    await new Promise(resolve => setImmediate(resolve));

    expect(session.getGoal()?.lastFailure).toBeUndefined();
  });
});

describe('Goal judge — happy paths (no regression)', () => {
  it('still emits goal_done when the judge returns decision: "done"', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    installJudge(session, async () => ({ decision: 'done', reason: 'looks done' }));
    const events = recordEvents(session, ['goal_done', 'goal_paused']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });
    await session.message({ content: 'kick off' });
    await new Promise(resolve => setImmediate(resolve));
    expect(events.some(e => e.type === 'goal_done')).toBe(true);
    expect(events.some(e => e.type === 'goal_paused')).toBe(false);
  });

  it('still no-ops on decision: "waiting"', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    installJudge(session, async () => ({ decision: 'waiting', reason: 'need input' }));
    const events = recordEvents(session, ['goal_paused', 'goal_done']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });
    await session.message({ content: 'kick off' });
    await new Promise(resolve => setImmediate(resolve));
    expect(session.getGoal()?.status).toBe('active');
    expect(events).toEqual([]);
  });
});
