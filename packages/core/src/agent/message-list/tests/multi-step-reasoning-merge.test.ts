/**
 * Tests that multi-step tool calling preserves reasoning items across steps.
 *
 * When reasoning text is empty (common with Azure OpenAI reasoning models),
 * the CacheKeyGenerator must use provider-agnostic itemId lookup to produce
 * distinct cache keys per step, and the AIV5Adapter must preserve empty
 * reasoning parts that carry providerMetadata.
 */
import { describe, it, expect } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

// Use realistic timestamps where user message comes first chronologically.
// This matters because MessageList sorts messages by createdAt after each add,
// which affects the shouldMerge logic (checks the last message in the sorted array).
const baseTime = Date.now();
const timestamps = {
  user: new Date(baseTime),
  step1: new Date(baseTime + 100),
  step1Result: new Date(baseTime + 200),
  step2: new Date(baseTime + 300),
  step2Result: new Date(baseTime + 400),
};

describe('Multi-step tool calling preserves reasoning items', () => {
  it('should preserve empty reasoning items with Azure providerMetadata across steps', () => {
    const messageList = new MessageList({ threadId: 'test-thread' });

    messageList.add(
      {
        id: 'user-msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Add 3 and 5, then multiply the result by 4.' }] },
        createdAt: timestamps.user,
      } as MastraDBMessage,
      'input',
    );

    // Step 1: empty reasoning with Azure itemId + tool-call
    messageList.add(
      {
        id: 'step1-msg',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [],
              providerMetadata: { azure: { itemId: 'rs_azure_step1' } },
            },
            {
              type: 'tool-invocation',
              toolInvocation: { toolCallId: 'call_add', toolName: 'add', state: 'call', args: { a: 3, b: 5 } },
            },
          ],
        },
        createdAt: timestamps.step1,
      } as MastraDBMessage,
      'response',
    );

    // Tool result for step 1
    messageList.add(
      {
        id: 'step1-result-msg',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_add',
                toolName: 'add',
                state: 'result',
                args: { a: 3, b: 5 },
                result: { result: 8 },
              },
            },
          ],
        },
        createdAt: timestamps.step1Result,
      } as MastraDBMessage,
      'response',
    );

    // Step 2: empty reasoning with DIFFERENT Azure itemId + tool-call
    messageList.add(
      {
        id: 'step2-msg',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'reasoning',
              reasoning: '',
              details: [],
              providerMetadata: { azure: { itemId: 'rs_azure_step2' } },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_multiply',
                toolName: 'multiply',
                state: 'call',
                args: { a: 8, b: 4 },
              },
            },
          ],
        },
        createdAt: timestamps.step2,
      } as MastraDBMessage,
      'response',
    );

    // Tool result for step 2
    messageList.add(
      {
        id: 'step2-result-msg',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call_multiply',
                toolName: 'multiply',
                state: 'result',
                args: { a: 8, b: 4 },
                result: { result: 32 },
              },
            },
          ],
        },
        createdAt: timestamps.step2Result,
      } as MastraDBMessage,
      'response',
    );

    const modelMessages = messageList.get.all.aiV5.model();
    const assistantMessages = modelMessages.filter(m => m.role === 'assistant');
    const toolMessages = modelMessages.filter(m => m.role === 'tool');

    // EXPECTED: 2 assistant + 2 tool messages (one pair per step)
    expect(assistantMessages).toHaveLength(2);
    expect(toolMessages).toHaveLength(2);

    // Each assistant message must have its own reasoning item
    for (const msg of assistantMessages) {
      const hasReasoning = Array.isArray(msg.content) && msg.content.some((p: any) => p.type === 'reasoning');
      expect(hasReasoning).toBe(true);
    }

    // Total reasoning items across all model messages must be 2
    const allReasoningParts = modelMessages.flatMap(m =>
      Array.isArray(m.content) ? m.content.filter((p: any) => p.type === 'reasoning') : [],
    );
    expect(allReasoningParts).toHaveLength(2);
  });
});
