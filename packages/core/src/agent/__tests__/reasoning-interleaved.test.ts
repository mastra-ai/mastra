/**
 * Reasoning with Interleaved Chunks Tests
 *
 * Tests for GitHub issue #11480:
 * When reasoning-end is received after text-start, reasoning content is lost.
 *
 * Some model providers (like ZAI/glm-4.6) return chunks in this order:
 *   step-start → reasoning-start → reasoning-delta → text-start → reasoning-end → text-end
 *
 * The bug: When text-start arrives while isReasoning is true, the code clears
 * reasoningDeltas before reasoning-end has a chance to save them to the message.
 *
 * @see https://github.com/mastra-ai/mastra/issues/11480
 */

import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

/**
 * Creates a mock model that simulates providers where text-start arrives before reasoning-end.
 * This is the exact chunk order reported in the issue:
 *   step-start → reasoning-start → reasoning-delta → text-start → reasoning-end → text-end
 */
function createInterleavedReasoningMockModel(reasoningText: string, responseText: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [
        {
          type: 'reasoning',
          text: reasoningText,
        },
        {
          type: 'text',
          text: responseText,
        },
      ],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        {
          type: 'stream-start',
          warnings: [],
        },
        {
          type: 'response-metadata',
          id: 'response-1',
          modelId: 'mock-interleaved-model',
          timestamp: new Date(0),
        },
        // Reasoning starts
        {
          type: 'reasoning-start',
          id: 'reasoning-1',
        },
        // Reasoning delta with actual content
        {
          type: 'reasoning-delta',
          id: 'reasoning-1',
          delta: reasoningText,
        },
        // TEXT-START ARRIVES BEFORE REASONING-END
        // This is the key sequence that triggers the bug
        { type: 'text-start', id: 'text-1' },
        // Now reasoning ends (AFTER text-start)
        {
          type: 'reasoning-end',
          id: 'reasoning-1',
        },
        // Text content
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
    }),
  });
}

