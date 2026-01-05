/**
 * Reasoning + Memory Integration Tests
 *
 * Tests for GitHub issue #11103:
 * OpenAI reasoning models fail with "reasoning item without required following item"
 *
 * When sending a message in a thread that contains a reasoning part followed by a text part,
 * the second request fails because OpenAI requires that when a reasoning item has an `id` field,
 * the following assistant message must also have a matching `id` field to link them together.
 *
 * The bug was that reasoning providerMetadata (containing openai.itemId) was leaking into
 * subsequent text parts because runState.providerOptions wasn't being reset after reasoning-end.
 *
 * @see https://github.com/mastra-ai/mastra/issues/11103
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

/**
 * Creates a mock model that simulates OpenAI reasoning model responses.
 * The model returns reasoning with providerMetadata containing itemId (like rs_xxx),
 * followed by text content.
 */
function createReasoningMockModel(reasoningItemId: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [
        {
          type: 'reasoning',
          text: 'Let me think about this step by step...',
          providerOptions: {
            openai: {
              itemId: reasoningItemId,
              reasoningEncryptedContent: null,
            },
          },
        },
        {
          type: 'text',
          text: 'The answer is 4.',
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
          modelId: 'mock-reasoning-model',
          timestamp: new Date(0),
        },
        // Reasoning parts with OpenAI-style providerMetadata
        {
          type: 'reasoning-start',
          id: 'reasoning-1',
          providerMetadata: {
            openai: {
              itemId: reasoningItemId,
              reasoningEncryptedContent: null,
            },
          },
        },
        {
          type: 'reasoning-delta',
          id: 'reasoning-1',
          delta: 'Let me think about this step by step...',
          providerMetadata: {
            openai: {
              itemId: reasoningItemId,
              reasoningEncryptedContent: null,
            },
          },
        },
        {
          type: 'reasoning-end',
          id: 'reasoning-1',
          providerMetadata: {
            openai: {
              itemId: reasoningItemId,
              reasoningEncryptedContent: null,
            },
          },
        },
        // Text parts should NOT have reasoning's providerMetadata
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'The answer is 4.' },
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

/**
 * Creates a simple mock model for the follow-up request.
 */
function createSimpleMockModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [
        {
          type: 'text',
          text: 'Hello! How can I help you?',
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
          id: 'response-2',
          modelId: 'mock-simple-model',
          timestamp: new Date(0),
        },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello! How can I help you?' },
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

describe('Reasoning + Memory Integration', () => {
  /**
   * This test verifies that reasoning providerMetadata (containing openai.itemId)
   * does NOT leak into subsequent text parts.
   *
   * The bug: runState.providerOptions was set from reasoning chunks and never cleared,
   * causing text parts to inherit reasoning's providerMetadata with itemId: "rs_xxx".
   * When these messages were recalled from memory and sent back to OpenAI, the text
   * part had an rs_ ID which OpenAI rejected (expecting msg_ for assistant messages).
   */
  it('should not leak reasoning providerMetadata into text parts', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-1234';
    const reasoningItemId = 'rs_test123456789';

    const mockMemory = new MockMemory();
    const reasoningModel = createReasoningMockModel(reasoningItemId);

    // First agent call with reasoning model
    const agent1 = new Agent({
      id: 'reasoning-memory-test',
      name: 'Reasoning Memory Test',
      instructions: 'You are a helpful assistant.',
      model: reasoningModel,
      memory: mockMemory,
    });

    // First request with reasoning
    const resp1 = await agent1.stream('What is 2+2?', {
      threadId,
      resourceId,
    });

    await resp1.consumeStream();

    // Get the stored messages
    const dbMessages = resp1.messageList.get.all.db();

    // Find the assistant message
    const assistantMessage = dbMessages.find(m => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();

    // Check the parts
    const parts = assistantMessage!.content.parts;
    expect(parts.length).toBeGreaterThanOrEqual(2);

    // Find reasoning and text parts
    const reasoningPart = parts.find(p => p.type === 'reasoning');
    const textPart = parts.find(p => p.type === 'text');

    expect(reasoningPart).toBeDefined();
    expect(textPart).toBeDefined();

    // Reasoning part SHOULD have the providerMetadata with itemId
    expect(reasoningPart!.providerMetadata?.openai?.itemId).toBe(reasoningItemId);

    // Text part should NOT have the reasoning's providerMetadata
    // This is the key assertion - before the fix, this would fail
    expect(textPart!.providerMetadata?.openai?.itemId).toBeUndefined();
  });

  /**
   * Full integration test: first call with reasoning, second call recalls from memory.
   * The second call should not fail due to mismatched IDs.
   */
  it('should handle follow-up messages after reasoning response with memory', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-1234';
    const reasoningItemId = 'rs_test123456789';

    const mockMemory = new MockMemory();
    const reasoningModel = createReasoningMockModel(reasoningItemId);
    const simpleModel = createSimpleMockModel();

    // First agent call with reasoning model
    const agent1 = new Agent({
      id: 'reasoning-memory-test',
      name: 'Reasoning Memory Test',
      instructions: 'You are a helpful assistant.',
      model: reasoningModel,
      memory: mockMemory,
    });

    // First request with reasoning
    const resp1 = await agent1.stream('What is 2+2?', {
      threadId,
      resourceId,
    });

    await resp1.consumeStream();

    // Verify reasoning was captured
    const reasoning = await resp1.reasoning;
    expect(reasoning).toBeDefined();
    expect(reasoning.length).toBeGreaterThan(0);

    // Second agent call - uses same memory, should recall previous messages
    const agent2 = new Agent({
      id: 'reasoning-memory-test',
      name: 'Reasoning Memory Test',
      instructions: 'You are a helpful assistant.',
      model: simpleModel,
      memory: mockMemory,
    });

    // Second request - this should NOT fail
    const resp2 = await agent2.stream('Hello', {
      memory: {
        thread: threadId,
        resource: resourceId,
        options: {
          lastMessages: 10,
        },
      },
    });

    // Consume the stream - before the fix this would fail with:
    // "Invalid 'input[3].id': 'rs_xxx'. Expected an ID that begins with 'msg'."
    let text2 = '';
    for await (const chunk of resp2.textStream) {
      text2 += chunk;
    }

    expect(text2).toBe('Hello! How can I help you?');
  });
});
