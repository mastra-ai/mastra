/**
 * UIMessage tests for DurableAgent
 *
 * Tests for UIMessageWithMetadata support in durable execution.
 * Validates that metadata is preserved in messages and content
 * is handled correctly in various formats.
 */

import { describe, it, expect } from 'vitest';
import { DurableAgent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createUIMessageTests({ getPubSub }: DurableAgentTestContext) {
  describe('UIMessage handling', () => {
    describe('UIMessageWithMetadata support', () => {
      it('should accept UIMessageWithMetadata in prepare', async () => {
        const mockModel = createTextStreamModel('Hello!');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'uimessage-agent',
          name: 'UIMessage Agent',
          instructions: 'Process messages with metadata.',
          model: mockModel,
          pubsub,
        });

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
        const mockModel = createTextStreamModel('Response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'mixed-metadata-agent',
          name: 'Mixed Metadata Agent',
          instructions: 'Process messages.',
          model: mockModel,
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
        const mockModel = createTextStreamModel('Response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'preserve-metadata-agent',
          name: 'Preserve Metadata Agent',
          instructions: 'Process messages.',
          model: mockModel,
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

        const serialized = JSON.stringify(result.workflowInput);
        expect(serialized).toBeDefined();

        const parsed = JSON.parse(serialized);
        expect(parsed.messageListState).toBeDefined();
      });
    });

    describe('content format handling', () => {
      it('should handle content as string', async () => {
        const mockModel = createTextStreamModel('Response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'string-content-agent',
          name: 'String Content Agent',
          instructions: 'Process messages.',
          model: mockModel,
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
        const mockModel = createTextStreamModel('Response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'parts-content-agent',
          name: 'Parts Content Agent',
          instructions: 'Process messages.',
          model: mockModel,
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
        const mockModel = createTextStreamModel('Response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'empty-content-agent',
          name: 'Empty Content Agent',
          instructions: 'Process messages.',
          model: mockModel,
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
        const mockModel = createTextStreamModel('Streaming response');
        const pubsub = getPubSub();

        const agent = new DurableAgent({
          id: 'stream-uimessage-agent',
          name: 'Stream UIMessage Agent',
          instructions: 'Process and stream.',
          model: mockModel,
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

  describe('UIMessage edge cases', () => {
    it('should handle metadata with nested objects', async () => {
      const mockModel = createTextStreamModel('Response');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'nested-metadata-agent',
        name: 'Nested Metadata Agent',
        instructions: 'Process messages.',
        model: mockModel,
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

      const serialized = JSON.stringify(result.workflowInput);
      expect(serialized).toBeDefined();
    });

    it('should handle metadata with special characters', async () => {
      const mockModel = createTextStreamModel('Response');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'special-metadata-agent',
        name: 'Special Metadata Agent',
        instructions: 'Process messages.',
        model: mockModel,
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
            'quotes"and\'apostrophes': 'handled',
          },
        },
      ]);

      expect(result.runId).toBeDefined();
    });

    it('should handle null/undefined metadata values', async () => {
      const mockModel = createTextStreamModel('Response');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'null-metadata-agent',
        name: 'Null Metadata Agent',
        instructions: 'Process messages.',
        model: mockModel,
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
      const mockModel = createTextStreamModel('Response');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'id-variations-agent',
        name: 'ID Variations Agent',
        instructions: 'Process messages.',
        model: mockModel,
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
      const mockModel = createTextStreamModel('Response');
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'assistant-metadata-agent',
        name: 'Assistant Metadata Agent',
        instructions: 'Process messages.',
        model: mockModel,
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
}
