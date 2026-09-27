import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { DurableAgent } from '../durable-agent';
import { EventedAgent } from '../evented-agent';

const AgentTypes = [
  ['DurableAgent', DurableAgent],
  ['EventedAgent', EventedAgent],
] as const;

function createModel() {
  return {
    provider: 'test',
    modelId: 'test',
    specificationVersion: 'v2',
  } as LanguageModelV2;
}

describe.each(AgentTypes)('%s modelSettings.timeout validation', (_, AgentType) => {
  it.each([
    [
      30_000,
      '`modelSettings.timeout` must be an object with optional `totalMs`, `stepMs`, and `firstChunkMs` properties.',
    ],
    [{ totalMs: 0 }, '`modelSettings.timeout.totalMs` must be a positive, finite number of milliseconds.'],
    [
      { stepMs: Number.POSITIVE_INFINITY },
      '`modelSettings.timeout.stepMs` must be a positive, finite number of milliseconds.',
    ],
  ])('rejects invalid call-time timeout %#', async (timeout, expectedMessage) => {
    const pubsub = new EventEmitterPubSub();
    const baseAgent = new Agent({
      id: 'invalid-call-time-timeout',
      name: 'Invalid call-time timeout',
      instructions: 'test',
      model: createModel(),
    });
    const agent = new AgentType({ agent: baseAgent, pubsub });

    try {
      await expect(
        agent.prepare('hello', {
          modelSettings: { timeout } as any,
        }),
      ).rejects.toEqual(new TypeError(expectedMessage));
    } finally {
      await pubsub.close();
    }
  });

  it('rejects an invalid timeout on a later fallback model', async () => {
    const pubsub = new EventEmitterPubSub();
    const baseAgent = new Agent({
      id: 'invalid-fallback-timeout',
      name: 'Invalid fallback timeout',
      instructions: 'test',
      model: [
        { model: createModel(), maxRetries: 0 },
        {
          model: createModel(),
          maxRetries: 0,
          modelSettings: { timeout: { firstChunkMs: -1 } },
        },
      ],
    });
    const agent = new AgentType({ agent: baseAgent, pubsub });

    try {
      await expect(agent.prepare('hello')).rejects.toEqual(
        new TypeError('`modelSettings.timeout.firstChunkMs` must be a positive, finite number of milliseconds.'),
      );
    } finally {
      await pubsub.close();
    }
  });
});
