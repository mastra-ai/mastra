import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType, NetworkChunkType } from '@mastra/core/stream';
import { describe, it, expect } from 'vitest';
import { transformNetwork, WorkflowStreamToAISDKTransformer } from '../transformers';

describe('transformNetwork', () => {
  describe('routing agent text streaming', () => {
    it('should transform routing-agent-text-delta to text-delta', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'routing-agent',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: 'Hello from routing agent' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-delta',
        id: 'run-1',
        delta: 'Hello from routing agent',
      });
    });

    it('should transform routing-agent-text-start to text-start', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'routing-agent',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-start',
        payload: { runId: 'run-1' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-start',
        id: 'run-1',
      });
    });
  });

  describe('sub-agent text streaming', () => {
    it('should transform agent-execution-event-text-delta to text-delta', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        payload: {
          type: 'text-delta',
          payload: { text: 'Hello from sub-agent' },
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-delta',
        id: 'run-1',
        delta: 'Hello from sub-agent',
      });
    });

    it('should transform agent-execution-event-text-start to text-start', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-text-start',
        payload: {
          type: 'text-start',
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-start',
        id: 'run-1',
      });
    });
  });

  describe('sub-workflow text streaming', () => {
    it('should transform workflow-execution-event-text-delta to text-delta', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'workflow-execution-event-text-delta',
        payload: {
          type: 'text-delta',
          payload: { text: 'Hello from sub-workflow' },
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-delta',
        id: 'run-1',
        delta: 'Hello from sub-workflow',
      });
    });

    it('should transform workflow-execution-event-text-start to text-start', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'workflow-execution-event-text-start',
        payload: {
          type: 'text-start',
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-start',
        id: 'run-1',
      });
    });
  });

  describe('data chunks', () => {
    it('should pass through data chunks unchanged', () => {
      const bufferedNetworks = new Map();

      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-data-custom',
        payload: {
          type: 'data-custom',
          data: { foo: 'bar' },
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'data-custom',
        data: { foo: 'bar' },
      });
    });
  });

  describe('other events', () => {
    it('should handle agent-execution-start', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'agent-execution-start',
        payload: {
          agentId: 'test-agent',
          args: {
            task: 'test',
            primitiveId: 'test-agent',
            primitiveType: 'agent',
            prompt: 'test prompt',
            result: '',
            selectionReason: 'test reason',
            iteration: 0,
          },
          runId: 'run-1',
        },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toHaveProperty('type', 'data-network');
      expect(result).toHaveProperty('id', 'run-1');
      expect((result as any).data.steps).toHaveLength(1);
      expect((result as any).data.steps[0].name).toBe('test-agent');
    });
  });
});

