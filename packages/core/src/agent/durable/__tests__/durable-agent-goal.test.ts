/**
 * DurableAgent goal wiring tests.
 *
 * Engine internals only: the agent-level `goal` config is exposed through the
 * durable/evented wrappers, lives on the in-process run registry entry (it holds
 * non-serializable closures), and an evented idle-signal wake still runs the goal
 * step. User-visible goal loop behavior is covered by the `goal-*` AIMock
 * scenarios in `loop/test-utils/aimock/scenarios`.
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
import { createEventedAgent } from '../create-evented-agent';

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

async function drain(stream: AsyncIterable<any>) {
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

  it('durable wrappers expose the wrapped agent goal config', () => {
    const passingScorer = {
      id: 'goal-scorer',
      name: 'Goal Scorer',
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'Goal achieved' }),
    };

    const baseAgent = new Agent({
      id: 'goal-wrapper-agent',
      name: 'Goal Wrapper Agent',
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
    const eventedAgent = createEventedAgent({ agent: baseAgent, pubsub });

    expect(durableAgent.__getGoalConfig()?.scorer).toBe(passingScorer);
    expect(eventedAgent.__getGoalConfig()?.scorer).toBe(passingScorer);
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

  it('evented idle signal wake emits goal chunk when scorer passes', async () => {
    const passingScorer = {
      id: 'goal-scorer',
      name: 'Goal Scorer',
      run: vi.fn().mockResolvedValue({ score: 1, reason: 'Goal achieved' }),
    };

    const THREAD = 'evented-signal-goal-thread';
    const RESOURCE = 'user-1';

    const baseAgent = new Agent({
      id: 'evented-signal-goal-agent',
      name: 'Evented Signal Goal Agent',
      instructions: 'You are a helpful agent.',
      model: createTextModel('I have completed the goal.') as LanguageModelV2,
      memory: new MockMemory(),
      goal: {
        judge: 'mock-judge',
        maxRuns: 5,
        scorer: passingScorer as any,
      },
    });
    const eventedAgent = createEventedAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'evented-signal-goal-agent': eventedAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const setResult = await eventedAgent.setObjective('Implement feature X', {
      threadId: THREAD,
      resourceId: RESOURCE,
    });
    expect(setResult).toBeDefined();

    const signalResult = await eventedAgent.sendSignal(
      { type: 'user-message', contents: 'Implement feature X' },
      {
        threadId: THREAD,
        resourceId: RESOURCE,
        ifIdle: { streamOptions: { maxSteps: 3, memory: { thread: THREAD, resource: RESOURCE } } },
      },
    );

    const accepted = await signalResult.accepted;
    expect(accepted).toMatchObject({ action: 'wake' });
    if (accepted.action !== 'wake') throw new Error('Expected signal wake');
    const chunks = await drain(accepted.output.fullStream as AsyncIterable<any>);

    const goalChunks = chunks.filter((c: any) => c.type === 'goal' && !c.payload?.pending);
    expect(goalChunks.length).toBeGreaterThan(0);
    expect(goalChunks[0].payload).toMatchObject({
      objective: 'Implement feature X',
      passed: true,
      status: 'done',
    });
  });
});
