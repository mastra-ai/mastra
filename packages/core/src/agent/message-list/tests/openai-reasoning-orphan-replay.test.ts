import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';

/**
 * Reproduces https://github.com/mastra-ai/mastra/issues/24052.
 *
 * When a memory-loaded assistant turn carries a text item with an OpenAI `msg_*` itemId but
 * its reasoning partner (`rs_*`) was never persisted, `@mastra/core`'s history replay used to
 * send that orphaned `msg_*` to the Responses API, which rejects it with:
 *   "Item 'msg_*' of type 'message' was provided without its required 'reasoning' item".
 *
 * The prompt() path now strips the orphaned itemId (follow-up to the client-stream fix #23323),
 * while still preserving itemIds when the reasoning partner is present in the same turn group.
 */
describe('OpenAI reasoning — orphaned message-item replay (#24052)', () => {
  it('strips an orphaned message itemId when the turn has no reasoning item', () => {
    const list = new MessageList();

    // A single memory-loaded assistant turn: text only, reasoning was not persisted.
    list.add(
      {
        id: 'mem-assistant-1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'Hello there.',
              providerMetadata: {
                openai: { itemId: 'msg_0bef001122334455667788990011' },
              },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:01Z'),
        threadId: 'thread-1',
      },
      'memory',
    );

    list.add({ role: 'user', content: 'Follow-up question.' }, 'input');

    const prompt = list.get.all.aiV5.prompt();
    const assistant = prompt.filter(m => m.role === 'assistant');
    const textParts = assistant
      .flatMap(m => (Array.isArray(m.content) ? m.content : []))
      .filter((p: any) => p.type === 'text');

    expect(textParts.length).toBeGreaterThan(0);
    expect((textParts[0] as any).providerOptions?.openai?.itemId).toBeUndefined();
  });

  it('preserves the message itemId when its reasoning partner is present in the same turn group', () => {
    const list = new MessageList();

    list.add({ role: 'user', content: 'Book a meeting with James tomorrow @ 9am' }, 'input');

    // Step 1: reasoning + tool call (separate memory message).
    list.add(
      {
        id: 'mem-assistant-1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: '' }],
              providerMetadata: {
                openai: { itemId: 'rs_001ba7b2523b3aed0069de7872a800', reasoningEncryptedContent: null },
              },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_book1',
                toolName: 'book_meeting',
                args: { person: 'James', time: 'tomorrow 9am' },
                result: { success: true },
              },
              providerMetadata: { openai: { itemId: 'fc_001ba7b2523b3aed0069de7872b900' } },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:01Z'),
        threadId: 'thread-1',
      },
      'memory',
    );

    // Step 2: text-only assistant message (not merged with step 1) — same turn group.
    list.add(
      {
        id: 'mem-assistant-2',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: "I've booked the meeting with James for tomorrow at 9am.",
              providerMetadata: { openai: { itemId: 'msg_001ba7b2523b3aed0069de7872c800' } },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:02Z'),
        threadId: 'thread-1',
      },
      'memory',
    );

    list.add({ role: 'user', content: 'Thanks!' }, 'input');

    const prompt = list.get.all.aiV5.prompt();
    const assistant = prompt.filter(m => m.role === 'assistant');
    const allParts = assistant.flatMap(m => (Array.isArray(m.content) ? m.content : []));

    const textPart = allParts.find((p: any) => p.type === 'text');
    expect((textPart as any)?.providerOptions?.openai?.itemId).toBe('msg_001ba7b2523b3aed0069de7872c800');

    const reasoningPart = allParts.find((p: any) => p.type === 'reasoning');
    expect((reasoningPart as any)?.providerOptions?.openai?.itemId).toBe('rs_001ba7b2523b3aed0069de7872a800');
  });
});
