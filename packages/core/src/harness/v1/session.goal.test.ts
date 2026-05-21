/**
 * Harness v1 Session goals, adapted from the fork's goal lifecycle coverage.
 *
 * This slice covers durable goal state and goal-owned queue continuations.
 * The judge loop is intentionally left for a later stacked PR.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import type { GoalState } from '../../storage/domains/harness';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { HarnessValidationError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';
import type { Session } from './session';

class FakeAgent extends Agent<any, any, any> {
  constructor(id = 'default') {
    super({ id, name: id, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }
}

function setup(opts?: { goals?: { defaultJudgeModel?: string; defaultMaxTurns?: number } }) {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
    ...(opts?.goals ? { goals: opts.goals } : {}),
  });
  return { harness, agent, storage };
}

function record(session: Session, types?: HarnessEvent['type'][]): HarnessEvent[] {
  const events: HarnessEvent[] = [];
  session.subscribe(event => {
    if (!types || types.includes(event.type)) events.push(event);
  });
  return events;
}

describe('Session.setGoal()', () => {
  it('persists a goal, emits goal_set, and returns the active state', async () => {
    const { harness, storage } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
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
    await expect(storage.loadSession({ sessionId: session.id })).resolves.toMatchObject({
      goal: { id: goal.id, objective: 'ship the thing' },
    });
    expect(events.map(event => event.type)).toEqual(['goal_set']);
  });

  it('emits goal_cleared for the prior goal before goal_set when replaced', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const first = await session.setGoal({ objective: 'first goal', kickoff: false });
    const events = record(session, ['goal_set', 'goal_cleared']);
    const second = await session.setGoal({ objective: 'second goal', kickoff: false });

    expect(events.map(event => event.type)).toEqual(['goal_cleared', 'goal_set']);
    expect((events[0] as { goalId: string }).goalId).toBe(first.id);
    expect((events[1] as { goal: GoalState }).goal.id).toBe(second.id);
  });

  it('rejects when no judge model is provided and none is configured', async () => {
    const { harness } = setup();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.setGoal({ objective: 'go' })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('rejects empty objectives and non-positive maxTurns', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await expect(session.setGoal({ objective: '' })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.setGoal({ objective: 'go', maxTurns: 0 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.setGoal({ objective: 'go', maxTurns: -2 })).rejects.toBeInstanceOf(HarnessValidationError);
  });
});

describe('Session goal lifecycle', () => {
  it('pauseGoal flips status to paused and emits goal_paused(reason: requested)', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    const events = record(session, ['goal_paused']);

    const paused = await session.pauseGoal();

    expect(paused?.status).toBe('paused');
    expect(events).toHaveLength(1);
    expect((events[0] as { reason: string }).reason).toBe('requested');
  });

  it('resumeGoal flips status back to active, emits goal_resumed, and queues a continuation', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'ship the thing', kickoff: false });
    await session.pauseGoal();
    const events = record(session, ['goal_resumed']);

    const resumed = await session.resumeGoal();

    expect(resumed?.status).toBe('active');
    expect(events).toHaveLength(1);
    expect(session.getRecord().pendingQueue).toHaveLength(1);
    expect(session.getRecord().pendingQueue[0]).toMatchObject({
      content: 'Continue working toward the goal: ship the thing',
      source: 'goal',
      goalId: resumed?.id,
    });
  });

  it('clearGoal removes the goal and emits goal_cleared', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const goal = await session.setGoal({ objective: 'go', kickoff: false });
    const events = record(session, ['goal_cleared']);

    await session.clearGoal();

    expect(session.getGoal()).toBeUndefined();
    expect(session.getRecord().goal).toBeUndefined();
    expect(events).toHaveLength(1);
    expect((events[0] as { goalId: string }).goalId).toBe(goal.id);
  });

  it('throws when setGoal is called on a subagent session', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
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

describe('Session goal continuation wording', () => {
  it('setGoal kickoff wraps the objective in <system-reminder type="goal">', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.setGoal({ objective: 'ship the thing' });

    const queued = session.getRecord().pendingQueue;
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      content: '<system-reminder type="goal">ship the thing</system-reminder>',
      source: 'goal',
      goalId: session.getGoal()?.id,
    });
  });

  it('setGoal kickoff escapes XML special characters in the objective', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    await session.setGoal({ objective: 'fix <bug> & ship it' });

    expect(session.getRecord().pendingQueue[0]!.content).toBe(
      '<system-reminder type="goal">fix &lt;bug&gt; &amp; ship it</system-reminder>',
    );
  });
});

describe('Session.updateJudgeDefaults()', () => {
  it('updates judge model on the in-flight goal without resetting turnsUsed', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const goal = await session.setGoal({ objective: 'go', kickoff: false });
    (session as unknown as { record: { goal?: GoalState } }).record.goal = { ...goal, turnsUsed: 3 };

    const updated = await session.updateJudgeDefaults({ judgeModelId: 'judge:new' });

    expect(updated?.judgeModelId).toBe('judge:new');
    expect(updated?.turnsUsed).toBe(3);
    expect(session.getRecord().goal?.judgeModelId).toBe('judge:new');
  });

  it('updates maxTurns without changing other fields', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', maxTurns: 10, kickoff: false });

    const updated = await session.updateJudgeDefaults({ maxTurns: 25 });

    expect(updated?.maxTurns).toBe(25);
    expect(updated?.objective).toBe('go');
  });

  it('rejects non-positive maxTurns', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });

    await expect(session.updateJudgeDefaults({ maxTurns: 0 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.updateJudgeDefaults({ maxTurns: -5 })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('returns undefined when no goal is set', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });

    const result = await session.updateJudgeDefaults({ judgeModelId: 'judge:other' });

    expect(result).toBeUndefined();
  });

  it('does not emit goal_paused or goal_resumed', async () => {
    const { harness } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    const events = record(session);
    events.length = 0;

    await session.updateJudgeDefaults({ judgeModelId: 'judge:new', maxTurns: 99 });

    expect(events.find(event => event.type === 'goal_paused' || event.type === 'goal_resumed')).toBeUndefined();
  });
});