describe('WorkflowStreamToAISDKTransformer', () => {
  describe('basic workflow stream', () => {
    it('should transform basic workflow events', async () => {
      const mockStream = new ReadableStream<ChunkType>({
        async start(controller) {
          // Workflow starts
          controller.enqueue({
            type: 'workflow-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              workflowId: 'test-workflow',
            },
          });

          // Step starts
          controller.enqueue({
            id: 'step-1',
            type: 'workflow-step-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              id: 'step-1',
              stepCallId: 'call-1',
              status: 'running',
              payload: {},
            },
          });

          // Step result
          controller.enqueue({
            type: 'workflow-step-result',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              id: 'step-1',
              stepCallId: 'call-1',
              status: 'success',
              output: {},
            },
          });

          // Workflow finish
          controller.enqueue({
            type: 'workflow-finish',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              metadata: {},
              workflowStatus: 'success',
              output: { usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
            },
          });

          controller.close();
        },
      });

      const transformedStream = mockStream.pipeThrough(WorkflowStreamToAISDKTransformer());

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      // Should have start, workflow data chunks, and finish
      expect(chunks[0]).toEqual({ type: 'start' });
      expect(chunks[chunks.length - 1]).toEqual({ type: 'finish' });

      // Check workflow data chunks
      const workflowDataChunks = chunks.filter(chunk => chunk.type === 'data-workflow');
      expect(workflowDataChunks.length).toBeGreaterThan(0);

      // First workflow chunk should show running status
      const firstWorkflowChunk = workflowDataChunks[0];
      expect(firstWorkflowChunk.data.name).toBe('test-workflow');
      expect(firstWorkflowChunk.data.status).toBe('running');

      // Last workflow chunk should show success status
      const lastWorkflowChunk = workflowDataChunks[workflowDataChunks.length - 1];
      expect(lastWorkflowChunk.data.status).toBe('success');
      expect(lastWorkflowChunk.data.output).toMatchObject({
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      });
    });
  });

  describe('workflow-step-output with text stream chunks', () => {
    it('should transform text-delta chunks from workflow-step-output', async () => {
      const mockStream = new ReadableStream<ChunkType>({
        async start(controller) {
          // Workflow starts
          controller.enqueue({
            type: 'workflow-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              workflowId: 'test-workflow',
            },
          });

          // Step starts
          controller.enqueue({
            id: 'agent-step',
            type: 'workflow-step-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              id: 'agent-step',
              stepCallId: 'call-1',
              status: 'running',
            },
          });

          // Agent streaming text chunks as workflow-step-output (Mastra chunk format)
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'text-start',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'msg-1',
                },
              },
            },
          });

          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'text-delta',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'msg-1',
                  text: 'Hello',
                },
              },
            },
          });

          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'text-delta',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'msg-1',
                  text: ' World',
                },
              },
            },
          });

          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'text-end',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'msg-1',
                },
              },
            },
          });

          // Step result
          controller.enqueue({
            type: 'workflow-step-result',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              id: 'agent-step',
              stepCallId: 'call-1',
              status: 'success',
              output: {},
            },
          });

          // Workflow finish
          controller.enqueue({
            type: 'workflow-finish',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              metadata: {},
              workflowStatus: 'success',
              output: { usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
            },
          });

          controller.close();
        },
      });

      const transformedStream = mockStream.pipeThrough(
        WorkflowStreamToAISDKTransformer({ includeTextStreamParts: true }),
      );

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      // Find text stream chunks
      const textStartChunk = chunks.find(chunk => chunk.type === 'text-start');
      const textDeltaChunks = chunks.filter(chunk => chunk.type === 'text-delta');
      const textEndChunk = chunks.find(chunk => chunk.type === 'text-end');

      // Verify text-start chunk
      expect(textStartChunk).toBeDefined();
      expect(textStartChunk.id).toBe('msg-1');

      // Verify text-delta chunks
      expect(textDeltaChunks.length).toBe(2);
      expect(textDeltaChunks[0].delta).toBe('Hello');
      expect(textDeltaChunks[1].delta).toBe(' World');

      // Verify text-end chunk
      expect(textEndChunk).toBeDefined();
      expect(textEndChunk.id).toBe('msg-1');
    });

    it('should transform tool-call chunks from workflow-step-output', async () => {
      const mockStream = new ReadableStream<ChunkType>({
        async start(controller) {
          // Workflow starts
          controller.enqueue({
            type: 'workflow-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              workflowId: 'test-workflow',
            },
          });

          // Step starts
          controller.enqueue({
            id: 'agent-step',
            type: 'workflow-step-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              id: 'agent-step',
              stepCallId: 'call-1',
              status: 'running',
            },
          });

          // Tool call chunks (Mastra chunk format)
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'tool-call',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  toolCallId: 'tool-call-1',
                  toolName: 'search',
                  args: { query: 'test query' },
                },
              },
            },
          });

          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'tool-result',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  toolCallId: 'tool-call-1',
                  toolName: 'search',
                  result: { results: ['result 1', 'result 2'] },
                },
              },
            },
          });

          // Step result
          controller.enqueue({
            type: 'workflow-step-result',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              id: 'agent-step',
              stepCallId: 'call-1',
              status: 'success',
              output: { usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
            },
          });

          // Workflow finish
          controller.enqueue({
            type: 'workflow-finish',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              metadata: {},
              workflowStatus: 'success',
              output: { usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
            },
          });

          controller.close();
        },
      });

      const transformedStream = mockStream.pipeThrough(
        WorkflowStreamToAISDKTransformer({ includeTextStreamParts: true }),
      );

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      // Find tool-related chunks
      const toolInputAvailableChunk = chunks.find(chunk => chunk.type === 'tool-input-available');
      const toolOutputAvailableChunk = chunks.find(chunk => chunk.type === 'tool-output-available');

      // Verify tool-input-available (converted from tool-call)
      expect(toolInputAvailableChunk).toBeDefined();
      expect(toolInputAvailableChunk.toolCallId).toBe('tool-call-1');
      expect(toolInputAvailableChunk.toolName).toBe('search');
      expect(toolInputAvailableChunk.input).toEqual({ query: 'test query' });

      // Verify tool-output-available (converted from tool-result)
      expect(toolOutputAvailableChunk).toBeDefined();
      expect(toolOutputAvailableChunk.toolCallId).toBe('tool-call-1');
      expect(toolOutputAvailableChunk.output).toEqual({ results: ['result 1', 'result 2'] });
    });

    it('should not include text stream chunks when includeTextStreamParts is false', async () => {
      const mockStream = new ReadableStream<ChunkType>({
        async start(controller) {
          // Workflow starts
          controller.enqueue({
            type: 'workflow-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              workflowId: 'test-workflow',
            },
          });

          // Text chunks that should be filtered out (Mastra chunk format)
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'text-delta',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'msg-1',
                  text: 'Hello World',
                },
              },
            },
          });

          // Workflow finish
          controller.enqueue({
            type: 'workflow-finish',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              metadata: {},
              workflowStatus: 'success',
              output: { usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
            },
          });

          controller.close();
        },
      });

      const transformedStream = mockStream.pipeThrough(
        WorkflowStreamToAISDKTransformer({ includeTextStreamParts: false }),
      );

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      // Should not have any text-delta chunks
      const textDeltaChunks = chunks.filter(chunk => chunk.type === 'text-delta');
      expect(textDeltaChunks.length).toBe(0);

      // Should still have start, workflow data, and finish
      expect(chunks[0]).toEqual({ type: 'start' });
      expect(chunks[chunks.length - 1]).toEqual({ type: 'finish' });
    });
  });

  describe('workflow-step-output with custom data chunks', () => {
    it('should pass through custom data chunks from workflow-step-output', async () => {
      const mockStream = new ReadableStream<ChunkType>({
        async start(controller) {
          // Workflow starts
          controller.enqueue({
            type: 'workflow-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              workflowId: 'test-workflow',
            },
          });

          // Custom data chunk
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'data-custom-event',
                from: ChunkFrom.USER,
                runId: 'test-run-id',
                data: {
                  message: 'Custom data from workflow step',
                  value: 42,
                },
              },
            },
          });

          // Workflow finish
          controller.enqueue({
            type: 'workflow-finish',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              metadata: {},
              workflowStatus: 'success',
              output: { usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
            },
          });

          controller.close();
        },
      });

      const transformedStream = mockStream.pipeThrough(WorkflowStreamToAISDKTransformer());

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      // Find the custom data chunk
      const customDataChunk = chunks.find(chunk => chunk.type === 'data-custom-event');

      expect(customDataChunk).toBeDefined();
      expect(customDataChunk.type).toBe('data-custom-event');
      expect(customDataChunk.data).toEqual({
        message: 'Custom data from workflow step',
        value: 42,
      });
    });
  });
});
