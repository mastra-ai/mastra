/**
 * DurableAgent goal step tests.
 *
 * Verifies that agent-level `goal` configuration is bridged into the durable
 * workflow via the in-process run registry:
 * - The `goal` config lives on the registry entry (non-serializable closures).
 * - When an active objective exists on the thread, the goal step evaluates it
 *   after each qualifying iteration.
 * - A passing scorer stops the loop and emits a `goal` chunk with `passed: true`.
 * - No-ops when no goal is configured or no active objective exists.
 * - Stops the loop when the evaluation budget is exhausted.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

describe('DurableAgent goal step', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('goal config is stored on the run registry entry', async () => {
    const passingScorer = {
      id: 'goal-scorer',
      name: 'Goal Scorer',
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'Goal achieved' }),
    };

    const baseAgent = new Agent({
      id: 'goal-prep-agent',
      name: 'Goal Prep Agent',
      instructions: 'noop',
      model: createTextModel('done') as LanguageModelV2,
      memory: new MockMemory(),
      goal: {
        judge: 'mock-judge',
        maxRuns: 5,
        scorer: passingScorer as any,
      },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'goal-prep-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
    });

    const { registryEntry } = await durableAgent.prepare('hello');

    expect(registryEntry.goal).toBeDefined();
    expect(registryEntry.goal?.scorer).toBe(passingScorer);
    expect(registryEntry.goal?.maxRuns).toBe(5);
  });

  it('stops the loop and emits goal chunk when scorer passes', async () => {
    const passingScorer = {
      id: 'goal-scorer',
      name: 'Goal Scorer',
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'Goal achieved' }),
    };

    const THREAD = 'goal-thread-1';
    const RESOURCE = 'user-1';

    const baseAgent = new Agent({
      id: 'goal-pass-agent',
      name: 'Goal Pass Agent',
      instructions: 'You are a helpful agent.',
      model: createTextModel('I have completed the goal.') as LanguageModelV2,
      memory: new MockMemory(),
      goal: {
        judge: 'mock-judge',
        maxRuns: 5,
        scorer: passingScorer as any,
      },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'goal-pass-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    // Set an active objective before streaming
    const setResult = await durableAgent.setObjective('Implement feature X', {
      threadId: THREAD,
      resourceId: RESOURCE,
    });
    expect(setResult).toBeDefined();
    expect(setResult?.status).toBe('active');

    const result = await durableAgent.stream('Implement feature X', {
      maxSteps: 3,
      memory: { thread: THREAD, resource: RESOURCE },
    });

    const chunks = await drain(result.fullStream);

    // Should have at least one goal chunk with passed=true
    const goalChunks = chunks.filter((c: any) => c.type === 'goal' && !c.payload?.pending);
    expect(goalChunks.length).toBeGreaterThan(0);
    expect(goalChunks[0].payload).toMatchObject({
      objective: 'Implement feature X',
      passed: true,
      status: 'done',
    });

    // Verify objective is marked as done
    const record = await durableAgent.getObjective({ threadId: THREAD });
    expect(record?.status).toBe('done');
    expect(record?.runsUsed).toBe(1);
  });

  it('no-ops when no goal is configured', async () => {
    const THREAD = 'no-goal-thread';
    const RESOURCE = 'user-1';

    const baseAgent = new Agent({
      id: 'no-goal-agent',
      name: 'No Goal Agent',
      instructions: 'You are a helpful agent.',
      model: createTextModel('Hello!') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'no-goal-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Hello', {
      maxSteps: 1,
      memory: { thread: THREAD, resource: RESOURCE },
    });

    const chunks = await drain(result.fullStream);

    // No goal chunks should be emitted
    const goalChunks = chunks.filter((c: any) => c.type === 'goal');
    expect(goalChunks).toHaveLength(0);
  });

  it('no-ops when no active objective exists on the thread', async () => {
    const passingScorer = {
      id: 'goal-scorer',
      name: 'Goal Scorer',
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'Goal achieved' }),
    };

    const THREAD = 'no-objective-thread';
    const RESOURCE = 'user-1';

    const baseAgent = new Agent({
      id: 'goal-no-obj-agent',
      name: 'Goal No Obj Agent',
      instructions: 'You are a helpful agent.',
      model: createTextModel('Hello!') as LanguageModelV2,
      memory: new MockMemory(),
      goal: {
        judge: 'mock-judge',
        maxRuns: 5,
        scorer: passingScorer as any,
      },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'goal-no-obj-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    // Don't set an objective — the goal step should no-op
    const result = await durableAgent.stream('Hello', {
      maxSteps: 1,
      memory: { thread: THREAD, resource: RESOURCE },
    });

    const chunks = await drain(result.fullStream);

    // No goal chunks should be emitted (pending ones are internal noise)
    const goalChunks = chunks.filter((c: any) => c.type === 'goal' && !c.payload?.pending);
    expect(goalChunks).toHaveLength(0);

    // Scorer should never have been called
    expect(passingScorer.run).not.toHaveBeenCalled();
  });

  it('emits goal chunk with maxRunsReached when budget is exhausted', async () => {
    const failingScorer = {
      id: 'goal-scorer',
      name: 'Goal Scorer',
      run: vi.fn().mockResolvedValue({ score: 0, reason: 'Not done yet' }),
    };

    const THREAD = 'budget-thread';
    const RESOURCE = 'user-1';

    const baseAgent = new Agent({
      id: 'goal-budget-agent',
      name: 'Goal Budget Agent',
      instructions: 'You are a helpful agent.',
      model: createTextModel('Working on it...') as LanguageModelV2,
      memory: new MockMemory(),
      goal: {
        judge: 'mock-judge',
        maxRuns: 1,
        scorer: failingScorer as any,
      },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'goal-budget-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    // Set an active objective
    const setResult = await durableAgent.setObjective('Build a spaceship', {
      threadId: THREAD,
      resourceId: RESOURCE,
    });
    expect(setResult).toBeDefined();

    const result = await durableAgent.stream('Build a spaceship', {
      maxSteps: 3,
      memory: { thread: THREAD, resource: RESOURCE },
    });

    const chunks = await drain(result.fullStream);

    // Should have a goal chunk
    const goalChunks = chunks.filter((c: any) => c.type === 'goal' && !c.payload?.pending);
    expect(goalChunks.length).toBeGreaterThan(0);

    const lastGoalChunk = goalChunks[goalChunks.length - 1];
    expect(lastGoalChunk.payload).toMatchObject({
      objective: 'Build a spaceship',
      passed: false,
    });

    // Objective should be paused
    const record = await durableAgent.getObjective({ threadId: THREAD });
    expect(record?.status).toBe('paused');
  });
});
