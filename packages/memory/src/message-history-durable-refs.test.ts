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

import { Memory } from './index';

const HISTORY = Array.from({ length: 6 }, (_, i) => `history-${i}`);
let llm: LLMock;

beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterEach(() => {
  llm.clearFixtures();
  llm.clearRequests();
  llm.resetMatchCounts();
});
afterAll(async () => {
  await llm.stop();
});

describe('durable history refs with a token budget (#27987)', () => {
  for (const engine of ['durable', 'evented'] as const) {
    it.each([false, true])(`${engine} persists recalled rows as refs (budget: %s)`, async budget => {
      const storage = new InMemoryStore({ id: `refs-${engine}-${budget}` });
      const memory = new Memory({
        storage,
        options: { lastMessages: 100, semanticRecall: false, generateTitle: false },
      });
      const store = (await storage.getStore('memory'))!;
      const threadId = `thread-${engine}-${budget}`;
      await store.saveThread({
        thread: {
          id: threadId,
          resourceId: 'r',
          title: 'History',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
      });
      await store.saveMessages({
        messages: HISTORY.map((text, i) => ({
          id: `h${i}`,
          threadId,
          resourceId: 'r',
          role: (i % 2 ? 'assistant' : 'user') as 'assistant' | 'user',
          createdAt: new Date(Date.now() - 60_000 + i * 1000),
          content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
        })),
      });
      const workflows = (await storage.getStore('workflows'))!;
      const snapshots: unknown[] = [];
      for (const method of ['updateWorkflowResults', 'updateWorkflowState', 'persistWorkflowSnapshot'] as const) {
        const original = workflows[method].bind(workflows);
        workflows[method] = async (args: any) => {
          const result = await original(JSON.parse(JSON.stringify(args)));
          if (args.workflowName === 'durable-agentic-execution') {
            snapshots.push(
              JSON.parse(
                JSON.stringify(
                  await workflows.loadWorkflowSnapshot({ workflowName: args.workflowName, runId: args.runId }),
                ),
              ),
            );
          }
          return result;
        };
      }
      llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { toolCalls: [{ id: 'call-1', name: 'echo', arguments: '{}' }] });
      llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'done' });
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
      const agent = new Agent({
        id: 'refs-agent',
        name: 'refs-agent',
        instructions: 'Call echo once, then answer.',
        model: openai.chat('actor'),
        tools: {
          echo: createTool({
            id: 'echo',
            description: 'Echo',
            inputSchema: z.object({}),
            execute: async () => ({ ok: true }),
          }),
        },
        memory,
      });
      const durable =
        engine === 'evented'
          ? createEventedAgent({ agent, pubsub: new EventEmitterPubSub() })
          : createDurableAgent({ agent });
      const mastra = new Mastra({ storage, logger: false, agents: { agent: durable } });
      try {
        const stream = await durable.stream('go', {
          memory: {
            thread: threadId,
            resource: 'r',
            ...(budget ? { options: { messageHistory: { maxTokens: 10_000 } } } : {}),
          },
          maxSteps: 3,
        });
        const events: unknown[] = [];
        for await (const event of stream.fullStream) events.push(event);
        expect(events.some((event: any) => event.type === 'error')).toBe(false);
        const requests = llm.getRequests().filter(req => (req.body as { model?: string })?.model === 'actor');
        expect(requests).toHaveLength(2);
        for (const text of HISTORY) expect(JSON.stringify(requests[0]!.body)).toContain(text);
        const states = snapshots.flatMap(snapshot => {
          const s = snapshot as { value?: any; context?: { __state?: any } };
          return [s.value?.messageListState, s.context?.__state?.messageListState].filter(Boolean);
        });
        expect(states.length).toBeGreaterThan(0);
        const largest = states.reduce((a, b) => (b.messages.length > a.messages.length ? b : a));
        expect(largest.messages.filter((m: any) => m.__ref === 'memory' && /^h\d$/.test(m.id))).toHaveLength(6);
      } finally {
        await mastra.stopWorkers();
      }
    });
  }
});
