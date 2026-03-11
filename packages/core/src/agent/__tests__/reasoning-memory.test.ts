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

  /**
   * Test that text-end properly clears providerOptions to prevent leaking.
   *
   * This ensures that when we have multiple message parts (e.g., text followed by tool call),
   * the text's providerMetadata doesn't leak into the subsequent part.
   */
  it('should clear text providerMetadata after text-end to prevent leaking', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-1234';
    const textItemId = 'msg_text123';

    // Create a model that sends text with providerMetadata, then a tool call
    const model = new MockLanguageModelV2({
      doGenerate: async () =>
        ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'text',
              text: 'Let me check that for you.',
              providerMetadata: {
                openai: {
                  itemId: textItemId,
                },
              },
            },
            {
              type: 'tool-call' as const,
              toolCallId: 'call_123',
              toolName: 'test_tool',
              args: {},
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
            modelId: 'mock-model',
            timestamp: new Date(0),
          },
          // Text with providerMetadata
          {
            type: 'text-start',
            id: 'text-1',
            providerMetadata: {
              openai: {
                itemId: textItemId,
              },
            },
          },
          { type: 'text-delta', id: 'text-1', delta: 'Let me check that for you.' },
          { type: 'text-end', id: 'text-1' }, // This should clear providerOptions
          // Tool call should NOT have text's providerMetadata
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'test_tool',
            args: {},
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ] as any),
      }),
    });

    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'text-end-cleanup-test',
      name: 'Text End Cleanup Test',
      instructions: 'Test agent',
      model,
      memory: mockMemory,
    });

    const resp = await agent.stream('Test message', {
      threadId,
      resourceId,
    });

    await resp.consumeStream();

    // Get stored messages
    const dbMessages = resp.messageList.get.all.db();
    const assistantMessage = dbMessages.find(m => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();

    const parts = assistantMessage!.content.parts;

    // Find text and tool-call parts
    const textPart = parts.find(p => p.type === 'text');
    const toolCallPart = parts.find(p => p.type === 'tool-invocation');

    expect(textPart).toBeDefined();
    expect(toolCallPart).toBeDefined();

    // Text part should have its providerMetadata
    expect(textPart!.providerMetadata?.openai?.itemId).toBe(textItemId);

    // Tool call part should NOT have text's providerMetadata
    // (it should either have its own or none at all)
    if (toolCallPart!.providerMetadata?.openai?.itemId) {
      expect(toolCallPart!.providerMetadata.openai.itemId).not.toBe(textItemId);
    }
  });

  /**
   * Test the full cleanup cycle with reasoning → text.
   *
   * This verifies that:
   * 1. reasoning-end clears reasoning providerMetadata
   * 2. text-start captures text providerMetadata
   * 3. text-end clears text providerMetadata
   * So neither reasoning nor text metadata leaks into subsequent parts.
   */
  it('should properly clean up providerMetadata through reasoning → text → tool call sequence', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-1234';
    const reasoningItemId = 'rs_reasoning123';
    const textItemId = 'msg_text123';

    // Create a model that sends: reasoning → text → tool call
    const model = new MockLanguageModelV2({
      doGenerate: async () =>
        ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'reasoning',
              text: 'Let me think...',
              providerMetadata: {
                openai: {
                  itemId: reasoningItemId,
                  reasoningEncryptedContent: null,
                },
              },
            },
            {
              type: 'text',
              text: 'I need to check that.',
              providerMetadata: {
                openai: {
                  itemId: textItemId,
                },
              },
            },
            {
              type: 'tool-call' as const,
              toolCallId: 'call_123',
              toolName: 'test_tool',
              args: {},
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
          // Reasoning with its providerMetadata
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
            delta: 'Let me think...',
          },
          {
            type: 'reasoning-end',
            id: 'reasoning-1',
          }, // Should clear providerOptions (reasoning metadata)
          // Text with its OWN providerMetadata
          {
            type: 'text-start',
            id: 'text-1',
            providerMetadata: {
              openai: {
                itemId: textItemId,
              },
            },
          }, // Should capture text metadata
          { type: 'text-delta', id: 'text-1', delta: 'I need to check that.' },
          { type: 'text-end', id: 'text-1' }, // Should clear providerOptions (text metadata)
          // Tool call should NOT have either reasoning or text providerMetadata
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'test_tool',
            args: {},
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ] as any),
      }),
    });

    const mockMemory = new MockMemory();
    const agent = new Agent({
      id: 'full-cleanup-test',
      name: 'Full Cleanup Test',
      instructions: 'Test agent',
      model,
      memory: mockMemory,
    });

    const resp = await agent.stream('Test message', {
      threadId,
      resourceId,
    });

    await resp.consumeStream();

    // Get stored messages
    const dbMessages = resp.messageList.get.all.db();
    const assistantMessages = dbMessages.filter(m => m.role === 'assistant');

    // Should have 2 assistant messages: one for reasoning, one for text+tool
    expect(assistantMessages.length).toBeGreaterThanOrEqual(1);

    // Collect all parts from all assistant messages
    const allParts = assistantMessages.flatMap(msg => msg.content.parts);

    // Find each type of part
    const reasoningPart = allParts.find(p => p.type === 'reasoning');
    const textPart = allParts.find(p => p.type === 'text');
    const toolCallPart = allParts.find(p => p.type === 'tool-invocation');

    expect(reasoningPart).toBeDefined();
    expect(textPart).toBeDefined();
    expect(toolCallPart).toBeDefined();

    // Reasoning part should have reasoning providerMetadata (rs_xxx)
    expect(reasoningPart!.providerMetadata?.openai?.itemId).toBe(reasoningItemId);

    // Text part should have text providerMetadata (msg_xxx), NOT reasoning's
    expect(textPart!.providerMetadata?.openai?.itemId).toBe(textItemId);
    expect(textPart!.providerMetadata?.openai?.itemId).not.toBe(reasoningItemId);

    // Tool call part should NOT have either reasoning or text providerMetadata
    if (toolCallPart!.providerMetadata?.openai?.itemId) {
      expect(toolCallPart!.providerMetadata.openai.itemId).not.toBe(reasoningItemId);
      expect(toolCallPart!.providerMetadata.openai.itemId).not.toBe(textItemId);
    }
  });
});

