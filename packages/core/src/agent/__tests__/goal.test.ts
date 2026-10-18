import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { DEFAULT_GOAL_JUDGE_PROMPT, DEFAULT_GOAL_MAX_RUNS, resolveEffectiveGoalSettings } from '../goal';
import { resolveGoalStore, writeObjective } from '../goal/objective';
import { Agent } from '../index';
import type { GoalConfig } from '../types';

const RESOURCE = 'resource-1';
const THREAD = 'thread-1';

// A model that always answers in a single step (so the loop reaches a candidate
// final answer and the goal step scores it).
function singleStepModel(text = 'Working on it.', delayMs = 0) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
      if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

function makeAgent(goal?: GoalConfig, model = singleStepModel()) {
  const agent = new Agent({
    id: 'goal-agent',
    name: 'goal-agent',
    instructions: 'You work toward goals.',
    model,
    memory: new MockMemory(),
    ...(goal ? { goal } : {}),
  });
  new Mastra({ agents: { 'goal-agent': agent }, storage: new InMemoryStore(), logger: false });
  return agent;
}

describe('resolveEffectiveGoalSettings', () => {
  it('falls back to agent config then built-in defaults', () => {
    expect(resolveEffectiveGoalSettings(undefined, undefined)).toEqual({
      judgeModelId: undefined,
      maxRuns: DEFAULT_GOAL_MAX_RUNS,
      prompt: DEFAULT_GOAL_JUDGE_PROMPT,
      maxSteps: undefined,
    });

    expect(
      resolveEffectiveGoalSettings(undefined, {
        judgeModelId: 'agent-judge',
        maxRuns: 10,
        prompt: 'agent-prompt',
        maxSteps: 20,
      }),
    ).toEqual({
      judgeModelId: 'agent-judge',
      maxRuns: 10,
      prompt: 'agent-prompt',
      maxSteps: 20,
    });
  });

  it('lets the ThreadState record override agent config', () => {
    const record = {
      objective: 'x',
      status: 'active' as const,
      runsUsed: 0,
      judgeModelId: 'record-judge',
      maxRuns: 3,
      prompt: 'record-prompt',
      startedAt: 0,
      updatedAt: 0,
    };
    expect(resolveEffectiveGoalSettings(record, { judgeModelId: 'agent-judge', maxRuns: 99 })).toEqual({
      judgeModelId: 'record-judge',
      maxRuns: 3,
      prompt: 'record-prompt',
      maxSteps: undefined,
    });
  });

  it('falls back per-field when the record omits a value', () => {
    const record = { objective: 'x', status: 'active' as const, runsUsed: 0, startedAt: 0, updatedAt: 0 };
    expect(resolveEffectiveGoalSettings(record, { judgeModelId: 'agent-judge', maxRuns: 7 })).toEqual({
      judgeModelId: 'agent-judge',
      maxRuns: 7,
      prompt: DEFAULT_GOAL_JUDGE_PROMPT,
      maxSteps: undefined,
    });
  });
});

