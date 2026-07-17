import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { DEFAULT_GOAL_JUDGE_PROMPT, DEFAULT_GOAL_MAX_RUNS, resolveEffectiveGoalSettings } from '../goal';
import { Agent } from '../index';
import type { GoalConfig } from '../types';

const RESOURCE = 'resource-1';
const THREAD = 'thread-1';

// A model that always answers in a single step (so the loop reaches a candidate
// final answer and the goal step scores it).
function singleStepModel(text = 'Working on it.') {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call++;
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

function goalJudgeModel(
  decisions: Array<{ decision: 'done' | 'continue' | 'waiting'; reason: string }>,
  spyStream?: (props: any) => void,
) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async props => {
      spyStream?.(props);
      const decision = decisions[Math.min(call, decisions.length - 1)];
      call++;
      const text = JSON.stringify(decision);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `judge-${call}`, modelId: 'mock-judge-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

function makeAgent(goal?: GoalConfig) {
  const agent = new Agent({
    id: 'goal-agent',
    name: 'goal-agent',
    instructions: 'You work toward goals.',
    model: singleStepModel(),
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
    });
    // Unprovided optional fields are left unset so they fall back to agent config.
    expect(record?.prompt).toBeUndefined();

    await agent.clearObjective({ threadId: THREAD });
    expect(await agent.getObjective({ threadId: THREAD })).toBeUndefined();
  });

  it('updateObjectiveOptions persists provided values and no-ops without an objective', async () => {
    const agent = makeAgent();

    expect(await agent.updateObjectiveOptions({ threadId: THREAD, judgeModelId: 'j' })).toBeUndefined();

    await agent.setObjective('Goal', { threadId: THREAD, resourceId: RESOURCE });
    const updated = await agent.updateObjectiveOptions({
      threadId: THREAD,
      judgeModelId: 'new-judge',
      maxRuns: 12,
    });
    expect(updated).toMatchObject({
      judgeModelId: 'new-judge',
      maxRuns: 12,
      objective: 'Goal',
    });
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

describe('in-loop goal scoring', () => {
  function passingScorer(score = 1, reason = 'done') {
    return { id: 'goal-test-scorer', name: 'Goal Test Scorer', run: vi.fn().mockResolvedValue({ score, reason }) };
  }

  it('does nothing when an objective is set but no judge model resolves', async () => {
    // goal config present (so the loop step is wired) but no judge anywhere.
    const agent = makeAgent({ scorer: passingScorer() as any });
    await agent.setObjective('Reach the goal', { threadId: THREAD, resourceId: RESOURCE });

    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 3,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    expect(goalChunks).toHaveLength(0);
    // runsUsed never incremented.
    expect((await agent.getObjective({ threadId: THREAD }))?.runsUsed).toBe(0);
  });

  it('scores and completes the goal when a judge model + scorer resolve', async () => {
    const scorer = passingScorer(1, 'Goal achieved');
    const agent = makeAgent({ judge: 'mock-model-id', scorer: scorer as any });
    await agent.setObjective('Reach the goal', { threadId: THREAD, resourceId: RESOURCE });

    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 3,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    // Filter out pending (loading-indicator) chunks for payload assertions.
    const resultChunks = goalChunks.filter(c => !c.payload.pending);

    expect(scorer.run).toHaveBeenCalled();
    expect(resultChunks.length).toBeGreaterThan(0);

    // Lock the public `goal` chunk payload shape (consumed by the TUI + client-js).
    expect(resultChunks[0].type).toBe('goal');
    expect(resultChunks[0].payload).toMatchObject({
      objective: 'Reach the goal',
      iteration: 1,
      maxRuns: DEFAULT_GOAL_MAX_RUNS,
      passed: true,
      status: 'done',
      maxRunsReached: false,
      timedOut: false,
      suppressFeedback: false,
    });
    expect(Array.isArray(resultChunks[0].payload.results)).toBe(true);
    expect(typeof resultChunks[0].payload.duration).toBe('number');

    const record = await agent.getObjective({ threadId: THREAD });
    expect(record?.status).toBe('done');
    expect(record?.runsUsed).toBe(1);
  });

  it('direct agent goal loop completes with built-in scorer without manual continuation', async () => {
    const agent = makeAgent({
      judge: goalJudgeModel([
        { decision: 'continue', reason: 'need one more pass' },
        { decision: 'done', reason: 'goal satisfied' },
      ]) as any,
      maxRuns: 5,
    });
    await agent.setObjective('Reach the goal', { threadId: THREAD, resourceId: RESOURCE });

    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 10,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    const resultChunks = goalChunks.filter(c => !c.payload.pending);
    expect(resultChunks.map(c => c.payload.status)).toEqual(['active', 'done']);
    expect(resultChunks[resultChunks.length - 1].payload).toMatchObject({
      objective: 'Reach the goal',
      iteration: 2,
      passed: true,
      status: 'done',
      maxRunsReached: false,
    });

    const record = await agent.getObjective({ threadId: THREAD });
    expect(record?.status).toBe('done');
    expect(record?.runsUsed).toBe(2);
  });

  it('goal judge activity observation does not block structured-output fallback', async () => {
    const streamCalls: any[] = [];
    const judge = new MockLanguageModelV2({
      doStream: async props => {
        streamCalls.push(props);
        const fallbackText = '{"decision":"done","reason":"stream fallback"}';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: `judge-stream-${streamCalls.length}`,
              modelId: 'mock-judge-id',
              timestamp: new Date(0),
            },
            ...(streamCalls.length > 1
              ? [
                  { type: 'text-start' as const, id: 'text-1' },
                  { type: 'text-delta' as const, id: 'text-1', delta: fallbackText },
                  { type: 'text-end' as const, id: 'text-1' },
                ]
              : []),
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
    const agent = makeAgent({ judge: judge as any, maxRuns: 5 });
    await agent.setObjective('Reach the goal', { threadId: THREAD, resourceId: RESOURCE });

    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 10,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    expect(streamCalls).toHaveLength(2);
    expect(goalChunks.filter(c => !c.payload.pending).at(-1)?.payload).toMatchObject({
      status: 'done',
      reason: 'stream fallback',
    });
  });

  it('direct agent goal loop pauses actionably when built-in scorer returns waiting', async () => {
    const agent = makeAgent({
      judge: goalJudgeModel([{ decision: 'waiting', reason: 'waiting for your review' }]) as any,
      maxRuns: 5,
    });
    await agent.setObjective('Reach the goal', { threadId: THREAD, resourceId: RESOURCE });

    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 10,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    const resultChunks = goalChunks.filter(c => !c.payload.pending);
    expect(resultChunks).toHaveLength(1);
    expect(resultChunks[0].payload).toMatchObject({
      objective: 'Reach the goal',
      iteration: 1,
      passed: false,
      status: 'active',
      waitingForUser: true,
      reason: 'waiting for your review',
    });

    const record = await agent.getObjective({ threadId: THREAD });
    expect(record?.status).toBe('active');
    expect(record?.runsUsed).toBe(1);
  });

  it('goal gate wins over isTaskComplete: an incomplete goal forces continuation past an isTaskComplete pass', async () => {
    // isTaskComplete passes immediately (would normally end the loop), but the
    // goal is never complete, so the goal step (which runs after isTaskComplete)
    // overrides isContinued and keeps the loop running until maxRuns.
    const taskScorer = passingScorer(1, 'task done');
    const goalScorer = passingScorer(0, 'goal not yet');
    const agent = makeAgent({ judge: 'mock-model-id', scorer: goalScorer as any, maxRuns: 2 });
    await agent.setObjective('Keep going', { threadId: THREAD, resourceId: RESOURCE });

    const taskChunks: any[] = [];
    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 10,
      isTaskComplete: { scorers: [taskScorer as any] },
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'is-task-complete') taskChunks.push(chunk);
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    // Filter out pending (loading-indicator) chunks.
    const resultChunks = goalChunks.filter(c => !c.payload.pending);

    // isTaskComplete reported complete...
    expect(taskChunks.some(c => c.payload.passed === true)).toBe(true);
    // ...but the goal gate overrode it and drove the loop to the run budget.
    expect(goalScorer.run).toHaveBeenCalledTimes(2);
    expect(resultChunks).toHaveLength(2);
    expect(resultChunks[resultChunks.length - 1].payload.maxRunsReached).toBe(true);

    const record = await agent.getObjective({ threadId: THREAD });
    expect(record?.runsUsed).toBe(2);
    // Exhausting the budget without completing parks the goal as `paused`.
    expect(record?.status).toBe('paused');
  });

  it('emits no goal chunk when there is no active objective', async () => {
    const agent = makeAgent({ judge: 'mock-model-id', scorer: passingScorer() as any });

    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 2,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }
    expect(goalChunks).toHaveLength(0);
  });

  it('stops at maxRuns when the goal is never complete', async () => {
    const scorer = passingScorer(0, 'Not yet');
    const agent = makeAgent({ judge: 'mock-model-id', scorer: scorer as any, maxRuns: 2 });
    await agent.setObjective('Unreachable goal', { threadId: THREAD, resourceId: RESOURCE });

    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 10,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    // Filter out pending (loading-indicator) chunks.
    const resultChunks = goalChunks.filter(c => !c.payload.pending);
    expect(resultChunks.length).toBe(2);
    const last = resultChunks[resultChunks.length - 1].payload;
    expect(last.maxRunsReached).toBe(true);
    expect(resultChunks.every(c => c.payload.passed === false)).toBe(true);
    // Budget exhaustion parks the goal visibly as `paused` (with a reason)
    // rather than leaving it silently `active`.
    expect(last.status).toBe('paused');
    expect(last.pausedReason).toContain('budget');

    const record = await agent.getObjective({ threadId: THREAD });
    expect(record?.status).toBe('paused');
    expect(record?.pausedReason).toContain('budget');
    expect(record?.runsUsed).toBe(2);
  });

  it('does not re-score a budget-exhausted (now paused) objective on a later run', async () => {
    // An objective that stops at the run budget is parked as `paused`. A
    // subsequent run on the same thread must not burn another judge call or push
    // runsUsed past the budget — a paused goal is gated out before scoring and
    // emits no goal chunk (it is parked, not iterating).
    const scorer = passingScorer(0, 'Not yet');
    const agent = makeAgent({ judge: 'mock-model-id', scorer: scorer as any, maxRuns: 2 });
    await agent.setObjective('Unreachable goal', { threadId: THREAD, resourceId: RESOURCE });

    // First run exhausts the budget (runsUsed → 2, status → paused).
    const firstStream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 10,
    });
    for await (const _ of firstStream.fullStream) {
      void _;
    }
    expect(scorer.run).toHaveBeenCalledTimes(2);
    expect((await agent.getObjective({ threadId: THREAD }))?.status).toBe('paused');
    expect((await agent.getObjective({ threadId: THREAD }))?.runsUsed).toBe(2);

    // Second run on the same thread: a paused goal is gated out before scoring.
    const goalChunks: any[] = [];
    const secondStream = await agent.stream('again', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 10,
    });
    for await (const chunk of secondStream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    // No additional scorer calls, no goal chunk: the paused goal is inert until
    // the user resumes it.
    expect(scorer.run).toHaveBeenCalledTimes(2);
    expect(goalChunks.length).toBe(0);

    const record = await agent.getObjective({ threadId: THREAD });
    expect(record?.runsUsed).toBe(2);
    expect(record?.status).toBe('paused');
  });

  it('resumes a budget-exhausted goal when maxRuns is raised and status is set back to active', async () => {
    // The documented resume path: updateObjectiveOptions raises maxRuns AND
    // flips status back to `active`, which re-admits the goal to the scorer.
    const scorer = passingScorer(0, 'Not yet');
    const agent = makeAgent({ judge: 'mock-model-id', scorer: scorer as any, maxRuns: 1 });
    await agent.setObjective('Unreachable goal', { threadId: THREAD, resourceId: RESOURCE });

    // First run exhausts the (tiny) budget and parks the goal.
    const firstStream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 10,
    });
    for await (const _ of firstStream.fullStream) {
      void _;
    }
    expect(scorer.run).toHaveBeenCalledTimes(1);
    expect((await agent.getObjective({ threadId: THREAD }))?.status).toBe('paused');

    // Resume: raise the budget and reactivate. The stale pause reason is cleared
    // on the next scoring write.
    await agent.updateObjectiveOptions({ threadId: THREAD, maxRuns: 3, status: 'active' });

    const goalChunks: any[] = [];
    const secondStream = await agent.stream('again', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 10,
    });
    for await (const chunk of secondStream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    // The resumed goal re-scores (more scorer calls) and a goal chunk is emitted.
    expect(scorer.run.mock.calls.length).toBeGreaterThan(1);
    expect(goalChunks.length).toBeGreaterThan(0);
    expect((await agent.getObjective({ threadId: THREAD }))?.runsUsed).toBeGreaterThan(1);
  });

  it('invokes a model-resolver function for goal.judge and scores when it resolves a model', async () => {
    const scorer = passingScorer(1, 'done');
    const judge = vi.fn(() => 'mock-model-id');
    const agent = makeAgent({ judge: judge as any, scorer: scorer as any });
    await agent.setObjective('Reach the goal', { threadId: THREAD, resourceId: RESOURCE });

    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 3,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    // Filter out pending (loading-indicator) chunks.
    const resultChunks = goalChunks.filter(c => !c.payload.pending);

    expect(judge).toHaveBeenCalled();
    expect(scorer.run).toHaveBeenCalled();
    expect(resultChunks.length).toBeGreaterThan(0);
    expect(resultChunks[0].payload.passed).toBe(true);
  });

  it('is a no-op when the goal.judge resolver returns undefined', async () => {
    const scorer = passingScorer(1, 'done');
    const judge = vi.fn(() => undefined);
    const agent = makeAgent({ judge: judge as any, scorer: scorer as any });
    await agent.setObjective('Reach the goal', { threadId: THREAD, resourceId: RESOURCE });

    const goalChunks: any[] = [];
    const stream = await agent.stream('go', {
      memory: { resource: RESOURCE, thread: { id: THREAD } },
      maxSteps: 3,
    });
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'goal') goalChunks.push(chunk);
    }

    expect(judge).toHaveBeenCalled();
    expect(scorer.run).not.toHaveBeenCalled();
    expect(goalChunks).toHaveLength(0);
    expect((await agent.getObjective({ threadId: THREAD }))?.runsUsed).toBe(0);
  });
});
