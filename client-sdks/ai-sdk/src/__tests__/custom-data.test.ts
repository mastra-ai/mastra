import { ReadableStream } from 'node:stream/web';
import type { MastraAgentNetworkStream, MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';
import { toAISdkFormat } from '..';

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

      const aiSdkStream = toAISdkFormat(mockStream as unknown as MastraModelOutput, { from: 'agent' });

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

      const aiSdkStream = toAISdkFormat(mockStream as unknown as MastraModelOutput, { from: 'agent' });

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

      const aiSdkStream = toAISdkFormat(mockStream as unknown as MastraModelOutput, { from: 'agent' });

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

  describe('nested workflow with branch and custom data', () => {
    it('should propagate custom data chunks from nested workflow in branch to root stream', async () => {
      // This test simulates:
      // - A parent workflow with a branch
      // - The branch contains a nested workflow
      // - The nested workflow has a step that uses writer.custom() to write data-* chunks
      // - When using toAISdkV5Stream with {from: 'workflow'}, the custom data should propagate

      const mockStream = new ReadableStream({
        async start(controller) {
          // Parent workflow starts
          controller.enqueue({
            type: 'workflow-start',
            runId: 'parent-run-id',
            payload: {
              workflowId: 'parent-workflow',
            },
          });

          // Branch step starts (the nested workflow)
          controller.enqueue({
            type: 'workflow-step-start',
            runId: 'parent-run-id',
            payload: {
              id: 'nested-workflow-step',
              stepCallId: 'step-call-1',
              status: 'running',
            },
          });

          // Nested workflow starts
          controller.enqueue({
            type: 'workflow-start',
            runId: 'nested-run-id',
            payload: {
              workflowId: 'nested-workflow',
            },
          });

          // Step in nested workflow that uses writer.custom()
          controller.enqueue({
            type: 'workflow-step-start',
            runId: 'nested-run-id',
            payload: {
              id: 'custom-data-step',
              stepCallId: 'step-call-2',
              status: 'running',
            },
          });

          // This is the key: workflow-step-output containing a data-* chunk
          // This should be extracted and propagated to the root stream
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'nested-run-id',
            payload: {
              output: {
                type: 'data-custom-progress',
                data: {
                  status: 'processing',
                  progress: 50,
                  message: 'Custom data from nested workflow',
                },
              },
            },
          });

          // Another custom data chunk
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'nested-run-id',
            payload: {
              output: {
                type: 'data-custom-result',
                data: {
                  status: 'complete',
                  result: 'Custom result from nested workflow',
                },
              },
            },
          });

          // Nested workflow step finishes
          controller.enqueue({
            type: 'workflow-step-result',
            runId: 'nested-run-id',
            payload: {
              id: 'custom-data-step',
              stepCallId: 'step-call-2',
              status: 'success',
              output: { result: 'done' },
            },
          });

          // Nested workflow finishes
          controller.enqueue({
            type: 'workflow-finish',
            runId: 'nested-run-id',
            payload: {
              workflowStatus: 'success',
              output: {
                usage: {
                  inputTokens: 0,
                  outputTokens: 0,
                  totalTokens: 0,
                },
              },
              metadata: {},
            },
          });

          // Parent workflow step finishes
          controller.enqueue({
            type: 'workflow-step-result',
            runId: 'parent-run-id',
            payload: {
              id: 'nested-workflow-step',
              stepCallId: 'step-call-1',
              status: 'success',
              output: { result: 'done' },
            },
          });

          // Parent workflow finishes
          controller.enqueue({
            type: 'workflow-finish',
            runId: 'parent-run-id',
            payload: {
              workflowStatus: 'success',
              output: {
                usage: {
                  inputTokens: 0,
                  outputTokens: 0,
                  totalTokens: 0,
                },
              },
              metadata: {},
            },
          });

          controller.close();
        },
      });

      const aiSdkStream = toAISdkV5Stream(mockStream as any, { from: 'workflow' });

      const chunks: any[] = [];
      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
      }

      // The custom data chunks should be present in the root stream
      const customProgressChunk = chunks.find(chunk => chunk.type === 'data-custom-progress');
      const customResultChunk = chunks.find(chunk => chunk.type === 'data-custom-result');

      expect(customProgressChunk).toBeDefined();
      expect(customProgressChunk?.type).toBe('data-custom-progress');
      expect(customProgressChunk?.data).toEqual({
        status: 'processing',
        progress: 50,
        message: 'Custom data from nested workflow',
      });

      expect(customResultChunk).toBeDefined();
      expect(customResultChunk?.type).toBe('data-custom-result');
      expect(customResultChunk?.data).toEqual({
        status: 'complete',
        result: 'Custom result from nested workflow',
      });
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

      const aiSdkStream = toAISdkFormat(mockStream as unknown as MastraModelOutput, { from: 'agent' });

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

      const aiSdkStream = toAISdkFormat(mockStream as unknown as MastraModelOutput, { from: 'agent' });

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

  describe('network custom data', () => {
    it('should generate a network data chunk', async () => {
      const { networkStreamFixture } = await import('./__fixtures__/network.stream');
      const mockStream = ReadableStream.from(networkStreamFixture);

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraAgentNetworkStream, { from: 'network' });

      const chunks: any[] = [];
      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
      }

      const customDataChunk = chunks.find(chunk => chunk.type === 'data-network');

      // Verify the number of steps is correct
      expect(customDataChunk.data.steps).toHaveLength(7);

      // Verify the order of step types matches expected sequence
      const stepNames = customDataChunk.data.steps.map((step: any) => step.name);
      expect(stepNames).toEqual([
        'routing-agent',
        'inventory-agent',
        'routing-agent',
        'purchase-workflow-step',
        'routing-agent',
        'create-invoice',
        'routing-agent',
      ]);

      expect(customDataChunk.data.steps[0].task.id).toEqual('inventoryAgent');
      expect(customDataChunk.data.steps[1].task.id).toEqual('inventory-agent');
      expect(customDataChunk.data.steps[2].task.id).toEqual('purchaseWorkflow');
      expect(customDataChunk.data.steps[3].task.id).toEqual('purchase-workflow-step');
      expect(customDataChunk.data.steps[5].task.id).toEqual('create-invoice');
      expect(customDataChunk.data.steps[6].task.id).toEqual('');
    });

    it('should pass a custom data chunk through the network', async () => {
      const { networkStreamFixture } = await import('./__fixtures__/network.stream');
      const mockStream = ReadableStream.from(networkStreamFixture);

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraAgentNetworkStream, { from: 'network' });

      const chunks: any[] = [];
      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
      }

      const customDataChunk = chunks.find(chunk => chunk.type === 'data-inventory-search');

      // Verify the number of steps is correct
      expect(customDataChunk).toMatchInlineSnapshot(`
        {
          "data": {
            "description": "search for laptops in inventory",
            "name": "laptop",
          },
          "type": "data-inventory-search",
        }
      `);
    });
  });
});
