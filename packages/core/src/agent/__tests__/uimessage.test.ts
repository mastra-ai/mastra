import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MastraMessageV2 } from '../../memory';
import { MockMemory } from '../../memory';
import { Agent } from '../agent';

function uiMessageTest(version: 'v1' | 'v2') {
  describe(`${version} - UIMessageWithMetadata support`, () => {
    let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;
    const mockMemory = new MockMemory();

    beforeEach(() => {
      if (version === 'v1') {
        dummyModel = new MockLanguageModelV1({
          doGenerate: async () => ({
            finishReason: 'stop',
            usage: { completionTokens: 10, promptTokens: 3 },
            text: 'Response acknowledging metadata',
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
          doStream: async () => ({
            stream: simulateReadableStream({
              chunks: [
                { type: 'text-delta', textDelta: 'Response' },
                { type: 'text-delta', textDelta: ' acknowledging' },
                { type: 'text-delta', textDelta: ' metadata' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  logprobs: undefined,
                  usage: { completionTokens: 10, promptTokens: 3 },
                },
              ],
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          }),
        });
      } else {
        dummyModel = new MockLanguageModelV2({
          doStream: async () => ({
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: '1' },
              { type: 'text-delta', id: '1', delta: 'Response' },
              { type: 'text-delta', id: '1', delta: ' acknowledging' },
              { type: 'text-delta', id: '1', delta: ' metadata' },
              { type: 'text-end', id: '1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          }),
        });
      }
    });

    it('should preserve metadata in generate method', async () => {
      const agent = new Agent({
        name: 'metadata-test-agent',
        instructions: 'You are a helpful assistant',
        model: dummyModel,
        memory: mockMemory,
      });

      const messagesWithMetadata = [
        {
          role: 'user' as const,
          content: 'Hello with metadata',
          parts: [{ type: 'text' as const, text: 'Hello with metadata' }],
          metadata: {
            source: 'web-ui',
            customerId: '12345',
            context: { orderId: 'ORDER-789', status: 'pending' },
          },
        },
      ];

      if (version === 'v1') {
        await agent.generateLegacy(messagesWithMetadata, {
          memory: {
            resource: 'customer-12345',
            thread: {
              id: 'support-thread',
            },
          },
        });
      } else {
        await agent.generate(messagesWithMetadata, {
          memory: {
            resource: 'customer-12345',
            thread: {
              id: 'support-thread',
            },
          },
        });
      }
      // Verify messages were saved with metadata
      const result = await mockMemory.recall({
        threadId: 'support-thread',
        resourceId: 'customer-12345',
        perPage: 10,
      });

      expect(result.messages.length).toBeGreaterThan(0);

      // Find the user message
      const userMessage = result.messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();

      // Check that metadata was preserved in v2 format
      if (
        userMessage &&
        'content' in userMessage &&
        typeof userMessage.content === 'object' &&
        'metadata' in userMessage.content
      ) {
        expect(userMessage.content.metadata).toEqual({
          source: 'web-ui',
          customerId: '12345',
          context: { orderId: 'ORDER-789', status: 'pending' },
        });
      }
    });

    it('should preserve metadata in stream method', async () => {
      const agent = new Agent({
        name: 'metadata-stream-agent',
        instructions: 'You are a helpful assistant',
        model: dummyModel,
        memory: mockMemory,
      });

      const messagesWithMetadata = [
        {
          role: 'user' as const,
          content: 'Stream with metadata',
          parts: [{ type: 'text' as const, text: 'Stream with metadata' }],
          metadata: {
            source: 'mobile-app',
            sessionId: 'session-123',
            deviceInfo: { platform: 'iOS', version: '17.0' },
          },
        },
      ];

      let stream;
      if (version === 'v1') {
        stream = await agent.streamLegacy(messagesWithMetadata, {
          memory: {
            resource: 'user-mobile',
            thread: {
              id: 'mobile-thread',
            },
          },
        });
      } else {
        stream = await agent.stream(messagesWithMetadata, {
          memory: {
            resource: 'user-mobile',
            thread: {
              id: 'mobile-thread',
            },
          },
        });
      }

      // Consume the stream
      let finalText = '';
      for await (const textPart of stream.textStream) {
        finalText += textPart;
      }

      expect(finalText).toBe('Response acknowledging metadata');

      // Verify messages were saved with metadata
      const result = await mockMemory.recall({
        threadId: 'mobile-thread',
        resourceId: 'user-mobile',
        perPage: 10,
      });

      expect(result.messages.length).toBeGreaterThan(0);

      // Find the user message
      const userMessage = result.messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();

      // Check that metadata was preserved
      if (
        userMessage &&
        'content' in userMessage &&
        typeof userMessage.content === 'object' &&
        'metadata' in userMessage.content
      ) {
        expect(userMessage.content.metadata).toEqual({
          source: 'mobile-app',
          sessionId: 'session-123',
          deviceInfo: { platform: 'iOS', version: '17.0' },
        });
      }
    });

    it('should handle mixed messages with and without metadata', async () => {
      const agent = new Agent({
        name: 'mixed-metadata-agent',
        instructions: 'You are a helpful assistant',
        model: dummyModel,
        memory: mockMemory,
      });

      const mixedMessages = [
        {
          role: 'user' as const,
          content: 'First message with metadata',
          parts: [{ type: 'text' as const, text: 'First message with metadata' }],
          metadata: {
            messageType: 'initial',
            priority: 'high',
          },
        },
        {
          role: 'assistant' as const,
          content: 'Response without metadata',
          parts: [{ type: 'text' as const, text: 'Response without metadata' }],
        },
        {
          role: 'user' as const,
          content: 'Second user message',
          parts: [{ type: 'text' as const, text: 'Second user message' }],
          // No metadata on this message
        },
      ];

      if (version === 'v1') {
        await agent.generateLegacy(mixedMessages, {
          memory: {
            resource: 'mixed-user',
            thread: {
              id: 'mixed-thread',
            },
          },
        });
      } else {
        await agent.generate(mixedMessages, {
          memory: {
            resource: 'mixed-user',
            thread: {
              id: 'mixed-thread',
            },
          },
        });
      }
      // Verify messages were saved correctly
      const result = await mockMemory.recall({
        threadId: 'mixed-thread',
        resourceId: 'mixed-user',
        perPage: 10,
      });

      expect(result.messages.length).toBeGreaterThan(0);

      // Find messages and check metadata
      const messagesAsV2 = result.messages as MastraMessageV2[];
      const firstUserMessage = messagesAsV2.find(
        m =>
          m.role === 'user' &&
          m.content.parts?.[0]?.type === 'text' &&
          m.content.parts[0].text.includes('First message'),
      );
      const secondUserMessage = messagesAsV2.find(
        m =>
          m.role === 'user' && m.content.parts?.[0]?.type === 'text' && m.content.parts[0].text.includes('Second user'),
      );

      // First message should have metadata
      expect(firstUserMessage?.content.metadata).toEqual({
        messageType: 'initial',
        priority: 'high',
      });

      // Second message should not have metadata
      expect(secondUserMessage?.content.metadata).toBeUndefined();
    });
  });
}

uiMessageTest('v1');
uiMessageTest('v2');
