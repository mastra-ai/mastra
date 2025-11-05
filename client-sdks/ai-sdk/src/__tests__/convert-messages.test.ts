import type { MastraDBMessage } from '@mastra/core/agent';
import type { MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';
import { toAISdkV4Messages, toAISdkV5Messages } from '../convert-messages';
import { toAISdkV5Stream } from '../convert-streams';

describe('toAISdkFormat', () => {
  const sampleMessages: MastraDBMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
      createdAt: new Date(),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
      createdAt: new Date(),
    },
  ];

  describe('toAISdkV5Messages', () => {
    it('should convert Mastra V2 messages to AI SDK V5 UI format', () => {
      const result = toAISdkV5Messages(sampleMessages);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'msg-1');
      expect(result[0]).toHaveProperty('role', 'user');
      expect(result[1]).toHaveProperty('id', 'msg-2');
      expect(result[1]).toHaveProperty('role', 'assistant');
    });

    it('should handle empty array', () => {
      const result = toAISdkV5Messages([]);
      expect(result).toEqual([]);
    });
  });

  describe('toAISdkV4Messages', () => {
    it('should convert Mastra V2 messages to AI SDK V4 UI format', () => {
      const result = toAISdkV4Messages(sampleMessages);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id', 'msg-1');
      expect(result[0]).toHaveProperty('role', 'user');
      expect(result[1]).toHaveProperty('id', 'msg-2');
      expect(result[1]).toHaveProperty('role', 'assistant');
    });

    it('should handle empty array', () => {
      const result = toAISdkV4Messages([]);
      expect(result).toEqual([]);
    });
  });

  describe('toAISdkV5Stream error handling', () => {
    it('should preserve error message details when converting agent stream', async () => {
      const errorMessage =
        'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits';
      const errorName = 'AI_APICallError';

      // Create a mock stream with error chunk
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'error',
            runId: 'test-run-id',
            payload: {
              error: {
                message: errorMessage,
                name: errorName,
                stack: `${errorName}: ${errorMessage}\n    at someFunction (file.ts:10:5)`,
              },
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, { from: 'agent' });

      const errorChunks: any[] = [];

      for await (const chunk of aiSdkStream) {
        if (chunk.type === 'error') {
          errorChunks.push(chunk);
          break;
        }
      }

      // Find the error chunk
      const errorChunk = errorChunks[0];

      expect(errorChunk).toBeDefined();
      expect(errorChunk.errorText).toBeDefined();
      expect(errorChunk.errorText).not.toBe('Error'); // Should not be the generic "Error" string
      expect(errorChunk.errorText).toContain(errorMessage); // Should contain the actual error message
    });
  });
});
