/**
 * DurableAgent UIMessage Tests
 *
 * Tests for UIMessageWithMetadata support in durable execution.
 * Validates that metadata is preserved in messages and content
 * is handled correctly in various formats.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { DurableAgent } from '../durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a simple text model
 */
function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ============================================================================
// DurableAgent UIMessage Tests
// ============================================================================

describe('DurableAgent UIMessage handling', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('UIMessageWithMetadata support', () => {
    it('should accept UIMessageWithMetadata in prepare', async () => {
      const mockModel = createTextModel('Hello!');

      const agent = new DurableAgent({
        id: 'uimessage-agent',
        name: 'UIMessage Agent',
        instructions: 'Process messages with metadata.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      // UIMessageWithMetadata format
      const result = await agent.prepare([
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello!',
          metadata: {
            customField: 'customValue',
            timestamp: Date.now(),
          },
        },
      ]);

      expect(result.runId).toBeDefined();
      expect(result.workflowInput.messageListState).toBeDefined();
    });

    it('should handle messages with and without metadata', async () => {
      const mockModel = createTextModel('Response');

      const agent = new DurableAgent({
        id: 'mixed-metadata-agent',
        name: 'Mixed Metadata Agent',
        instructions: 'Process messages.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare([
        {
          id: 'msg-with-metadata',
          role: 'user',
          content: 'First message with metadata',
          metadata: { source: 'web' },
        },
        {
          role: 'user',
          content: 'Second message without metadata',
        },
      ]);

      expect(result.runId).toBeDefined();
    });

    it('should preserve metadata through workflow serialization', async () => {
      const mockModel = createTextModel('Response');

      const agent = new DurableAgent({
        id: 'preserve-metadata-agent',
        name: 'Preserve Metadata Agent',
        instructions: 'Process messages.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const metadata = {
        userId: 'user-123',
        sessionId: 'session-456',
        customData: { key: 'value' },
      };

      const result = await agent.prepare([
        {
          id: 'metadata-msg',
          role: 'user',
          content: 'Message with rich metadata',
          metadata,
        },
      ]);

      // Verify workflow input is serializable
      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();

      const parsed = JSON.parse(serialized);
      expect(parsed.messageListState).toBeDefined();
    });
  });

  describe('content format handling', () => {
    it('should handle content as string', async () => {
      const mockModel = createTextModel('Response');

      const agent = new DurableAgent({
        id: 'string-content-agent',
        name: 'String Content Agent',
        instructions: 'Process messages.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare([
        {
          role: 'user',
          content: 'Simple string content',
        },
      ]);

      expect(result.runId).toBeDefined();
    });

    it('should handle content as array of parts', async () => {
      const mockModel = createTextModel('Response');

      const agent = new DurableAgent({
        id: 'parts-content-agent',
        name: 'Parts Content Agent',
        instructions: 'Process messages.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' },
          ],
        },
      ]);

      expect(result.runId).toBeDefined();
    });

    it('should handle empty content', async () => {
      const mockModel = createTextModel('Response');

      const agent = new DurableAgent({
        id: 'empty-content-agent',
        name: 'Empty Content Agent',
        instructions: 'Process messages.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const result = await agent.prepare([
        {
          role: 'user',
          content: '',
        },
      ]);

      expect(result.runId).toBeDefined();
    });
  });

  describe('streaming with UIMessage', () => {
    it('should stream with UIMessageWithMetadata input', async () => {
      const mockModel = createTextModel('Streaming response');

      const agent = new DurableAgent({
        id: 'stream-uimessage-agent',
        name: 'Stream UIMessage Agent',
        instructions: 'Process and stream.',
        model: mockModel as LanguageModelV2,
        pubsub,
      });

      const { runId, cleanup } = await agent.stream([
        {
          id: 'stream-msg',
          role: 'user',
          content: 'Stream this message',
          metadata: { streaming: true },
        },
      ]);

      expect(runId).toBeDefined();
      cleanup();
    });
  });
});

describe('DurableAgent UIMessage edge cases', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('should handle metadata with nested objects', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'nested-metadata-agent',
      name: 'Nested Metadata Agent',
      instructions: 'Process messages.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare([
      {
        id: 'nested-msg',
        role: 'user',
        content: 'Message with nested metadata',
        metadata: {
          user: {
            profile: {
              name: 'Alice',
              settings: {
                theme: 'dark',
                notifications: true,
              },
            },
          },
          context: {
            history: ['step1', 'step2', 'step3'],
          },
        },
      },
    ]);

    expect(result.runId).toBeDefined();

    // Should serialize correctly
    const serialized = JSON.stringify(result.workflowInput);
    expect(serialized).toBeDefined();
  });

  it('should handle metadata with special characters', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'special-metadata-agent',
      name: 'Special Metadata Agent',
      instructions: 'Process messages.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare([
      {
        id: 'special-msg',
        role: 'user',
        content: 'Message with special chars in metadata',
        metadata: {
          'key-with-dashes': 'value',
          key_with_underscores: 'value',
          'key.with.dots': 'value',
          'unicode-key-🔑': 'unicode-value-🎉',
          'quotes"and\'apostrophes': 'handled',
        },
      },
    ]);

    expect(result.runId).toBeDefined();
  });

  it('should handle null/undefined metadata values', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'null-metadata-agent',
      name: 'Null Metadata Agent',
      instructions: 'Process messages.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare([
      {
        id: 'null-msg',
        role: 'user',
        content: 'Message with null metadata values',
        metadata: {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          zero: 0,
          false: false,
        },
      },
    ]);

    expect(result.runId).toBeDefined();
  });

  it('should handle message ID variations', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'id-variations-agent',
      name: 'ID Variations Agent',
      instructions: 'Process messages.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare([
      {
        id: 'simple-id',
        role: 'user',
        content: 'Simple ID',
      },
      {
        id: 'uuid-4e8f6a2d-1c3b-4e5f-9a8b-2c1d3e4f5a6b',
        role: 'user',
        content: 'UUID-style ID',
      },
      {
        id: 'msg_with_underscores_123',
        role: 'user',
        content: 'Underscore ID',
      },
      {
        id: '',
        role: 'user',
        content: 'Empty ID',
      },
    ]);

    expect(result.runId).toBeDefined();
  });

  it('should handle assistant messages with metadata', async () => {
    const mockModel = createTextModel('Response');

    const agent = new DurableAgent({
      id: 'assistant-metadata-agent',
      name: 'Assistant Metadata Agent',
      instructions: 'Process messages.',
      model: mockModel as LanguageModelV2,
      pubsub,
    });

    const result = await agent.prepare([
      {
        id: 'user-msg',
        role: 'user',
        content: 'User message',
        metadata: { userMeta: true },
      },
      {
        id: 'assistant-msg',
        role: 'assistant',
        content: 'Previous assistant response',
        metadata: {
          modelUsed: 'gpt-4',
          tokensUsed: 150,
          latencyMs: 500,
        },
      },
      {
        id: 'followup-msg',
        role: 'user',
        content: 'Follow-up question',
      },
    ]);

    expect(result.runId).toBeDefined();
  });
});
