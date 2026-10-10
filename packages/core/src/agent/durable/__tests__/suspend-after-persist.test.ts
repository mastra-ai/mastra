import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function toolCallModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream<any>([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName: 'askUser',
          input: '{"question":"which order?"}',
          providerExecuted: false,
        },
        { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

describe('deferred suspension events (#26435)', () => {
  const pubsub = new EventEmitterPubSub();

  afterEach(() => {
    globalRunRegistry.clear();
  });

  it('does not announce a suspension when saving the suspended snapshot fails', async () => {
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    workflows.persistWorkflowSnapshot = async args => {
      if ((args.snapshot as { status?: string })?.status === 'suspended') throw new Error('storage down');
      return persist(args);
    };

    const askUser = createTool({
      id: 'askUser',
      description: 'Ask the user',
      inputSchema: z.object({ question: z.string() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ answer: z.string() }),
      execute: async (input, context: any) => context.agent.suspend({ question: input.question }),
    });
    const agent = new Agent({
      id: 'support',
      name: 'support',
      instructions: 'help',
      model: toolCallModel() as LanguageModelV2,
      tools: { askUser },
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({ agents: { durableAgent }, storage, logger: false });

    const result = await durableAgent.stream('where is my order', { maxSteps: 3 });
    const types: string[] = [];
    for await (const chunk of result.fullStream) types.push(chunk.type);

    expect(types, types.join(', ')).not.toContain('tool-call-suspended');
  });
});
