import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import { readUIMessageStream } from '@mastra/core/ai';
import { convertArrayToReadableStream, MockLanguageModelV4 } from '@mastra/core/ai/test';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { toAISdkMessages } from '../convert-messages';
import { toAISdkStream } from '../convert-streams';

describe('reasoning-filtered replay (#23299)', () => {
  for (const sendReasoning of [undefined, false, true]) {
    it(`sendReasoning=${sendReasoning}: replays persisted text safely`, async () => {
      const storage = new LibSQLStore({ id: 'replay-test', url: ':memory:' });
      const memory = new Memory({ storage, options: { semanticRecall: false, lastMessages: 40 } });
      try {
        await memory.saveThread({
          thread: {
            id: 'thread',
            resourceId: 'resource',
            title: 'Replay',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        const model = new MockLanguageModelV4({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'reasoning-start', id: 'reasoning', providerMetadata: { openai: { itemId: 'rs_test' } } },
              { type: 'reasoning-delta', id: 'reasoning', delta: 'Summary' },
              { type: 'reasoning-end', id: 'reasoning' },
              { type: 'text-start', id: 'text', providerMetadata: { openai: { itemId: 'msg_test' } } },
              { type: 'text-delta', id: 'text', delta: 'Hello' },
              { type: 'text-end', id: 'text', providerMetadata: { openai: { itemId: 'msg_test' } } },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 2, text: 2, reasoning: undefined },
                },
              },
            ]),
          }),
        });
        const first = new Agent({ id: 'replay', name: 'Replay', instructions: 'Help.', model });
        const result = await first.stream('Hello');
        const options = { from: 'agent', sendReasoning } as const;
        const messages = readUIMessageStream({ stream: toAISdkStream(result, options) });
        let final;
        for await (const message of messages) final = message;
        expect(final).toBeDefined();
        const list = new MessageList({ threadId: 'thread', resourceId: 'resource' })
          .add({ id: 'first-user', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }, 'user')
          .add(final!, 'response');
        await memory.saveMessages({ messages: list.get.all.db() });
        const { messages: stored } = await memory.recall({ threadId: 'thread', resourceId: 'resource' });
        const replay = toAISdkMessages(stored);
        expect(
          replay.find(message => message.role === 'assistant')?.parts.some(part => part.type === 'reasoning'),
        ).toBe(sendReasoning === true);
        const requests: { input: unknown[] }[] = [];
        const openai = createOpenAI({
          apiKey: 'test-key',
          fetch: async (_url, init) => {
            requests.push(JSON.parse(String(init?.body)));
            return new Response(
              JSON.stringify({
                id: 'resp_test',
                object: 'response',
                created_at: 0,
                model: 'gpt-5',
                output: [
                  {
                    type: 'message',
                    id: 'msg_next',
                    role: 'assistant',
                    status: 'completed',
                    content: [{ type: 'output_text', text: 'Next', annotations: [] }],
                  },
                ],
                usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
              }),
              { headers: { 'Content-Type': 'application/json' } },
            );
          },
        });
        const second = new Agent({
          id: 'replay',
          name: 'Replay',
          instructions: 'Help.',
          model: openai.responses('gpt-5'),
        });
        await second.generate([...replay, { id: 'next', role: 'user', parts: [{ type: 'text', text: 'Continue' }] }], {
          providerOptions: { openai: { store: true, reasoningEffort: 'medium' } },
        });
        expect(requests).toHaveLength(1);
        if (sendReasoning) {
          expect(requests[0]!.input).toEqual(
            expect.arrayContaining([
              { type: 'item_reference', id: 'rs_test' },
              { type: 'item_reference', id: 'msg_test' },
            ]),
          );
        } else {
          expect(requests[0]!.input).toEqual(
            expect.arrayContaining([expect.objectContaining({ role: 'assistant', content: 'Hello' })]),
          );
          expect(JSON.stringify(requests[0]!.input)).not.toContain('msg_test');
          expect(JSON.stringify(requests[0]!.input)).not.toContain('rs_test');
        }
      } finally {
        await storage.close();
      }
    });
  }
});
