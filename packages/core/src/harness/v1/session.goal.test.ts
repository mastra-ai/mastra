/**
 * Harness v1 — Session goals (§4.7).
 *
 * Covers:
 *   - setGoal / getGoal / pauseGoal / resumeGoal / clearGoal lifecycle
 *   - judge verdict dispatch: done / continue / waiting
 *   - budget exhaustion (turnsUsed >= maxTurns) → paused('budget_exhausted')
 *   - judge failure → paused('judge_failed')
 *   - stale-goal cancellation (verdict for an obsolete goal is discarded)
 *   - subagent sessions reject setGoal
 *   - goal-driven continuations are skipped by the judge (no infinite loop)
 *   - emitted events: goal_set / goal_judged / goal_done / goal_paused /
 *     goal_resumed / goal_cleared
 */

import { describe, expect, it } from 'vitest';

import type { GoalState } from '../../storage/domains/harness';

import { setupHarness } from './__test-utils__';
import { HarnessValidationError } from './errors';
import type { HarnessEvent } from './events';
import type { Session } from './session';

function installJudge(
  session: Session,
  fn: (goal: GoalState) => Promise<{ decision: 'done' | 'continue' | 'waiting'; reason: string }>,
): void {
  (session as unknown as { __testJudge: typeof fn }).__testJudge = fn;
}

function record(session: Session, types?: HarnessEvent['type'][]): HarnessEvent[] {
  const events: HarnessEvent[] = [];
  session.subscribe(e => {
    if (!types || types.includes(e.type)) events.push(e);
  });
  return events;
}

describe('Session.setGoal — admission', () => {
  it('persists a goal, emits goal_set, and returns the active state', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const events = record(session, ['goal_set', 'goal_cleared']);

    const goal = await session.setGoal({ objective: 'ship the thing', kickoff: false });

    expect(goal.objective).toBe('ship the thing');
    expect(goal.status).toBe('active');
    expect(goal.turnsUsed).toBe(0);
    expect(goal.maxTurns).toBe(50);
    expect(goal.judgeModelId).toBe('judge:test');
    expect(session.getGoal()?.id).toBe(goal.id);
    expect(session.getRecord().goal?.id).toBe(goal.id);
    expect(events.map(e => e.type)).toEqual(['goal_set']);
  });

  it('emits goal_cleared for the prior goal before goal_set when replaced', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const first = await session.setGoal({ objective: 'first goal', kickoff: false });
    const events = record(session, ['goal_set', 'goal_cleared']);
    const second = await session.setGoal({ objective: 'second goal', kickoff: false });

    expect(events.map(e => e.type)).toEqual(['goal_cleared', 'goal_set']);
    expect((events[0] as { goalId: string }).goalId).toBe(first.id);
    expect((events[1] as { goal: GoalState }).goal.id).toBe(second.id);
  });

  it('rejects when no judge model is provided and none is configured', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.setGoal({ objective: 'go' })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects empty objectives and non-positive maxTurns', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.setGoal({ objective: '' })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.setGoal({ objective: 'go', maxTurns: 0 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.setGoal({ objective: 'go', maxTurns: -2 })).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('Session.pauseGoal / resumeGoal / clearGoal', () => {
  it('pauseGoal flips status to paused and emits goal_paused(reason: requested)', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    const events = record(session, ['goal_paused']);

    const paused = await session.pauseGoal();

    expect(paused?.status).toBe('paused');
    expect(events).toHaveLength(1);
    expect((events[0] as { reason: string }).reason).toBe('requested');
  });

  it('resumeGoal flips status back to active and emits goal_resumed', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    await session.pauseGoal();
    const events = record(session, ['goal_resumed']);
    // Stage a run so the kickoff continuation can drain without blocking forever.
    agent.enqueueRun({ finishReason: 'stop', text: 'resumed work' });
    installJudge(session, async () => ({ decision: 'waiting', reason: 'no-op' }));

    const resumed = await session.resumeGoal();
    // Give the auto-drained continuation a chance to run.
    await new Promise(resolve => setImmediate(resolve));

    expect(resumed?.status).toBe('active');
    expect(events).toHaveLength(1);
  });

  it('clearGoal removes the goal and emits goal_cleared', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const goal = await session.setGoal({ objective: 'go', kickoff: false });
    const events = record(session, ['goal_cleared']);

    await session.clearGoal();

    expect(session.getGoal()).toBeUndefined();
    expect(session.getRecord().goal).toBeUndefined();
    expect(events).toHaveLength(1);
    expect((events[0] as { goalId: string }).goalId).toBe(goal.id);
  });
});

