/** Ported from validation harness case T40 (memory-window). */
import { randomUUID } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';

describe.each(['plain', 'durable', 'evented'] as const)('Conversation windows on %s (COR-1409)', engine => {
  for (const readOnly of [false, true]) {
    it(
      readOnly
        ? 'read-only turns neither load nor persist history'
        : 'caps prior messages without losing persisted turns',
      async () => {
        const llm = new LLMock({ port: 0 });
        await llm.start();
        const storage = new LibSQLStore({ id: randomUUID(), url: ':memory:' });
        const memory = new Memory({
          storage,
          options: { lastMessages: 3, semanticRecall: false, generateTitle: false },
        });
        const base = new Agent({
          id: randomUUID(),
          name: 'Window',
          instructions: 'Answer with the requested turn number.',
          memory,
          model: createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` }).chat('gpt-4o'),
        });
        const agent =
          engine === 'plain'
            ? base
            : engine === 'durable'
              ? createDurableAgent({ agent: base })
              : createEventedAgent({ agent: base });
        const mastra = new Mastra({ agents: { agent }, storage, logger: false });
        const thread = randomUUID();
        const resource = randomUUID();
        const sizes: number[] = [];
        try {
          for (let n = 1; n <= 6; n++) {
            llm.clearFixtures();
            llm.clearRequests();
            llm.on({ endpoint: 'chat' }, { content: `t${n}` });
            const result = await agent.stream(`turn ${n}`, {
              memory: { thread, resource, options: { readOnly } },
            });
            const output = 'output' in result ? result.output : result;
            await output.consumeStream();
            expect(await output.text).toBe(`t${n}`);
            const requests = llm.getRequests();
            expect(requests).toHaveLength(1);
            const messages = (requests[0]!.body as { messages: { role: string }[] }).messages;
            sizes.push(messages.filter(message => message.role !== 'system').length);
            if ('cleanup' in result) result.cleanup();
          }
          // lastMessages caps prior messages at three; the current user input adds one.
          expect(sizes).toEqual(readOnly ? [1, 1, 1, 1, 1, 1] : [1, 3, 4, 4, 4, 4]);
          const store = await storage.getStore('memory');
          const { messages } = await store!.listMessages({ threadId: thread, perPage: false });
          expect(messages).toHaveLength(readOnly ? 0 : 12);
          if (!readOnly) {
            expect(
              messages
                .filter(message => message.role === 'assistant')
                .map(message =>
                  message.content.parts
                    ?.filter(part => part.type === 'text')
                    .map(part => part.text)
                    .join(''),
                ),
            ).toEqual(['t1', 't2', 't3', 't4', 't5', 't6']);
          }
        } finally {
          await mastra.shutdown();
          await storage.close();
          await llm.stop();
        }
      },
    );
  }
});
