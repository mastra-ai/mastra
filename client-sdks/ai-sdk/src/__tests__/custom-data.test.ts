import type { MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';
import { toAISdkV5Stream } from '../convert-streams';

describe('Custom Data Handling', () => {
  describe('workflow tool output with custom data', () => {
    it('should process custom data from workflow tool output', async () => {
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: '8129c45f-266f-41d4-ba07-1385583a6f67',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'tool-output',
            runId: '8129c45f-266f-41d4-ba07-1385583a6f67',
            from: 'USER',
            payload: {
              output: {
                type: 'data-my-custom-event',
                data: {
                  foo: 'bar',
                },
              },
              toolCallId: 'call_5BTDhkOUHMCgurN0dTwToG8D',
              toolName: 'workflow-myWorkflow',
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, { from: 'agent' });

      const chunks: any[] = [];
      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
      }

      const customDataChunk = chunks.find(chunk => chunk.type === 'data-my-custom-event');

      expect(customDataChunk).toBeDefined();
      expect(customDataChunk.type).toBe('data-my-custom-event');
      expect(customDataChunk.data).toEqual({ foo: 'bar' });
    });

    it('should process custom data with nested objects', async () => {
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'tool-output',
            runId: 'test-run-id',
            from: 'USER',
            payload: {
              output: {
                type: 'data-complex-event',
                data: {
                  user: {
                    id: '123',
                    name: 'John Doe',
                    preferences: {
                      theme: 'dark',
                      notifications: true,
                    },
                  },
                  metadata: {
                    timestamp: '2025-11-10T00:00:00Z',
                    version: '1.0',
                  },
                },
              },
              toolCallId: 'call_test',
              toolName: 'workflow-userPreferences',
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, { from: 'agent' });

      const chunks: any[] = [];
      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
      }

      const customDataChunk = chunks.find(chunk => chunk.type === 'data-complex-event');

      expect(customDataChunk).toBeDefined();
      expect(customDataChunk.data.user.name).toBe('John Doe');
      expect(customDataChunk.data.user.preferences.theme).toBe('dark');
      expect(customDataChunk.data.metadata.version).toBe('1.0');
    });

    it('should process custom data with array values', async () => {
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'tool-output',
            runId: 'test-run-id',
            from: 'USER',
            payload: {
              output: {
                type: 'data-list-event',
                data: {
                  items: ['item1', 'item2', 'item3'],
                  counts: [1, 2, 3, 4, 5],
                },
              },
              toolCallId: 'call_test',
              toolName: 'workflow-list',
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, { from: 'agent' });

      const chunks: any[] = [];
      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
      }

      const customDataChunk = chunks.find(chunk => chunk.type === 'data-list-event');

      expect(customDataChunk).toBeDefined();
      expect(customDataChunk.data.items).toEqual(['item1', 'item2', 'item3']);
      expect(customDataChunk.data.counts).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('validation and error handling', () => {
    it('should throw error when custom data chunk is missing data property', async () => {
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'tool-output',
            runId: 'test-run-id',
            from: 'USER',
            payload: {
              output: {
                type: 'data-invalid-event',
                // Missing 'data' property
              },
              toolCallId: 'call_test',
              toolName: 'workflow-test',
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, { from: 'agent' });

      await expect(async () => {
        for await (const _chunk of aiSdkStream) {
          // Process all chunks
        }
      }).rejects.toThrow('UI Messages require a data property when using data- prefixed chunks');
    });

    it('should throw error with detailed information about the invalid chunk', async () => {
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue({
            type: 'start',
            runId: 'test-run-id',
            payload: { id: 'test-id' },
          });

          controller.enqueue({
            type: 'tool-output',
            runId: 'test-run-id',
            from: 'USER',
            payload: {
              output: {
                type: 'data-missing-data-prop',
                someOtherProp: 'value',
              },
              toolCallId: 'call_specific',
              toolName: 'workflow-specific',
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, { from: 'agent' });

      try {
        for await (const _chunk of aiSdkStream) {
          // Process all chunks
        }
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('UI Messages require a data property');
        expect(error.message).toContain('data-missing-data-prop');
      }
    });
  });
});