describe('Reasoning with Interleaved Chunks (Issue #11480)', () => {
  /**
   * This test verifies that reasoning content is preserved even when
   * text-start arrives before reasoning-end.
   *
   * The bug: reasoningDeltas were being cleared when text-start arrived
   * (because it's not in the exclusion list at lines 115-128 in llm-execution-step.ts)
   * before reasoning-end could save them to the message.
   */
  it('should preserve reasoning content when text-start arrives before reasoning-end', async () => {
    const reasoningText = 'Let me think about the capital of France. Paris is the capital and largest city of France.';
    const responseText = 'The capital of France is Paris.';

    const model = createInterleavedReasoningMockModel(reasoningText, responseText);

    const agent = new Agent({
      id: 'interleaved-reasoning-test',
      name: 'Interleaved Reasoning Test',
      instructions: 'You are a helpful assistant.',
      model,
    });

    const response = await agent.stream('Where is the capital of France?');

    // Consume the stream
    await response.consumeStream();

    // Get the stored messages
    const dbMessages = response.messageList.get.all.db();

    // Find the assistant message
    const assistantMessages = dbMessages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    // Collect all parts from all assistant messages
    const allParts = assistantMessages.flatMap(m => m.content.parts);

    // Find reasoning and text parts
    const reasoningPart = allParts.find(p => p.type === 'reasoning');
    const textPart = allParts.find(p => p.type === 'text');

    // Both parts should exist
    expect(reasoningPart).toBeDefined();
    expect(textPart).toBeDefined();

    // Text should be correct
    expect(textPart!.text).toBe(responseText);

    // THIS IS THE KEY ASSERTION
    // Before the fix, the reasoning details would be empty because
    // reasoningDeltas were cleared when text-start arrived
    expect(reasoningPart!.details).toBeDefined();
    expect(reasoningPart!.details.length).toBeGreaterThan(0);
    expect(reasoningPart!.details[0].type).toBe('text');
    // Type guard to access text property
    const detail = reasoningPart!.details[0];
    expect(detail.type).toBe('text');
    if (detail.type === 'text') {
      expect(detail.text).toBe(reasoningText);
    }
  });

  /**
   * Test that the reasoning accessor also returns the correct content
   */
  it('should return reasoning via the reasoning accessor when chunks are interleaved', async () => {
    const reasoningText = 'Thinking about this question carefully...';
    const responseText = 'Here is my answer.';

    const model = createInterleavedReasoningMockModel(reasoningText, responseText);

    const agent = new Agent({
      id: 'interleaved-reasoning-accessor-test',
      name: 'Interleaved Reasoning Accessor Test',
      instructions: 'You are a helpful assistant.',
      model,
    });

    const response = await agent.stream('Test question');

    // Consume the stream
    await response.consumeStream();

    // Get reasoning via accessor
    const reasoning = await response.reasoning;

    // Reasoning should be captured (the accessor returns an array of reasoning parts)
    expect(reasoning).toBeDefined();
    expect(reasoning.length).toBeGreaterThan(0);

    // Verify reasoning content via messageList (more direct verification)
    const dbMessages = response.messageList.get.all.db();
    const assistantMessages = dbMessages.filter(m => m.role === 'assistant');
    const allParts = assistantMessages.flatMap(m => m.content.parts);
    const reasoningPart = allParts.find(p => p.type === 'reasoning');

    expect(reasoningPart).toBeDefined();
    expect(reasoningPart!.details).toBeDefined();
    expect(reasoningPart!.details.length).toBeGreaterThan(0);

    const detail = reasoningPart!.details[0];
    if (detail.type === 'text') {
      expect(detail.text).toBe(reasoningText);
    }
  });

  /**
   * Test with multiple reasoning deltas before text-start
   */
  it('should preserve all reasoning deltas when text-start arrives mid-reasoning', async () => {
    const reasoningParts = [
      'First, I need to consider...',
      'Then, looking at the facts...',
      'Finally, the conclusion is...',
    ];
    const responseText = 'The answer is 42.';

    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'reasoning',
            text: reasoningParts.join(''),
          },
          {
            type: 'text',
            text: responseText,
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'stream-start',
            warnings: [],
          },
          {
            type: 'response-metadata',
            id: 'response-1',
            modelId: 'mock-multi-delta-model',
            timestamp: new Date(0),
          },
          // Reasoning starts
          { type: 'reasoning-start', id: 'reasoning-1' },
          // Multiple reasoning deltas
          { type: 'reasoning-delta', id: 'reasoning-1', delta: reasoningParts[0] },
          { type: 'reasoning-delta', id: 'reasoning-1', delta: reasoningParts[1] },
          { type: 'reasoning-delta', id: 'reasoning-1', delta: reasoningParts[2] },
          // TEXT-START BEFORE REASONING-END
          { type: 'text-start', id: 'text-1' },
          // Reasoning ends after text-start
          { type: 'reasoning-end', id: 'reasoning-1' },
          // Text content
          { type: 'text-delta', id: 'text-1', delta: responseText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      id: 'multi-delta-reasoning-test',
      name: 'Multi Delta Reasoning Test',
      instructions: 'You are a helpful assistant.',
      model,
    });

    const response = await agent.stream('Complex question');
    await response.consumeStream();

    const dbMessages = response.messageList.get.all.db();
    const assistantMessages = dbMessages.filter(m => m.role === 'assistant');
    const allParts = assistantMessages.flatMap(m => m.content.parts);

    const reasoningPart = allParts.find(p => p.type === 'reasoning');

    expect(reasoningPart).toBeDefined();
    expect(reasoningPart!.details).toBeDefined();
    expect(reasoningPart!.details.length).toBeGreaterThan(0);

    // All reasoning deltas should be preserved and concatenated
    const detail = reasoningPart!.details[0];
    expect(detail.type).toBe('text');
    if (detail.type === 'text') {
      expect(detail.text).toBe(reasoningParts.join(''));
    }
  });
});