/**
 * Spy Tests: Compare LLM Response Output vs Next Request Input
 *
 * These tests use MockLanguageModelV2.doStreamCalls to spy on what the model
 * receives on the second call, and compare it with what the first call returned.
 * This reveals exactly what reasoning data survives the conversion pipeline:
 * MastraDBMessage → UIMessage → ModelMessage → LanguageModelV2Prompt
 *
 * @see https://github.com/mastra-ai/mastra/issues/12980
 */
describe('Reasoning Data Spy: Response vs Request Comparison (Issue #12980)', () => {
  /**
   * OpenAI reasoning with rs_ and msg_ item IDs through round-trip.
   *
   * OpenAI gpt-5.2 produces reasoning parts with providerMetadata.openai.itemId (rs_*)
   * and text parts with their own itemId (msg_*). When replayed as conversation history,
   * these cause fatal errors because the Responses API enforces mandatory pairing:
   *   - "Item 'rs_*' of type 'reasoning' was provided without its required following item"
   *   - "Item 'msg_*' of type 'message' was provided without its required 'reasoning' item"
   *
   * The fix strips reasoning parts AND clears providerMetadata.openai from text parts
   * so the SDK sends inline content instead of item_reference.
   */
  it('should strip OpenAI reasoning and providerMetadata through round-trip', async () => {
    const threadId = randomUUID();
    const resourceId = 'user-spy-openai';
    const reasoningItemId = 'rs_spy_reasoning_123';
    const textItemId = 'msg_spy_text_456';

    // Turn 1: OpenAI-style model returns reasoning (rs_*) + text (msg_*)
    const openaiModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'response-1', modelId: 'gpt-5.2', timestamp: new Date(0) },
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
            delta: 'Let me think step by step...',
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
          {
            type: 'text-start',
            id: 'text-1',
            providerMetadata: {
              openai: {
                itemId: textItemId,
              },
            },
          },
          { type: 'text-delta', id: 'text-1', delta: 'The answer is 42.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ] as any),
      }),
    });

    // Turn 2: Spy model
    const spyModel = new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'response-2', modelId: 'spy', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Follow-up.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const mockMemory = new MockMemory();

    // --- Turn 1 ---
    const agent1 = new Agent({
      id: 'spy-openai-reasoning',
      name: 'Spy OpenAI Reasoning',
      instructions: 'You are a helpful assistant.',
      model: openaiModel,
      memory: mockMemory,
    });

    const resp1 = await agent1.stream('What is the meaning of life?', {
      memory: { thread: threadId, resource: resourceId },
    });
    await resp1.consumeStream();

    // Verify Turn 1 DB storage — reasoning and text should both be preserved in DB
    const dbMessages = resp1.messageList.get.all.db();
    const turn1Assistant = dbMessages.find(m => m.role === 'assistant');
    expect(turn1Assistant).toBeDefined();

    const turn1ReasoningDB = turn1Assistant!.content.parts.find(p => p.type === 'reasoning');
    expect(turn1ReasoningDB).toBeDefined();
    expect(turn1ReasoningDB!.providerMetadata?.openai?.itemId).toBe(reasoningItemId);

    const turn1TextDB = turn1Assistant!.content.parts.find(p => p.type === 'text');
    expect(turn1TextDB).toBeDefined();
    expect(turn1TextDB!.text).toBe('The answer is 42.');
    expect(turn1TextDB!.providerMetadata?.openai?.itemId).toBe(textItemId);

    // --- Turn 2: Spy ---
    const agent2 = new Agent({
      id: 'spy-openai-reasoning',
      name: 'Spy OpenAI Reasoning',
      instructions: 'You are a helpful assistant.',
      model: spyModel,
      memory: mockMemory,
    });

    const resp2 = await agent2.stream('Tell me more', {
      memory: { thread: threadId, resource: resourceId, options: { lastMessages: 10 } },
    });
    await resp2.consumeStream();

    // Capture Turn 2 input — what did the LLM actually receive?
    const turn2Prompt = spyModel.doStreamCalls[0]!.prompt;
    const turn2AssistantMsg = turn2Prompt.find((m: any) => m.role === 'assistant');
    expect(turn2AssistantMsg).toBeDefined();

    const turn2Content = turn2AssistantMsg!.content as any[];

    // === KEY ASSERTIONS ===

    // 1. Reasoning parts must NOT be sent to the LLM (would cause item pairing errors)
    const turn2Reasoning = turn2Content.find((p: any) => p.type === 'reasoning');
    expect(turn2Reasoning).toBeUndefined();

    // 2. Text must survive but WITHOUT providerMetadata.openai (would cause item_reference linking)
    const turn2Text = turn2Content.find((p: any) => p.type === 'text');
    expect(turn2Text).toBeDefined();
    expect(turn2Text.text).toBe('The answer is 42.');
    expect(turn2Text.providerOptions?.openai).toBeUndefined();
  });
});