describe('Agent objective methods', () => {
  it('set / get / clear round-trip via thread state', async () => {
    const agent = makeAgent();

    expect(await agent.getObjective({ threadId: THREAD })).toBeUndefined();

    await agent.setObjective('Ship the feature', {
      id: 'goal-1',
      threadId: THREAD,
      resourceId: RESOURCE,
      judgeModelId: 'judge-1',
      maxRuns: 5,
    });
    const record = await agent.getObjective({ threadId: THREAD });
    expect(record).toMatchObject({
      id: 'goal-1',
      objective: 'Ship the feature',
      status: 'active',
      runsUsed: 0,
      judgeModelId: 'judge-1',
      maxRuns: 5,
      activeDurationMs: 0,
    });
    // Unprovided optional fields are left unset so they fall back to agent config.
    expect(record?.prompt).toBeUndefined();

    await agent.clearObjective({ threadId: THREAD });
    expect(await agent.getObjective({ threadId: THREAD })).toBeUndefined();
  });

  it('updateObjectiveOptions persists provided values and no-ops without an objective', async () => {
    const agent = makeAgent();

    expect(await agent.updateObjectiveOptions({ threadId: THREAD, judgeModelId: 'j' })).toBeUndefined();

    const created = await agent.setObjective('Goal', {
      threadId: THREAD,
      resourceId: RESOURCE,
      activeDurationMs: 2_500,
    });
    expect(created?.activeDurationMs).toBe(2_500);
    const updated = await agent.updateObjectiveOptions({
      threadId: THREAD,
      judgeModelId: 'new-judge',
      maxRuns: 12,
    });
    expect(updated).toMatchObject({
      judgeModelId: 'new-judge',
      maxRuns: 12,
      objective: 'Goal',
      activeDurationMs: 2_500,
    });

    const preserved = await agent.updateObjectiveOptions({ threadId: THREAD, prompt: 'Keep going.' });
    expect(preserved).toMatchObject({ activeDurationMs: 2_500, prompt: 'Keep going.' });
  });

  it('updateObjectiveOptions persists the pause cause and clears it when the goal leaves paused', async () => {
    const agent = makeAgent();
    await agent.setObjective('Goal', { threadId: THREAD, resourceId: RESOURCE });

    const paused = await agent.updateObjectiveOptions({
      threadId: THREAD,
      status: 'paused',
      pausedReason: 'The goal judge failed to evaluate the objective.',
    });
    expect(paused).toMatchObject({
      status: 'paused',
      pausedReason: 'The goal judge failed to evaluate the objective.',
    });
    expect(await agent.getObjective({ threadId: THREAD })).toMatchObject({
      pausedReason: 'The goal judge failed to evaluate the objective.',
    });

    const resumed = await agent.updateObjectiveOptions({ threadId: THREAD, status: 'active' });
    expect(resumed?.pausedReason).toBeUndefined();
    expect((await agent.getObjective({ threadId: THREAD }))?.pausedReason).toBeUndefined();

    // A reason supplied alongside a non-paused status is retired too: the
    // resulting status decides, not the caller's arguments.
    const done = await agent.updateObjectiveOptions({
      threadId: THREAD,
      status: 'done',
      pausedReason: 'stale reason',
    });
    expect(done).toMatchObject({ status: 'done' });
    expect(done?.pausedReason).toBeUndefined();
  });

  it('updateObjectiveOptions keeps the pause cause when an already-paused goal is paused again without one', async () => {
    const agent = makeAgent();
    await agent.setObjective('Goal', { threadId: THREAD, resourceId: RESOURCE });

    await agent.updateObjectiveOptions({
      threadId: THREAD,
      status: 'paused',
      pausedReason: 'The goal judge failed to evaluate the objective.',
    });

    // An idempotent re-pause (the agent goal route forwards a status and never
    // a reason) changes nothing, so it must not erase why the goal paused.
    const repaused = await agent.updateObjectiveOptions({ threadId: THREAD, status: 'paused' });
    expect(repaused?.status).toBe('paused');
    expect(repaused?.pausedReason).toBe('The goal judge failed to evaluate the objective.');
    expect((await agent.getObjective({ threadId: THREAD }))?.pausedReason).toBe(
      'The goal judge failed to evaluate the objective.',
    );
  });

  it('updateObjectiveOptions drops a stale pause cause when an active record is paused without one', async () => {
    const agent = new Agent({
      id: 'goal-agent',
      name: 'goal-agent',
      instructions: 'You work toward goals.',
      model: singleStepModel(),
      memory: new MockMemory(),
    });
    const mastra = new Mastra({ agents: { 'goal-agent': agent }, storage: new InMemoryStore(), logger: false });
    const created = await agent.setObjective('Goal', { threadId: THREAD, resourceId: RESOURCE });

    // Records written before pause causes were retired on resume can be active
    // while still carrying the old cause.
    const store = await resolveGoalStore(mastra);
    await writeObjective(store, THREAD, { ...created!, status: 'active', pausedReason: 'stale reason' });

    const paused = await agent.updateObjectiveOptions({ threadId: THREAD, status: 'paused' });
    expect(paused?.status).toBe('paused');
    expect(paused?.pausedReason).toBeUndefined();
  });

  it('updateObjectiveOptions keeps the pause cause when an update carries no status', async () => {
    const agent = makeAgent();
    await agent.setObjective('Goal', { threadId: THREAD, resourceId: RESOURCE });
    await agent.updateObjectiveOptions({
      threadId: THREAD,
      status: 'paused',
      pausedReason: 'The goal judge failed to evaluate the objective.',
    });

    // Only an explicit pause is authoritative about its own cause. A settings
    // update that says nothing about status must not silently retire it.
    const updated = await agent.updateObjectiveOptions({ threadId: THREAD, maxRuns: 9 });
    expect(updated?.maxRuns).toBe(9);
    expect(updated?.status).toBe('paused');
    expect(updated?.pausedReason).toBe('The goal judge failed to evaluate the objective.');

    const reloaded = await agent.getObjective({ threadId: THREAD });
    expect(reloaded?.pausedReason).toBe('The goal judge failed to evaluate the objective.');
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'normalizes invalid initial active duration %s to zero',
    async invalidDuration => {
      const agent = makeAgent();

      const created = await agent.setObjective('Goal', {
        threadId: THREAD,
        resourceId: RESOURCE,
        activeDurationMs: invalidDuration,
      });
      expect(created?.activeDurationMs).toBe(0);
      expect((await agent.getObjective({ threadId: THREAD }))?.activeDurationMs).toBe(0);
    },
  );

  it('checkpoints active duration when a raw Agent stream completes', async () => {
    const agent = makeAgent({}, singleStepModel('Finished.', 20));
    await agent.setObjective('Finish the task', { threadId: THREAD, resourceId: RESOURCE });

    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 1,
    });
    for await (const _chunk of stream.fullStream) {
      // Drain the stream through its terminal lifecycle boundary.
    }

    expect((await agent.getObjective({ threadId: THREAD }))?.activeDurationMs).toBeGreaterThan(0);
  });

  it('no-ops without storage', async () => {
    const agent = new Agent({
      id: 'no-storage-agent',
      name: 'no-storage-agent',
      instructions: 'x',
      model: singleStepModel(),
      memory: new MockMemory(),
      goal: {},
    });
    // No Mastra/storage registered.
    expect(await agent.setObjective('x', { threadId: THREAD })).toBeUndefined();
    expect(await agent.getObjective({ threadId: THREAD })).toBeUndefined();
  });
});
