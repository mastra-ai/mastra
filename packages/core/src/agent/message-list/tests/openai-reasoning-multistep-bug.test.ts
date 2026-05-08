import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';

/**
 * Reproduces the exact bug from the "Observational Memory Agent" error:
 *   "Item 'msg_*' of type 'message' was provided without its required 'reasoning' item"
 *
 * Root cause: When messages come from memory (source='memory'), MessageList does NOT merge
 * consecutive assistant messages. The old stripping code computed hasOpenAIReasoning per-message,
 * so a text-only assistant message (no reasoning parts) kept its msg_* itemId intact.
 * The SDK then sent item_reference for that msg_*, but the paired rs_* reasoning was stripped
 * from the earlier message.
 *
 * The fix: stop stripping reasoning entirely. With v3 providers, reasoning items are handled
 * natively. With v5 providers, preserving the pairing is still correct — the SDK sends
 * item_reference for all items and OpenAI resolves them server-side.
 */
describe('OpenAI reasoning — memory-loaded multi-step conversations', () => {
  it('should preserve reasoning and itemIds when memory messages are not merged', () => {
    const list = new MessageList();

    // Simulate loading messages from memory (DB) — source='memory' prevents merging
    list.add(
      {
        id: 'mem-user1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Book a meeting with James tomorrow @ 9am' }] },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        threadId: 'thread-1',
      },
      'memory',
    );

    // Step 1: Assistant reasons + calls a tool (from memory — separate message)
    list.add(
      {
        id: 'mem-assistant1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [{ type: 'text', text: '' }],
              providerMetadata: {
                openai: {
                  itemId: 'rs_001ba7b2523b3aed0069de7872a800',
                  reasoningEncryptedContent: null,
                },
              },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_book1',
                toolName: 'book_meeting',
                args: { person: 'James', time: 'tomorrow 9am' },
                result: { success: true, meetingId: 'mtg_123' },
              },
              providerMetadata: {
                openai: {
                  itemId: 'fc_001ba7b2523b3aed0069de7872b900',
                },
              },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:01Z'),
        threadId: 'thread-1',
      },
      'memory',
    );

    // Step 2: Assistant text response (from memory — NOT merged with step 1!)
    list.add(
      {
        id: 'mem-assistant2',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: "I've booked the meeting with James for tomorrow at 9am.",
              providerMetadata: {
                openai: {
                  itemId: 'msg_001ba7b2523b3aed0069de7872c800',
                },
              },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:02Z'),
        threadId: 'thread-1',
      },
      'memory',
    );

    // New user message (current turn)
    list.add({ role: 'user', content: 'Thanks! Also book lunch with Sarah.' }, 'input');

    // Verify messages were NOT merged (the bug prerequisite)
    const dbMessages = list.get.all.db();
    const assistantDbMsgs = dbMessages.filter(m => m.role === 'assistant');
    expect(assistantDbMsgs.length).toBe(2);

    // Get the prompt
    const prompt = list.get.all.aiV5.prompt();

    // The text-only assistant message must retain its itemId
    const assistantPromptMsgs = prompt.filter(m => m.role === 'assistant');
    const lastAssistant = assistantPromptMsgs[assistantPromptMsgs.length - 1];
    expect(Array.isArray(lastAssistant.content)).toBe(true);

    const textParts = (lastAssistant.content as any[]).filter((p: any) => p.type === 'text');
    expect(textParts.length).toBeGreaterThan(0);
    expect(textParts[0].providerOptions?.openai?.itemId).toBe('msg_001ba7b2523b3aed0069de7872c800');

    // Reasoning must be preserved in the first assistant message (the pairing partner)
    const allParts = assistantPromptMsgs.flatMap(m => (Array.isArray(m.content) ? m.content : []));
    const reasoningParts = allParts.filter((p: any) => p.type === 'reasoning');
    expect(reasoningParts.length).toBeGreaterThan(0);
    expect(reasoningParts[0].providerOptions?.openai?.itemId).toBe('rs_001ba7b2523b3aed0069de7872a800');
  });
});
