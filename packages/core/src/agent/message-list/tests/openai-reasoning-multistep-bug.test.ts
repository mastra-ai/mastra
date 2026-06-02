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

  it('should not duplicate OpenAI provider tool-call response item ids when persisted history is replayed on the next turn', () => {
    const duplicateToolCallItemId = 'fc_0bdc537ceaa1bb34006a1ea21248108197b5db6c60dd4f4d77';
    const list = new MessageList();

    list.add(
      {
        id: 'mem-user-tool-search',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Search the web for Mastra updates.' }] },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        threadId: 'thread-duplicate-fc',
      },
      'memory',
    );

    list.add(
      {
        id: 'mem-assistant-tool-1',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_search_1',
                toolName: 'web_search_preview',
                args: { query: 'Mastra updates' },
                result: { results: [{ title: 'Mastra updates' }] },
              },
              providerExecuted: true,
              providerMetadata: {
                openai: {
                  itemId: duplicateToolCallItemId,
                },
              },
            },
            {
              type: 'text',
              text: 'I searched for Mastra updates.',
              providerMetadata: {
                openai: {
                  itemId: 'msg_after_first_tool_call',
                },
              },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:01Z'),
        threadId: 'thread-duplicate-fc',
      },
      'memory',
    );

    list.add(
      {
        id: 'mem-assistant-tool-2',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_search_1',
                toolName: 'web_search_preview',
                args: { query: 'Mastra updates' },
                result: { results: [{ title: 'Mastra updates' }] },
              },
              providerExecuted: true,
              providerMetadata: {
                openai: {
                  itemId: duplicateToolCallItemId,
                },
              },
            },
            {
              type: 'text',
              text: 'The search found recent Responses API notes.',
              providerMetadata: {
                openai: {
                  itemId: 'msg_after_duplicate_tool_call',
                },
              },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:02Z'),
        threadId: 'thread-duplicate-fc',
      },
      'memory',
    );

    list.add({ role: 'user', content: 'Can you continue from that?' }, 'input');

    const prompt = list.get.all.aiV5.prompt();
    const assistantParts = prompt.flatMap(message =>
      message.role === 'assistant' && Array.isArray(message.content) ? message.content : [],
    );
    const toolCallItemIds = assistantParts
      .filter((part: any) => part.type === 'tool-call')
      .map((part: any) => part.providerOptions?.openai?.itemId)
      .filter(Boolean);

    expect(toolCallItemIds).toContain(duplicateToolCallItemId);
    expect(toolCallItemIds.filter(itemId => itemId === duplicateToolCallItemId)).toHaveLength(1);
  });

  it('should not duplicate OpenAI reasoning response item ids when persisted history is replayed on the next turn', () => {
    const duplicateReasoningItemId = 'rs_024f66eee433e506006a1e8beb18308190a6d6e394596f7bed';
    const list = new MessageList();

    list.add(
      {
        id: 'mem-user-search',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Search for the latest Mastra release notes.' }] },
        createdAt: new Date('2024-01-01T00:00:00Z'),
        threadId: 'thread-duplicate-rs',
      },
      'memory',
    );

    list.add(
      {
        id: 'mem-assistant-reasoning-1',
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
                  itemId: duplicateReasoningItemId,
                  reasoningEncryptedContent: null,
                },
              },
            },
            {
              type: 'text',
              text: 'I found the release notes.',
              providerMetadata: {
                openai: {
                  itemId: 'msg_024f66eee433e506006a1e8beb18308190a6d6e394596f7bed',
                },
              },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:01Z'),
        threadId: 'thread-duplicate-rs',
      },
      'memory',
    );

    list.add(
      {
        id: 'mem-assistant-reasoning-2',
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
                  itemId: duplicateReasoningItemId,
                  reasoningEncryptedContent: null,
                },
              },
            },
            {
              type: 'text',
              text: 'The release notes mention the Responses API changes.',
              providerMetadata: {
                openai: {
                  itemId: 'msg_after_duplicate_reasoning',
                },
              },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:02Z'),
        threadId: 'thread-duplicate-rs',
      },
      'memory',
    );

    list.add({ role: 'user', content: 'Can you continue from that?' }, 'input');

    const prompt = list.get.all.aiV5.prompt();
    const assistantParts = prompt.flatMap(message =>
      message.role === 'assistant' && Array.isArray(message.content) ? message.content : [],
    );
    const reasoningItemIds = assistantParts
      .filter((part: any) => part.type === 'reasoning')
      .map((part: any) => part.providerOptions?.openai?.itemId)
      .filter(Boolean);

    expect(reasoningItemIds).toContain(duplicateReasoningItemId);
    expect(reasoningItemIds.filter(itemId => itemId === duplicateReasoningItemId)).toHaveLength(1);
  });
});
