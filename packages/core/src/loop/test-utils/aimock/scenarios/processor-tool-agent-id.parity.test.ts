/**
 * Tools added by an input processor's `processInputStep` must run with the
 * owning agent's id in `context.agent.agentId`, the same as tools assigned to
 * the agent directly (https://github.com/mastra-ai/mastra/issues/26794).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { Mastra } from '../../../../mastra';
import type { InputProcessor } from '../../../../processors';
import { InMemoryStore } from '../../../../storage/mock';
import { createTool } from '../../../../tools';
import { Agent } from '../../../../agent/agent';
import { createDurableAgent } from '../../../../agent/durable/create-durable-agent';
import { createEventedAgent } from '../../../../agent/durable/create-evented-agent';
import { PARITY_ENGINES, createRecordingModel, textOnlyTape, toolCallTape } from '../parity';

const AGENT_ID = 'processor-tool-agent';

describe('processor-added tools receive the agent id', () => {
  it.each(PARITY_ENGINES)('%s engine', async engine => {
    const captured: Array<string | undefined> = [];
    const probe = createTool({
      id: 'probe',
      description: 'Records the agent id it runs under.',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        captured.push(context.agent?.agentId);
        return 'ok';
      },
    });

    const pubsub = new EventEmitterPubSub();
    const agent = new Agent({
      id: AGENT_ID,
      name: 'Processor Tool Agent',
      instructions: 'Call the probe tool.',
      model: createRecordingModel({ tapes: [toolCallTape('probe', {}), textOnlyTape('done')] }).model as never,
      inputProcessors: [
        {
          id: 'add-probe',
          processInputStep: ({ tools }: { tools?: Record<string, unknown> }) => ({
            tools: { ...(tools ?? {}), probe },
          }),
        } as unknown as InputProcessor,
      ],
    });

    const wrapper =
      engine === 'durable'
        ? createDurableAgent({ agent, pubsub })
        : engine === 'evented'
          ? createEventedAgent({ agent, pubsub })
          : undefined;
    const host = new Mastra({ agents: { [AGENT_ID]: wrapper ?? agent }, storage: new InMemoryStore(), logger: false });
    const registered = host.getAgent(AGENT_ID) as unknown as {
      stream: (messages: string, options: Record<string, unknown>) => Promise<unknown>;
    };

    const result = (await registered.stream('Call probe.', { maxSteps: 3 })) as {
      output?: { fullStream: AsyncIterable<unknown> };
      fullStream?: AsyncIterable<unknown>;
      cleanup?: () => void | Promise<void>;
    };
    const output = engine === 'plain' ? result : result.output!;

    try {
      for await (const _chunk of output.fullStream!) {
        // drain
      }
    } finally {
      await result.cleanup?.();
      await pubsub.close();
      await host.shutdown();
    }

    expect(captured).toEqual([AGENT_ID]);
  });
});
