import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent/message-list';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { expect, it, vi } from 'vitest';

it('reloads a tool-heavy LibSQL thread in one batch without changing the model prompt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'om-history-batch-'));
  const prompts: Parameters<MockLanguageModelV2['doStream']>[0]['prompt'][] = [];
  const model = new MockLanguageModelV2({
    doStream: async options => {
      prompts.push(options.prompt);
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'text' },
          { type: 'text-delta', id: 'text', delta: 'OK.' },
          { type: 'text-end', id: 'text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
  const history: MastraDBMessage[] = Array.from({ length: 90 }, (_, i) => ({
    id: `history-${i}`,
    threadId: 'thread',
    resourceId: 'resource',
    role: i % 3 ? 'assistant' : 'user',
    createdAt: new Date(1700000000000 + i * 1000),
    content: {
      format: 2,
      parts:
        i % 3
          ? [
              {
                type: 'tool-invocation',
                toolInvocation:
                  i % 3 === 1
                    ? {
                        state: 'call',
                        toolName: 'lookup',
                        toolCallId: `call-${Math.floor(i / 3)}`,
                        args: { query: `query-${Math.floor(i / 3)}` },
                      }
                    : {
                        state: 'result',
                        toolName: 'lookup',
                        toolCallId: `call-${Math.floor(i / 3)}`,
                        args: { query: `query-${Math.floor(i / 3)}` },
                        result: { answer: `result-${Math.floor(i / 3)}` },
                      },
              },
            ]
          : [{ type: 'text', text: `Request ${Math.floor(i / 3)}.` }],
    },
  }));
  const add = vi.spyOn(MessageList.prototype, 'add');
  const stores: LibSQLStore[] = [];
  const memories: Memory[] = [];
  try {
    for (let turn = 0; turn < 2; turn++) {
      const storage = new LibSQLStore({ id: `store-${turn}`, url: `file:${join(dir, 'history.db')}` });
      stores.push(storage);
      const memory = new Memory({
        storage,
        options: {
          lastMessages: false,
          observationalMemory: {
            observation: { model, messageTokens: 5_000_000, bufferTokens: false },
            reflection: { model, observationTokens: 5_000_000 },
          },
        },
      });
      memories.push(memory);
      if (!turn) {
        await memory.saveThread({
          thread: {
            id: 'thread',
            resourceId: 'resource',
            title: 'History',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        await memory.saveMessages({ messages: history });
      }
      const agent = new Agent({ id: 'history', name: 'history', instructions: 'Be brief.', model, memory });
      add.mockClear();
      const response = await agent.stream(`Current question ${turn}.`, {
        memory: { thread: 'thread', resource: 'resource' },
      });
      await response.consumeStream();
      expect(await response.text).toBe('OK.');
      await memory.settled();
      const prompt = prompts.at(-1)!;
      const calls = prompt
        .filter(message => message.role === 'assistant')
        .flatMap(message => message.content)
        .filter(part => part.type === 'tool-call');
      const results = prompt.filter(message => message.role === 'tool').flatMap(message => message.content);
      expect(calls).toHaveLength(30);
      expect(results).toHaveLength(30);
      for (let i = 0; i < 30; i++) {
        expect(calls[i]).toMatchObject({ toolCallId: `call-${i}`, input: { query: `query-${i}` } });
        expect(JSON.stringify(results[i])).toContain(`result-${i}`);
      }
      const historyLoads = add.mock.calls.filter(
        ([messages, source]) =>
          source === 'memory' &&
          (Array.isArray(messages) ? messages : [messages]).some(
            message => typeof message === 'object' && message !== null && 'id' in message && message.id === 'history-0',
          ),
      );
      expect(historyLoads.length).toBeGreaterThan(0);
      for (const [messages] of historyLoads) {
        expect(Array.isArray(messages)).toBe(true);
        expect((messages as MastraDBMessage[]).filter(message => message.id.startsWith('history-'))).toHaveLength(90);
      }
      await storage.close();
      stores.pop();
      memories.pop();
    }
  } finally {
    add.mockRestore();
    await Promise.all(memories.map(memory => memory.settled()));
    await Promise.all(stores.map(storage => storage.close()));
    await rm(dir, { recursive: true, force: true });
  }
});
