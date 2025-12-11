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

  describe('toAISdkV5Stream tripwire handling', () => {
    it('should send finish event with finishReason "other" when tripwire occurs and stream does not exit gracefully', async () => {
      const tripwireReason = 'Content filter triggered';

      // Create a mock stream with tripwire chunk but no finish event
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'tripwire',
            runId: 'test-run-id',
            payload: {
              reason: tripwireReason,
            },
          });

          // Stream closes without a finish event (ungraceful exit)
          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
        from: 'agent',
        sendFinish: true,
      });

      const chunks: any[] = [];
      let finishChunk: any = null;
      let tripwireChunk: any = null;

      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
        if (chunk.type === 'finish') {
          finishChunk = chunk;
        }
        if (chunk.type === 'data-tripwire') {
          tripwireChunk = chunk;
        }
      }

      // Verify tripwire chunk was received
      expect(tripwireChunk).toBeDefined();
      expect(tripwireChunk.type).toBe('data-tripwire');
      expect(tripwireChunk.data.reason).toBe(tripwireReason);

      // Verify finish event was sent with finishReason 'other'
      expect(finishChunk).toBeDefined();
      expect(finishChunk.type).toBe('finish');
      expect(finishChunk.finishReason).toBe('other');
    });

    it('should not send additional finish event if finish already occurred after tripwire', async () => {
      const tripwireReason = 'Content filter triggered';

      // Create a mock stream with tripwire chunk followed by finish event
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'tripwire',
            runId: 'test-run-id',
            payload: {
              reason: tripwireReason,
            },
          });

          controller.enqueue({
            type: 'finish',
            runId: 'test-run-id',
            payload: {
              stepResult: {
                reason: 'stop',
              },
              output: {
                usage: {
                  inputTokens: 10,
                  outputTokens: 20,
                  totalTokens: 30,
                },
              },
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
        from: 'agent',
        sendFinish: true,
      });

      const chunks: any[] = [];
      const finishChunks: any[] = [];

      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
        if (chunk.type === 'finish') {
          finishChunks.push(chunk);
        }
      }

      // Should only have one finish event (the original one, not an additional one)
      expect(finishChunks).toHaveLength(1);
    });
  });
});
