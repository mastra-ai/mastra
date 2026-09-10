import { Memory } from '@mastra/memory';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';

it.each([false, true])(
  'preserves provider-normalized tool input after suspension (durable=%s)',
  async durable => {
    const storage = new InMemoryStore({ id: 'normalized-tool-input' });
    const memory = new Memory({ storage });
    const received: unknown[] = [];
    const prompts: unknown[] = [];
    const schema = z.object({ options: z.array(z.object({ label: z.string(), description: z.string().optional() })) });
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    };
    const model = new MockLanguageModelV3({
      provider: 'openai',
      modelId: 'gpt-4o',
      doStream: async options => {
        prompts.push(options.prompt);
        return {
          stream: simulateReadableStream({
            chunks:
              prompts.length === 1
                ? [
                    {
                      type: 'tool-call' as const,
                      toolCallType: 'function' as const,
                      toolCallId: 'question-1',
                      toolName: 'question',
                      input: JSON.stringify({ options: [{ label: 'Reading', description: null }] }),
                      providerExecuted: false,
                    },
                    {
                      type: 'finish' as const,
                      finishReason: { unified: 'tool-calls' as const, raw: 'tool-calls' },
                      usage,
                    },
                  ]
                : [
                    { type: 'text-start' as const, id: 'done' },
                    { type: 'text-delta' as const, id: 'done', delta: 'Done.' },
                    { type: 'text-end' as const, id: 'done' },
                    { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: 'stop' }, usage },
                  ],
          }),
        };
      },
    });
    const baseAgent = new Agent({
      id: 'question-agent',
      name: 'Question input proof',
      instructions: 'Ask once.',
      model,
      memory,
      tools: {
        question: createTool({
          id: 'question',
          description: 'Ask one question.',
          inputSchema: schema,
          suspendSchema: schema,
          resumeSchema: z.string(),
          execute: async (input, context) => {
            received.push(structuredClone(input));
            const accepted = schema.parse(input);
            if (context?.agent?.resumeData !== undefined) return { answer: context.agent.resumeData, accepted };
            return context?.agent?.suspend(accepted);
          },
        }),
      },
      defaultOptions: { maxSteps: 3 },
    });
    const agent = durable ? (createDurableAgent({ agent: baseAgent }) as unknown as Agent) : baseAgent;
    const controller = new AgentController({
      id: 'input-controller',
      agent,
      storage,
      memory,
      modes: [{ id: 'chat', name: 'Chat', metadata: { default: true } }],
      disableBuiltinTools: ['ask_user'],
    });
    new Mastra({ storage, agents: { question: agent }, agentControllers: { questions: controller } });
    await controller.init();
    const session = await controller.createSession({
      resourceId: 'input-user',
      threadId: 'input-thread',
      ownerId: controller.id,
    });
    await session.state.set({ yolo: true });
    await session.sendMessage({ content: 'Ask the question.' });
    await expect.poll(() => session.displayState.get().pendingSuspensions.size).toBe(1);
    expect(received).toEqual([{ options: [{ label: 'Reading' }] }]);
    await session.respondToToolSuspension({ toolCallId: 'question-1', resumeData: 'Reading' });
    await expect.poll(() => received.length).toBe(2);
    await expect.poll(() => session.run.isRunning()).toBe(false);
    expect(received[1]).toEqual(received[0]);
    expect(JSON.stringify(prompts.at(-1))).toContain('"answer":"Reading"');
  },
  20_000,
);