describe('Session goal — subagent rejection', () => {
  it('throws when setGoal is called on a subagent session', async () => {
    const { harness } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const parent = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const child = await harness.session({
      resourceId: 'u',
      threadId: { fresh: true },
      parentSessionId: parent.id,
      origin: 'subagent-tool',
    });

    await expect(child.setGoal({ objective: 'sub' })).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('Session goal — judge loop', () => {
  it('emits goal_judged + goal_done when the judge returns done', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    installJudge(session, async () => ({ decision: 'done', reason: 'finished' }));
    const events = record(session, ['goal_judged', 'goal_done', 'goal_paused']);
    agent.enqueueRun({ finishReason: 'stop', text: 'all done' });

    await session.message({ content: 'do work' });
    await new Promise(resolve => setImmediate(resolve));

    const judged = events.find(e => e.type === 'goal_judged') as { decision: { decision: string } } | undefined;
    const done = events.find(e => e.type === 'goal_done');
    expect(judged?.decision.decision).toBe('done');
    expect(done).toBeDefined();
    expect(session.getGoal()?.status).toBe('done');
    expect(session.getGoal()?.turnsUsed).toBe(1);
  });

  it('does not advance turnsUsed when the judge returns waiting', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    installJudge(session, async () => ({ decision: 'waiting', reason: 'awaiting user' }));
    agent.enqueueRun({ finishReason: 'stop', text: 'ask user' });

    await session.message({ content: 'do work' });
    await new Promise(resolve => setImmediate(resolve));

    expect(session.getGoal()?.status).toBe('active');
    expect(session.getGoal()?.turnsUsed).toBe(0);
  });

  it('enqueues a continuation when the judge returns continue and skips re-judging on it', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    let judgeCalls = 0;
    installJudge(session, async () => {
      judgeCalls++;
      return { decision: 'continue', reason: 'keep going' };
    });
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 2 (continuation)' });

    await session.message({ content: 'kick off' });
    // Let the continuation drain.
    await new Promise(resolve => setTimeout(resolve, 20));

    // Judge ran exactly once: after the user turn. The continuation
    // (source: 'goal') must NOT trigger another judge call.
    expect(judgeCalls).toBe(1);
    expect(session.getGoal()?.turnsUsed).toBe(1);
    expect(agent.streamCalls).toHaveLength(2);
    // Continuation wrapped in system-reminder envelope:
    expect(agent.streamCalls[1]!.messages).toMatch(/<system-reminder type="goal-judge">/);
  });

  it('pauses with reason "budget_exhausted" when turnsUsed reaches maxTurns', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', maxTurns: 1, kickoff: false });
    installJudge(session, async () => ({ decision: 'continue', reason: 'keep going' }));
    const events = record(session, ['goal_paused']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'kick off' });
    await new Promise(resolve => setImmediate(resolve));

    expect(session.getGoal()?.status).toBe('paused');
    expect((events[0] as { reason: string }).reason).toBe('budget_exhausted');
    // Continuation must NOT have been enqueued.
    expect(session.getRecord().pendingQueue ?? []).toEqual([]);
  });

  it('pauses with reason "judge_failed" when the judge throws', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    installJudge(session, async () => {
      throw new Error('boom');
    });
    const events = record(session, ['goal_paused', 'goal_judged']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'kick off' });
    await new Promise(resolve => setImmediate(resolve));

    expect(session.getGoal()?.status).toBe('paused');
    const paused = events.find(e => e.type === 'goal_paused') as { reason: string } | undefined;
    expect(paused?.reason).toBe('judge_failed');
    // No verdict emitted when judge failed.
    expect(events.some(e => e.type === 'goal_judged')).toBe(false);
  });

  it('discards verdicts for a goal that was replaced mid-judge (stale-goal cancellation)', async () => {
    const { harness, agent } = setupHarness({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const firstGoal = await session.setGoal({ objective: 'first', kickoff: false });

    installJudge(session, async () => {
      // Swap the goal mid-judge so the verdict is for the obsolete one.
      await session.clearGoal();
      return { decision: 'done', reason: 'stale' };
    });
    const events = record(session, ['goal_judged', 'goal_done']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'go' });
    await new Promise(resolve => setImmediate(resolve));

    // Verdict for the stale goal must be discarded entirely.
    expect(events).toEqual([]);
    expect(session.getGoal()).toBeUndefined();
    // The first goal is no longer present after clearGoal().
    expect(session.getRecord().goal).toBeUndefined();
    expect(firstGoal.id).toBeTruthy();
  });
});
