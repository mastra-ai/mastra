import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

/**
 * Regression for https://github.com/mastra-ai/mastra/issues/24052
 *
 * A reasoning model's assistant turn is persisted with a reasoning part (`rs_*`) and a
 * text part (`msg_*`). A `useChat` client then echoes that assistant message back on the
 * next turn by id, without the reasoning part. The echo must not win over the stored copy:
 * the next prompt must still contain the reasoning item (OpenAI Responses rejects an
 * orphaned `msg_*` item_reference) and the stored message must not be overwritten.
 */

const rs = { openai: { itemId: 'rs_1', reasoningEncryptedContent: null } };
const msg = { openai: { itemId: 'msg_1' } };

function createReasoningModel(captured: unknown[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      captured.push(prompt);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp', modelId: 'gpt-5', timestamp: new Date(0) },
          { type: 'reasoning-start', id: 'r1', providerMetadata: rs },
          { type: 'reasoning-end', id: 'r1', providerMetadata: rs },
          { type: 'text-start', id: 't1', providerMetadata: msg },
          { type: 'text-delta', id: 't1', delta: 'Hi.', providerMetadata: msg },
          { type: 'text-end', id: 't1', providerMetadata: msg },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

function assistantPartShape(prompt: any[]) {
  return prompt
    .filter(m => m.role === 'assistant')
    .flatMap(m => (Array.isArray(m.content) ? m.content : []))
    .map((p: any) => `${p.type}:${p.providerOptions?.openai?.itemId ?? '-'}`);
}

function dbPartShape(message: any) {
  return message.content.parts.map((p: any) => `${p.type}:${p.providerMetadata?.openai?.itemId ?? '-'}`);
}

describe('client echo of a reasoning assistant message (#24052)', () => {
  for (const echoKeepsItemId of [true, false]) {
    it(`keeps stored reasoning in the prompt and in storage (echo keeps itemId: ${echoKeepsItemId})`, async () => {
      const captured: any[] = [];
      const memory = new MockMemory();
      const agent = new Agent({
        id: 'a',
        name: 'a',
        instructions: 'x',
        model: createReasoningModel(captured),
        memory,
      });
      const threadId = randomUUID();
      const memoryOpts = { memory: { thread: threadId, resource: 'r', options: { lastMessages: 10 } } };

      const turn1 = await agent.stream([{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'q1' }] }], memoryOpts);
      await turn1.consumeStream();
      const stored = turn1.messageList.get.all.db().find(m => m.role === 'assistant')!;
      expect(dbPartShape(stored)).toEqual(['reasoning:rs_1', 'text:msg_1']);

      const echoedTurn1 = {
        id: stored.id,
        role: 'assistant' as const,
        parts: [{ type: 'text' as const, text: 'Hi.', ...(echoKeepsItemId ? { providerMetadata: msg } : {}) }],
      };
      const turn2 = await agent.stream(
        [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'q1' }] },
          echoedTurn1,
          { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'q2' }] },
        ],
        memoryOpts,
      );
      await turn2.consumeStream();

      // Prompt for turn 2 still carries the reasoning item ahead of its message item.
      expect(assistantPartShape(captured[1])).toEqual(['reasoning:rs_1', 'text:msg_1']);

      // The lossy echo did not overwrite the stored copy.
      const recalled = await memory.recall({ threadId, resourceId: 'r', perPage: 100 });
      const persisted = recalled.messages.find(m => m.id === stored.id)!;
      expect(dbPartShape(persisted)).toEqual(['reasoning:rs_1', 'text:msg_1']);
    });
  }
});
