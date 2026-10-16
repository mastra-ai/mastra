import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { toAISdkV5Stream } from '../convert-streams';
import { WorkflowStreamToAISDKTransformer } from '../transformers';

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

    it('should transform tool-call-suspended chunks from workflow-step-output', async () => {
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

          // Tool call suspended chunk (Mastra chunk format)
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'tool-call-suspended',
                from: ChunkFrom.AGENT,
                runId: 'agent-run-id',
                payload: {
                  toolCallId: 'tool-call-1',
                  toolName: 'suspendable-tool',
                  suspendPayload: {
                    reason: 'Waiting for user approval',
                    data: { value: 42 },
                  },
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

      // Find the tool-call-suspended chunk (converted to data-tool-call-suspended)
      const toolCallSuspendedChunk = chunks.find(chunk => chunk.type === 'data-tool-call-suspended');

      // Verify tool-call-suspended is transformed and passed through
      expect(toolCallSuspendedChunk).toBeDefined();
      expect(toolCallSuspendedChunk.type).toBe('data-tool-call-suspended');
      expect(toolCallSuspendedChunk.id).toBe('tool-call-1');
      expect(toolCallSuspendedChunk.data).toEqual({
        state: 'data-tool-call-suspended',
        runId: 'agent-run-id',
        toolCallId: 'tool-call-1',
        toolName: 'suspendable-tool',
        suspendPayload: {
          reason: 'Waiting for user approval',
          data: { value: 42 },
        },
        resumeSchema: undefined,
      });
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

  describe('workflow-step-output with reasoning chunks', () => {
    it('should include reasoning-delta chunks when sendReasoning is true', async () => {
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

          // Reasoning start chunk from agent inside workflow
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'reasoning-start',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'reasoning-1',
                },
              },
            },
          });

          // Reasoning delta chunk
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'reasoning-delta',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'reasoning-1',
                  text: 'Let me think about this...',
                },
              },
            },
          });

          // Reasoning end chunk
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'reasoning-end',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'reasoning-1',
                },
              },
            },
          });

          // Text response
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
                  text: 'Here is my answer',
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

      const transformedStream = mockStream.pipeThrough(
        WorkflowStreamToAISDKTransformer({ includeTextStreamParts: true, sendReasoning: true }),
      );

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      // Should have reasoning chunks
      const reasoningStartChunk = chunks.find(chunk => chunk.type === 'reasoning-start');
      const reasoningDeltaChunks = chunks.filter(chunk => chunk.type === 'reasoning-delta');
      const reasoningEndChunk = chunks.find(chunk => chunk.type === 'reasoning-end');

      expect(reasoningStartChunk).toBeDefined();
      expect(reasoningStartChunk.id).toBe('reasoning-1');

      expect(reasoningDeltaChunks.length).toBe(1);
      expect(reasoningDeltaChunks[0].delta).toBe('Let me think about this...');

      expect(reasoningEndChunk).toBeDefined();
      expect(reasoningEndChunk.id).toBe('reasoning-1');

      // Should also have text chunks
      const textDeltaChunks = chunks.filter(chunk => chunk.type === 'text-delta');
      expect(textDeltaChunks.length).toBe(1);
      expect(textDeltaChunks[0].delta).toBe('Here is my answer');
    });

    it('should filter all reasoning chunks when sendReasoning is not set', async () => {
      const mockStream = new ReadableStream<ChunkType>({
        async start(controller) {
          controller.enqueue({
            type: 'workflow-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: { workflowId: 'test-workflow' },
          });

          // Reasoning start
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'reasoning-start',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: { id: 'reasoning-1' },
              },
            },
          });

          // Reasoning delta
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'reasoning-delta',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: { id: 'reasoning-1', text: 'Let me think about this...' },
              },
            },
          });

          // Reasoning end
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'reasoning-end',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: { id: 'reasoning-1' },
              },
            },
          });

          // Text response
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'text-delta',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: { id: 'msg-1', text: 'Here is my answer' },
              },
            },
          });

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

      // Default behavior (no sendReasoning) should filter reasoning chunks
      const transformedStream = mockStream.pipeThrough(
        WorkflowStreamToAISDKTransformer({ includeTextStreamParts: true }),
      );

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      // reasoning chunks should be filtered out (sendReasoning defaults to false)
      const reasoningDeltaChunks = chunks.filter(chunk => chunk.type === 'reasoning-delta');
      expect(reasoningDeltaChunks.length).toBe(0);
      expect(chunks.find(chunk => chunk.type === 'reasoning-start')).toBeUndefined();
      expect(chunks.find(chunk => chunk.type === 'reasoning-end')).toBeUndefined();

      // Text should still come through
      const textDeltaChunks = chunks.filter(chunk => chunk.type === 'text-delta');
      expect(textDeltaChunks.length).toBe(1);
    });

    it('should filter all reasoning chunks when sendReasoning is explicitly false', async () => {
      const mockStream = new ReadableStream<ChunkType>({
        async start(controller) {
          controller.enqueue({
            type: 'workflow-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: { workflowId: 'test-workflow' },
          });

          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'reasoning-delta',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: { id: 'reasoning-1', text: 'Thinking...' },
              },
            },
          });

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
        WorkflowStreamToAISDKTransformer({ includeTextStreamParts: true, sendReasoning: false }),
      );

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      const reasoningDeltaChunks = chunks.filter(chunk => chunk.type === 'reasoning-delta');
      expect(reasoningDeltaChunks.length).toBe(0);
    });
  });

  describe('workflow-step-output with source chunks', () => {
    it('should include source chunks when sendSources is true', async () => {
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

          // Source chunk from agent inside workflow
          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'source',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'source-1',
                  sourceType: 'url',
                  url: 'https://example.com',
                  title: 'Example Source',
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

      const transformedStream = mockStream.pipeThrough(
        WorkflowStreamToAISDKTransformer({ includeTextStreamParts: true, sendSources: true }),
      );

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      // Should have source-url chunk
      const sourceChunk = chunks.find(chunk => chunk.type === 'source-url');
      expect(sourceChunk).toBeDefined();
      expect(sourceChunk.url).toBe('https://example.com');
      expect(sourceChunk.title).toBe('Example Source');
    });

    it('should filter source chunks when sendSources is not set', async () => {
      const mockStream = new ReadableStream<ChunkType>({
        async start(controller) {
          controller.enqueue({
            type: 'workflow-start',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: { workflowId: 'test-workflow' },
          });

          controller.enqueue({
            type: 'workflow-step-output',
            runId: 'test-run-id',
            from: ChunkFrom.WORKFLOW,
            payload: {
              output: {
                type: 'source',
                from: ChunkFrom.USER,
                runId: 'agent-run-id',
                payload: {
                  id: 'source-1',
                  sourceType: 'url',
                  url: 'https://example.com',
                  title: 'Example Source',
                },
              },
            },
          });

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

      // No sendSources option — should filter source chunks
      const transformedStream = mockStream.pipeThrough(
        WorkflowStreamToAISDKTransformer({ includeTextStreamParts: true }),
      );

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      const sourceChunks = chunks.filter(chunk => chunk.type === 'source-url' || chunk.type === 'source-document');
      expect(sourceChunks.length).toBe(0);
    });
  });
});
