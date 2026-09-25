import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MockMemory } from '../../../memory/mock';
import type { InputProcessor } from '../../../processors';
import { createTool } from '../../../tools';
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

  it('validates dynamic fallback timeouts before preparation side effects', async () => {
    const pubsub = new EventEmitterPubSub();
    const memory = new MockMemory();
    const createThread = vi.spyOn(memory, 'createThread');
    const processInput = vi.fn(async (args: any) => args.messages);
    const inputProcessor: InputProcessor = {
      id: 'side-effect-processor',
      processInput,
    };
    const onOutput = vi.fn();
    const resolveModels = vi.fn(async () => [
      { model: createModel(), maxRetries: 0 },
      {
        model: createModel(),
        maxRetries: 0,
        modelSettings: { timeout: { firstChunkMs: -1 } },
      },
    ]);
    const baseAgent = new Agent({
      id: 'atomic-invalid-fallback-timeout',
      name: 'Atomic invalid fallback timeout',
      instructions: 'test',
      model: resolveModels,
      memory,
      inputProcessors: [inputProcessor],
      tools: {
        browserTool: createTool({
          id: 'browserTool',
          inputSchema: z.object({}),
          onOutput,
        }),
      },
    });
    const getToolsForExecution = vi.spyOn(baseAgent, 'getToolsForExecution');
    const agent = new AgentType({ agent: baseAgent, pubsub });
    resolveModels.mockClear();

    try {
      await expect(
        agent.prepare(
          [
            {
              role: 'assistant',
              content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'browserTool', args: {} }],
            },
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call-1',
                  toolName: 'browserTool',
                  result: { ok: true },
                },
              ],
            },
          ] as any,
          {
            memory: {
              thread: 'invalid-fallback-thread',
              resource: 'invalid-fallback-resource',
            },
          },
        ),
      ).rejects.toEqual(
        new TypeError('`modelSettings.timeout.firstChunkMs` must be a positive, finite number of milliseconds.'),
      );

      expect(resolveModels).toHaveBeenCalledTimes(1);
      expect(createThread).not.toHaveBeenCalled();
      expect(processInput).not.toHaveBeenCalled();
      expect(getToolsForExecution).not.toHaveBeenCalled();
      expect(onOutput).not.toHaveBeenCalled();
    } finally {
      await pubsub.close();
    }
  });
});
