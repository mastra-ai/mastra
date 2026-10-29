import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

let mock: LLMock;
beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});
afterEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});
afterAll(async () => {
  await mock.stop();
});

for (const engine of ['durable', 'evented'] as const) {
  describe(`${engine}: replacement instance delegation suspends twice (#27971)`, () => {
    it.each([false, true])(
      'persists the next suspension with observational memory %s',
      async observationalMemory => {
        const storage = new InMemoryStore();
        const provider = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url}/v1` });
        const memoryOptions = { thread: `replacement-${engine}-${observationalMemory}`, resource: 'resource' };
        mock.on(
          { endpoint: 'chat', model: 'supervisor' },
          {
            toolCalls: [
              {
                id: 'call-delegate',
                name: 'agent-specialist',
                arguments: JSON.stringify({ prompt: 'Ask both questions' }),
              },
            ],
          },
        );
        mock.on(
          {
            endpoint: 'chat',
            model: 'specialist',
            predicate: req => !JSON.stringify(req.messages).includes('call-q1'),
          },
          {
            toolCalls: [{ id: 'call-q1', name: 'ask', arguments: JSON.stringify({ question: 'q1' }) }],
          },
        );
        mock.on(
          { endpoint: 'chat', model: 'specialist', predicate: req => JSON.stringify(req.messages).includes('call-q1') },
          {
            toolCalls: [{ id: 'call-q2', name: 'ask', arguments: JSON.stringify({ question: 'q2' }) }],
          },
        );
        const createInstance = () => {
          const memory = new Memory({
            storage,
            options: observationalMemory
              ? {
                  observationalMemory: {
                    enabled: true,
                    observation: { model: provider.chat('observer'), messageTokens: 100_000, bufferTokens: false },
                    reflection: { model: provider.chat('observer'), observationTokens: 100_000 },
                  },
                }
              : {},
          });
          const specialist = new Agent({
            id: 'specialist',
            name: 'specialist',
            instructions: 'Ask questions.',
            model: provider.chat('specialist'),
            tools: {
              ask: createTool({
                id: 'ask',
                description: 'Ask a question',
                inputSchema: z.object({ question: z.string() }),
                suspendSchema: z.object({ question: z.string() }),
                resumeSchema: z.object({ answer: z.string() }),
                execute: async ({ question }, context) =>
                  context?.agent?.resumeData ?? context?.agent?.suspend({ question }),
              }),
            },
          });
          const supervisor = new Agent({
            id: 'supervisor',
            name: 'supervisor',
            instructions: 'Delegate.',
            model: provider.chat('supervisor'),
            agents: { specialist },
            memory,
          });
          const wrapper =
            engine === 'durable'
              ? createDurableAgent({ agent: supervisor })
              : createEventedAgent({ agent: supervisor, pubsub: new EventEmitterPubSub() });
          const mastra = new Mastra({ agents: { supervisor: wrapper, specialist }, storage, logger: false });
          return { wrapper, mastra, memory };
        };
        const first = createInstance();
        let second: ReturnType<typeof createInstance> | undefined;
        try {
          const initial = await first.wrapper.stream('Ask both questions', { memory: memoryOptions, maxSteps: 5 });
          const firstSuspensions: string[] = [];
          for await (const chunk of initial.fullStream) {
            if (chunk.type === 'tool-call-suspended') {
              firstSuspensions.push(JSON.stringify(chunk.payload.suspendPayload));
              break;
            }
          }
          expect(firstSuspensions.join(' ')).toContain('q1');
          const runId = await initial.runId;
          const getSuspended = async (instance: ReturnType<typeof createInstance>) => {
            const { messages } = await instance.memory.recall({
              threadId: memoryOptions.thread,
              resourceId: memoryOptions.resource,
              perPage: false,
            });
            const delegation = messages.find(
              message =>
                message.role === 'assistant' &&
                message.content.parts?.some(
                  part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-delegate',
                ),
            );
            return delegation?.content.metadata?.suspendedTools;
          };
          expect(JSON.stringify(await getSuspended(first))).toContain('q1');
          if (engine === 'evented') {
            await vi.waitFor(
              async () => {
                const runs = await first.wrapper.listSuspendedRuns({
                  threadId: memoryOptions.thread,
                  resourceId: memoryOptions.resource,
                });
                expect(runs.runs.some(run => run.runId === runId)).toBe(true);
              },
              { timeout: 5000 },
            );
          }
          second = createInstance();
          const resumed = await second.wrapper.resumeStream(
            { answer: 'first answer' },
            { runId, toolCallId: 'call-delegate', memory: memoryOptions, maxSteps: 5 },
          );
          const secondSuspensions: string[] = [];
          for await (const chunk of resumed.fullStream) {
            if (chunk.type === 'tool-call-suspended') {
              secondSuspensions.push(JSON.stringify(chunk.payload.suspendPayload));
              break;
            }
          }
          expect(secondSuspensions.join(' ')).toContain('q2');
          const saved = JSON.stringify(await getSuspended(second));
          expect(saved).toContain('q2');
          expect(saved).not.toContain('q1');
        } finally {
          await second?.mastra.stopWorkers();
          await first.mastra.stopWorkers();
        }
      },
      40_000,
    );
  });
}
