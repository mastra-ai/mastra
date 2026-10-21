import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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

describe('empty final step with observational memory (#27920)', () => {
  for (const engine of ['normal', 'durable', 'evented'] as const) {
    it(`${engine} streams and stores text appended by processOutputStep`, async () => {
      mock.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_save', name: 'save', arguments: {} }] },
      );
      mock.on({ endpoint: 'chat', hasToolResult: true }, { content: '' });

      const store = new InMemoryStore();
      const memory = new Memory({
        storage: store,
        options: {
          observationalMemory: {
            enabled: true,
            scope: 'thread',
            observation: {
              model: createOpenAI({ apiKey: 'test', baseURL: `${mock.url}/v1` }).chat('observer'),
              messageTokens: 500_000,
              bufferTokens: false,
            },
            reflection: { observationTokens: 60_000 },
          },
        },
      });
      const openai = createOpenAI({ apiKey: 'test', baseURL: `${mock.url}/v1` });
      const responseCounts: number[] = [];
      const closing = {
        id: 'closing',
        async processOutputStep({
          messageList,
          writer,
          finishReason,
        }: {
          messageList: {
            get: {
              response: {
                db: () => Array<{ role: string; content: { parts: Array<{ type: string; text?: string }> } }>;
              };
            };
          };
          writer?: { custom: (part: { type: string; payload: { id: string; text?: string } }) => Promise<void> };
          finishReason: string;
        }) {
          if (finishReason !== 'stop') return messageList;
          const responseMessages = messageList.get.response.db();
          responseCounts.push(responseMessages.length);
          const target = responseMessages.findLast(message => message.role === 'assistant');
          if (!target) return messageList;
          await writer?.custom({ type: 'text-start', payload: { id: 'closing' } });
          await writer?.custom({ type: 'text-delta', payload: { id: 'closing', text: 'Saved.' } });
          await writer?.custom({ type: 'text-end', payload: { id: 'closing' } });
          target.content.parts.push({ type: 'text', text: 'Saved.' });
          return messageList;
        },
      };
      const agent = new Agent({
        id: 'empty-final-step-agent',
        name: 'empty-final-step-agent',
        instructions: 'Save the request.',
        model: openai.chat('actor'),
        tools: {
          save: createTool({
            id: 'save',
            description: 'Save the request.',
            inputSchema: z.object({}),
            execute: async () => ({ ok: true }),
          }),
        },
        memory,
      });
      const pubsub = new EventEmitterPubSub();
      const runningAgent =
        engine === 'normal'
          ? agent
          : engine === 'evented'
            ? createEventedAgent({ agent, pubsub })
            : createDurableAgent({ agent });
      const mastra = new Mastra({
        agents: { agent: runningAgent },
        storage: store,
        logger: false,
        ...(engine === 'evented' ? { pubsub } : {}),
      });
      const threadId = `empty-final-${engine}`;
      try {
        const stream = await runningAgent.stream('Save this.', {
          memory: { thread: threadId, resource: 'r' },
          maxSteps: 3,
          outputProcessors: [closing],
        });
        let streamedText = '';
        for await (const chunk of stream.fullStream) {
          if (chunk.type === 'text-delta') streamedText += chunk.payload.text;
        }
        const requests = mock.getRequests().filter(entry => (entry.body as { model?: string })?.model === 'actor');
        expect(requests).toHaveLength(2);
        expect(responseCounts).toEqual([1]);
        expect(streamedText).toBe('Saved.');
        const memoryStore = (await store.getStore('memory'))!;
        const { messages } = await memoryStore.listMessages({ threadId, perPage: false });
        const savedMessage = messages.find(
          message =>
            message.role === 'assistant' &&
            message.content.parts.some(part => part.type === 'text' && part.text === 'Saved.'),
        );
        expect(savedMessage?.content.parts.map(part => part.type)).toEqual(['tool-invocation', 'step-start', 'text']);
      } finally {
        await mastra.stopWorkers();
      }
    });
  }
});
