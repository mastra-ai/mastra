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
 * Creates a mock model that simulates OpenAI reasoning model responses where
 * BOTH the reasoning part AND the text part have their own providerMetadata with itemIds.
 * This matches the actual OpenAI behavior where:
 * - reasoning has itemId: "rs_xxx"
 * - text has itemId: "msg_xxx"
 */
function createReasoningMockModelWithTextItemId(reasoningItemId: string, textItemId: string) {
  return new MockLanguageModelV2({
    doGenerate: async () =>
      ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'reasoning',
            text: 'Let me think about this step by step...',
            // AI SDK doGenerate returns providerMetadata (not providerOptions)
            providerMetadata: {
              openai: {
                itemId: reasoningItemId,
                reasoningEncryptedContent: null,
              },
            },
          },
          {
            type: 'text',
            text: 'The answer is 4.',
            // AI SDK doGenerate returns providerMetadata (not providerOptions)
            providerMetadata: {
              openai: {
                itemId: textItemId,
              },
            },
          },
        ],
        warnings: [],
      }) as any,
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
        // Text parts with their OWN providerMetadata (msg_ itemId)
        // This is the key difference from the previous test - OpenAI sends msg_ for text
        {
          type: 'text-start',
          id: 'text-1',
          providerMetadata: {
            openai: {
              itemId: textItemId,
            },
          },
        },
        // Note: text-delta and text-end typically don't have providerMetadata
        { type: 'text-delta', id: 'text-1', delta: 'The answer is 4.' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ] as any),
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
   * When OpenAI sends text-start with its own providerMetadata (containing msg_ itemId),
   * the text part should capture this metadata - NOT lose it.
   *
   * The bug: text-start's providerMetadata is not captured into runState.providerOptions.
   * When reasoning-end clears providerOptions, the subsequent text flush doesn't have
   * any providerMetadata to use, causing the stored text part to miss the msg_ itemId.
   *
   * @see https://github.com/mastra-ai/mastra/issues/11481
   */
  it('should capture text-start providerMetadata for text parts (issue #11481)', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-1234';
    const reasoningItemId = 'rs_test123456789';
    const textItemId = 'msg_test987654321'; // The itemId that OpenAI sends with text-start

    const mockMemory = new MockMemory();
    const model = createReasoningMockModelWithTextItemId(reasoningItemId, textItemId);

    const agent = new Agent({
      id: 'reasoning-memory-test-11481',
      name: 'Reasoning Memory Test #11481',
      instructions: 'You are a helpful assistant.',
      model,
      memory: mockMemory,
    });

    const resp = await agent.stream('What is 2+2?', {
      threadId,
      resourceId,
    });

    await resp.consumeStream();

    // Get the stored messages
    const dbMessages = resp.messageList.get.all.db();

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

    // Reasoning part SHOULD have the reasoning providerMetadata (rs_xxx)
    expect(reasoningPart!.providerMetadata?.openai?.itemId).toBe(reasoningItemId);

    // Text part SHOULD have its OWN providerMetadata (msg_xxx) - NOT undefined, NOT rs_xxx
    // This is the key assertion for issue #11481
    expect(textPart!.providerMetadata?.openai?.itemId).toBe(textItemId);
  });

  /**
   * Full integration test for issue #11481:
   * First call with reasoning (rs_xxx) and text (msg_xxx) itemIds,
   * second call recalls from memory and should NOT fail.
   *
   * @see https://github.com/mastra-ai/mastra/issues/11481
   */
  it('should handle follow-up messages with both reasoning and text itemIds (issue #11481)', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-1234';
    const reasoningItemId = 'rs_test123456789';
    const textItemId = 'msg_test987654321';

    const mockMemory = new MockMemory();
    const reasoningModel = createReasoningMockModelWithTextItemId(reasoningItemId, textItemId);
    const simpleModel = createSimpleMockModel();

    // First agent call with reasoning model
    const agent1 = new Agent({
      id: 'reasoning-memory-test-11481',
      name: 'Reasoning Memory Test #11481',
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

    // Verify the stored message has correct providerMetadata
    const dbMessages = resp1.messageList.get.all.db();
    const assistantMsg = dbMessages.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();

    const reasoningPart = assistantMsg!.content.parts.find(p => p.type === 'reasoning');
    const textPart = assistantMsg!.content.parts.find(p => p.type === 'text');

    expect(reasoningPart?.providerMetadata?.openai?.itemId).toBe(reasoningItemId);
    expect(textPart?.providerMetadata?.openai?.itemId).toBe(textItemId);

    // Second agent call - uses same memory, should recall previous messages
    const agent2 = new Agent({
      id: 'reasoning-memory-test-11481',
      name: 'Reasoning Memory Test #11481',
      instructions: 'You are a helpful assistant.',
      model: simpleModel,
      memory: mockMemory,
    });

    // Second request - this should NOT fail with "reasoning item without required following item"
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
    // "Item 'rs_xxx' of type 'reasoning' was provided without its required following item"
    let text2 = '';
    for await (const chunk of resp2.textStream) {
      text2 += chunk;
    }

    expect(text2).toBe('Hello! How can I help you?');
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

  /**
   * Test using agent.generate() instead of agent.stream() to match the reproduction code.
   *
   * @see https://github.com/mastra-ai/mastra/issues/11481
   */
  it('should capture text providerMetadata when using generate() (issue #11481)', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-1234';
    const reasoningItemId = 'rs_test123456789';
    const textItemId = 'msg_test987654321';

    const mockMemory = new MockMemory();
    const reasoningModel = createReasoningMockModelWithTextItemId(reasoningItemId, textItemId);
    const simpleModel = createSimpleMockModel();

    // First agent call with reasoning model using generate()
    const agent1 = new Agent({
      id: 'reasoning-memory-test-generate',
      name: 'Reasoning Memory Test Generate',
      instructions: 'You are a helpful assistant.',
      model: reasoningModel,
      memory: mockMemory,
    });

    // First request with generate()
    const resp1 = await agent1.generate('What is 2+2?', {
      threadId,
      resourceId,
    });

    // Verify the text part has the correct providerMetadata
    // The step.content uses AI SDK format with providerOptions
    const step1Content = resp1.steps[0]?.content || [];
    const textContent = step1Content.find((c: { type: string }) => c.type === 'text') as
      | {
          type: string;
          providerOptions?: { openai?: { itemId?: string } };
        }
      | undefined;
    const reasoningContent = step1Content.find((c: { type: string }) => c.type === 'reasoning') as
      | {
          type: string;
          providerOptions?: { openai?: { itemId?: string } };
        }
      | undefined;

    // Note: The content array uses providerOptions (AI SDK format)
    // Reasoning should have rs_ itemId
    expect(reasoningContent?.providerOptions?.openai?.itemId).toBe(reasoningItemId);
    // Text should have msg_ itemId - THIS IS THE KEY ASSERTION FOR ISSUE #11481
    expect(textContent?.providerOptions?.openai?.itemId).toBe(textItemId);

    // Second agent call using generate() - should NOT fail
    const agent2 = new Agent({
      id: 'reasoning-memory-test-generate',
      name: 'Reasoning Memory Test Generate',
      instructions: 'You are a helpful assistant.',
      model: simpleModel,
      memory: mockMemory,
    });

    // Second request - this should NOT fail
    const resp2 = await agent2.generate('Hello', {
      memory: {
        thread: threadId,
        resource: resourceId,
        options: {
          lastMessages: 10,
        },
      },
    });

    expect(resp2.text).toBe('Hello! How can I help you?');
  });
});
