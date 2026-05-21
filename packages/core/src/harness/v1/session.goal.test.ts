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
import type { MastraModelOutput } from '../../stream/base/output';
import { HarnessValidationError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';
import type { Session } from './session';

interface FakeRun {
  text?: string;
  runId?: string;
  finishReason?: 'stop' | 'suspended';
  holdUntil?: Promise<void>;
}

class FakeAgent extends Agent<any, any, any> {
  streamCalls: Array<{ messages: unknown; options: any }> = [];
  runs: FakeRun[] = [];

  constructor(id = 'default') {
    super({ id, name: id, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  enqueueRun(run: FakeRun): void {
    this.runs.push(run);
  }

  async stream(messages: unknown, options?: any): Promise<MastraModelOutput> {
    this.streamCalls.push({ messages, options });
    const run = this.runs.shift() ?? {};
    const output = buildOutput({
      ...run,
      runId: run.runId ?? options?.runId ?? `fake-run-${this.streamCalls.length}`,
    });
    this._internalRegisterStreamRun(output, (options ?? {}) as any);
    return output;
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

function installJudge(
  session: Session,
  fn: (goal: GoalState) => Promise<{ decision: 'done' | 'continue' | 'waiting'; reason: string }>,
): void {
  session.__testJudge = fn;
}

function extractSignalContents(messages: unknown): unknown {
  if (!messages || typeof messages !== 'object') return undefined;
  return (messages as { contents?: unknown }).contents;
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

describe('Session goal judge loop', () => {
  it('emits goal_judged and goal_done when the judge returns done', async () => {
    const { harness, agent } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    installJudge(session, async () => ({ decision: 'done', reason: 'finished' }));
    const events = record(session, ['goal_judged', 'goal_done', 'goal_paused']);
    agent.enqueueRun({ finishReason: 'stop', text: 'all done' });

    await session.message({ content: 'do work' });

    const judged = events.find(event => event.type === 'goal_judged') as { decision: { decision: string } } | undefined;
    const done = events.find(event => event.type === 'goal_done');
    expect(judged?.decision.decision).toBe('done');
    expect(done).toBeDefined();
    expect(session.getGoal()?.status).toBe('done');
    expect(session.getGoal()?.turnsUsed).toBe(1);
  });

  it('does not advance turnsUsed when the judge returns waiting', async () => {
    const { harness, agent } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    installJudge(session, async () => ({ decision: 'waiting', reason: 'awaiting user' }));
    agent.enqueueRun({ finishReason: 'stop', text: 'ask user' });

    await session.message({ content: 'do work' });

    expect(session.getGoal()?.status).toBe('active');
    expect(session.getGoal()?.turnsUsed).toBe(0);
  });

  it('enqueues a continuation when the judge returns continue and skips re-judging on it', async () => {
    const { harness, agent } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
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
    await waitFor(() => agent.streamCalls.length >= 2);
    await session.waitForIdle({ timeoutMs: 1000 });

    expect(judgeCalls).toBe(1);
    expect(session.getGoal()?.turnsUsed).toBe(1);
    expect(extractSignalContents(agent.streamCalls[1]!.messages)).toMatch(/<system-reminder type="goal-judge">/);
  });

  it('pauses with reason budget_exhausted when turnsUsed reaches maxTurns', async () => {
    const { harness, agent } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', maxTurns: 1, kickoff: false });
    installJudge(session, async () => ({ decision: 'continue', reason: 'keep going' }));
    const events = record(session, ['goal_paused']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'kick off' });

    expect(session.getGoal()?.status).toBe('paused');
    expect((events[0] as { reason: string }).reason).toBe('budget_exhausted');
    expect(session.getRecord().pendingQueue).toEqual([]);
  });

  it('pauses with reason judge_failed when the judge throws', async () => {
    const { harness, agent } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'go', kickoff: false });
    installJudge(session, async () => {
      throw new Error('boom');
    });
    const events = record(session, ['goal_paused', 'goal_judged']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'kick off' });

    expect(session.getGoal()?.status).toBe('paused');
    const paused = events.find(event => event.type === 'goal_paused') as { reason: string } | undefined;
    expect(paused?.reason).toBe('judge_failed');
    expect(events.some(event => event.type === 'goal_judged')).toBe(false);
  });

  it('discards verdicts for a goal that was cleared mid-judge', async () => {
    const { harness, agent } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'first', kickoff: false });
    installJudge(session, async () => {
      await session.clearGoal();
      return { decision: 'done', reason: 'stale' };
    });
    const events = record(session, ['goal_judged', 'goal_done']);
    agent.enqueueRun({ finishReason: 'stop', text: 'turn 1' });

    await session.message({ content: 'go' });

    expect(events).toEqual([]);
    expect(session.getGoal()).toBeUndefined();
  });

  it('uses the no-assistant-message fallback without calling the judge', async () => {
    const { harness, agent } = setup({ goals: { defaultJudgeModel: 'judge:test' } });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.setGoal({ objective: 'ship X', maxTurns: 5, kickoff: false });
    let judgeCalls = 0;
    installJudge(session, async () => {
      judgeCalls++;
      return { decision: 'continue', reason: 'unused' };
    });
    agent.enqueueRun({ finishReason: 'stop', text: '' });
    agent.enqueueRun({ finishReason: 'stop', text: 'follow-up' });

    await session.message({ content: 'go' });
    await waitFor(() => agent.streamCalls.length >= 2);

    expect(judgeCalls).toBe(0);
    expect(extractSignalContents(agent.streamCalls[1]!.messages)).toBe(
      '<system-reminder type="goal-judge">[Goal attempt 0/5] The goal is not yet complete. Judge feedback: No response yet, keep working.\n\nContinue working toward the goal: ship X</system-reminder>',
    );
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

async function waitFor(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('condition was not met before timeout');
}

function buildOutput(run: FakeRun): MastraModelOutput {
  const fullOutput = {
    text: run.text ?? 'ok',
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    finishReason: run.finishReason ?? 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'response-1', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: run.runId ?? 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };
  let finished!: () => void;
  const finishedPromise = new Promise<void>(resolve => {
    finished = resolve;
  });
  const fullStream = (async function* () {
    if (run.holdUntil) await run.holdUntil;
    finished();
  })();
  return {
    runId: fullOutput.runId,
    getFullOutput: async () => {
      if (run.holdUntil) await run.holdUntil;
      return fullOutput;
    },
    fullStream,
    text: Promise.resolve(fullOutput.text),
    finishReason: Promise.resolve(fullOutput.finishReason),
    usage: Promise.resolve(fullOutput.usage),
    _waitUntilFinished: () => finishedPromise,
  } as unknown as MastraModelOutput;
}

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
