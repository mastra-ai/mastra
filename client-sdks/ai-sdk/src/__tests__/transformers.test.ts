import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType, MastraAgentNetworkStream } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';

import { toAISdkV5Stream } from '../convert-streams';
import { transformAgent, WorkflowStreamToAISDKTransformer } from '../transformers';

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

    it('should filter reasoning-delta chunks when sendReasoning is not set', async () => {
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

      // Default behavior (no sendReasoning) should filter reasoning-delta
      const transformedStream = mockStream.pipeThrough(
        WorkflowStreamToAISDKTransformer({ includeTextStreamParts: true }),
      );

      const chunks: any[] = [];
      for await (const chunk of transformedStream) {
        chunks.push(chunk);
      }

      // reasoning-delta should be filtered out (sendReasoning defaults to false)
      const reasoningDeltaChunks = chunks.filter(chunk => chunk.type === 'reasoning-delta');
      expect(reasoningDeltaChunks.length).toBe(0);

      // reasoning-start and reasoning-end still pass through (matching agent stream behavior)
      expect(chunks.find(chunk => chunk.type === 'reasoning-start')).toBeDefined();
      expect(chunks.find(chunk => chunk.type === 'reasoning-end')).toBeDefined();

      // Text should still come through
      const textDeltaChunks = chunks.filter(chunk => chunk.type === 'text-delta');
      expect(textDeltaChunks.length).toBe(1);
    });

    it('should filter reasoning-delta chunks when sendReasoning is explicitly false', async () => {
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

describe('AgentNetworkToAISDKTransformer', () => {
  it('should return NetworkDataPart on each agent-execution-event and workflow-execution-event', async () => {
    const mockStream = new ReadableStream({
      async start(controller) {
        // Network start
        controller.enqueue({
          type: 'routing-agent-start',
          runId: 'network-run-1',
          payload: {
            networkId: 'test-network',
            agentId: 'test-agent',
            runId: 'agent-run-1',
            inputData: {
              iteration: 0,
              task: null,
              threadId: 'thread-1',
              threadResourceId: 'resource-1',
            },
          },
        });

        // Agent execution start
        controller.enqueue({
          type: 'agent-execution-start',
          runId: 'network-run-1',
          payload: {
            agentId: 'test-agent',
            runId: 'agent-run-1',
            args: {
              prompt: 'test prompt',
              iteration: 0,
            },
          },
        });

        // Agent execution event (should return NetworkDataPart)
        controller.enqueue({
          type: 'agent-execution-event-start',
          runId: 'network-run-1',
          payload: {
            type: 'start',
            runId: 'agent-run-1',
            from: 'AGENT',
            payload: {
              id: 'test-agent',
            },
          },
        });

        // Workflow execution start
        controller.enqueue({
          type: 'workflow-execution-start',
          runId: 'network-run-1',
          payload: {
            workflowId: 'test-workflow',
            runId: 'workflow-run-1',
            args: {
              prompt: 'test prompt',
              iteration: 0,
            },
          },
        });

        // Workflow execution event (should return NetworkDataPart)
        controller.enqueue({
          type: 'workflow-execution-event-workflow-start',
          runId: 'network-run-1',
          payload: {
            type: 'workflow-start',
            runId: 'workflow-run-1',
            payload: {
              workflowId: 'test-workflow',
            },
          },
        });

        // Network finish
        controller.enqueue({
          type: 'network-execution-event-finish',
          runId: 'network-run-1',
          payload: {
            result: 'completed',
            usage: {
              inputTokens: 10,
              outputTokens: 20,
              totalTokens: 30,
            },
          },
        });

        controller.close();
      },
    });

    const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraAgentNetworkStream, { from: 'network' });

    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    // Find all NetworkDataPart chunks
    const networkChunks = chunks.filter(chunk => chunk.type === 'data-network' || chunk.type === 'data-tool-network');

    // Should have NetworkDataPart chunks for:
    // 1. routing-agent-start
    // 2. agent-execution-start
    // 3. agent-execution-event-start (our new behavior - returns NetworkDataPart)
    // 4. workflow-execution-start
    // 5. workflow-execution-event-workflow-start (our new behavior - returns NetworkDataPart)
    // 6. network-execution-event-finish
    expect(networkChunks.length).toBeGreaterThanOrEqual(6);

    // Verify that agent-execution-event-start returns a NetworkDataPart
    // The chunk should have the step with updated task from transformAgent
    const agentEventChunk = networkChunks.find(chunk =>
      chunk.data?.steps?.some((step: any) => step.name === 'test-agent' && step.task),
    );
    expect(agentEventChunk).toBeDefined();
    expect(agentEventChunk?.type).toBe('data-network');
    expect(agentEventChunk?.data.status).toBe('running');
    expect(agentEventChunk?.data.steps).toBeDefined();
    expect(agentEventChunk?.data.name).toBe('test-network');

    // Verify that workflow-execution-event-workflow-start returns a NetworkDataPart
    // The chunk should have the step with updated task from transformWorkflow
    const workflowEventChunk = networkChunks.find(chunk =>
      chunk.data?.steps?.some((step: any) => step.name === 'test-workflow' && step.task),
    );
    expect(workflowEventChunk).toBeDefined();
    expect(workflowEventChunk?.type).toBe('data-network');
    expect(workflowEventChunk?.data.status).toBe('running');
    expect(workflowEventChunk?.data.steps).toBeDefined();
    expect(workflowEventChunk?.data.name).toBe('test-network');

    // Verify that the step's task was updated for agent event (from transformAgent)
    const agentStep = agentEventChunk?.data.steps.find((step: any) => step.name === 'test-agent');
    expect(agentStep).toBeDefined();
    expect(agentStep?.task).toBeDefined();
    expect(agentStep?.task.id).toBe('test-agent');
    expect(agentStep?.task.text).toBe(''); // From transformAgent initial state

    // Verify that the step's task was updated for workflow event (from transformWorkflow)
    const workflowStep = workflowEventChunk?.data.steps.find((step: any) => step.name === 'test-workflow');
    expect(workflowStep).toBeDefined();
    expect(workflowStep?.task).toBeDefined();
    expect(workflowStep?.task.name).toBe('test-workflow'); // From transformWorkflow
  });
});

describe('Network stream - core fix (text events from core)', () => {
  it('should transform routing-agent-text-* events to text-start and text-delta', async () => {
    // This tests the flow when core emits text events (the fix)
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'routing-agent-start',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            networkId: 'test-network',
            agentId: 'routing-agent',
            runId: 'step-run-1',
            inputData: {
              task: 'Who are you?',
              primitiveId: '',
              primitiveType: 'none',
              iteration: 0,
              threadResourceId: 'Test Resource',
              threadId: 'network-run-1',
              isOneOff: false,
            },
          },
        });
        // Core now emits text events when routing agent handles request without delegation
        controller.enqueue({
          type: 'routing-agent-text-start',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: { runId: 'step-run-1' },
        });
        controller.enqueue({
          type: 'routing-agent-text-delta',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: { runId: 'step-run-1', text: 'I am a helpful assistant.' },
        });
        controller.enqueue({
          type: 'routing-agent-end',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            task: 'Who are you?',
            result: 'I am a helpful assistant.',
            primitiveId: 'none',
            primitiveType: 'none',
            prompt: '',
            isComplete: true,
            selectionReason: 'I am a helpful assistant.',
            iteration: 0,
            runId: 'step-run-1',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        });
        controller.enqueue({
          type: 'network-execution-event-step-finish',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            task: 'Who are you?',
            result: 'I am a helpful assistant.',
            primitiveId: 'none',
            primitiveType: 'none',
            isComplete: true,
            iteration: 0,
            runId: 'step-run-1',
          },
        });
        controller.close();
      },
    });

    const transformedStream = toAISdkV5Stream(mockStream as unknown as MastraAgentNetworkStream, { from: 'network' });

    const chunks: any[] = [];
    for await (const chunk of transformedStream) {
      chunks.push(chunk);
    }

    const textStartChunks = chunks.filter(c => c.type === 'text-start');
    const textDeltaChunks = chunks.filter(c => c.type === 'text-delta');

    expect(textStartChunks.length).toBeGreaterThan(0);
    expect(textDeltaChunks.length).toBeGreaterThan(0);

    const textContent = textDeltaChunks.map(c => c.delta || '').join('');
    expect(textContent).toContain('I am a helpful assistant');
  });
});

describe('Network stream - fallback (no text events from core)', () => {
  it('should not emit text fallback when routing agent handles directly (none/none)', async () => {
    // When routing agent handles directly (primitiveId/Type = "none"), the result text is internal
    // routing reasoning, not user-facing content. Text should come from the validation step instead.
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'routing-agent-start',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            networkId: 'test-network',
            agentId: 'routing-agent',
            runId: 'step-run-1',
            inputData: {
              task: 'Who are you?',
              primitiveId: '',
              primitiveType: 'none',
              iteration: 0,
              threadResourceId: 'Test Resource',
              threadId: 'network-run-1',
              isOneOff: false,
            },
          },
        });
        // NO routing-agent-text-start or routing-agent-text-delta events
        controller.enqueue({
          type: 'routing-agent-end',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            task: 'Who are you?',
            result: '',
            primitiveId: 'none',
            primitiveType: 'none',
            prompt: '',
            isComplete: true,
            selectionReason: 'I am a helpful assistant.',
            iteration: 0,
            runId: 'step-run-1',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        });
        controller.enqueue({
          type: 'network-execution-event-step-finish',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            task: 'Who are you?',
            result: 'I am a helpful assistant.',
            primitiveId: 'none',
            primitiveType: 'none',
            isComplete: true,
            iteration: 0,
            runId: 'step-run-1',
          },
        });
        controller.close();
      },
    });

    const transformedStream = toAISdkV5Stream(mockStream as unknown as MastraAgentNetworkStream, { from: 'network' });

    const chunks: any[] = [];
    for await (const chunk of transformedStream) {
      chunks.push(chunk);
    }

    const textStartChunks = chunks.filter(c => c.type === 'text-start');
    const textDeltaChunks = chunks.filter(c => c.type === 'text-delta');
    const dataNetworkChunks = chunks.filter(c => c.type === 'data-network');

    expect(dataNetworkChunks.length).toBeGreaterThan(0);

    const lastNetworkChunk = dataNetworkChunks[dataNetworkChunks.length - 1];
    expect(lastNetworkChunk.data.output).toBe('I am a helpful assistant.');

    // When routing agent handles directly, the fallback should NOT emit text events.
    // The selectionReason is routing logic, not user-facing content.
    // Text events for the actual answer come from the validation step.
    expect(textStartChunks.length).toBe(0);
    expect(textDeltaChunks.length).toBe(0);
  });

  it('should emit text fallback when sub-agent delegation has no text events', async () => {
    // The fallback should still work when a sub-agent was selected (not none/none)
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'routing-agent-start',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            networkId: 'test-network',
            agentId: 'routing-agent',
            runId: 'step-run-1',
            inputData: {
              task: 'Search for something',
              primitiveId: '',
              primitiveType: 'none',
              iteration: 0,
              threadResourceId: 'Test Resource',
              threadId: 'network-run-1',
              isOneOff: false,
            },
          },
        });
        controller.enqueue({
          type: 'routing-agent-end',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            task: 'Search for something',
            result: '',
            primitiveId: 'search-agent',
            primitiveType: 'agent',
            prompt: 'Search for something',
            isComplete: false,
            selectionReason: 'Delegating to search agent.',
            iteration: 0,
            runId: 'step-run-1',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        });
        controller.enqueue({
          type: 'network-execution-event-step-finish',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            task: 'Search for something',
            result: 'Here are the search results.',
            isComplete: true,
            iteration: 0,
            runId: 'step-run-1',
          },
        });
        controller.close();
      },
    });

    const transformedStream = toAISdkV5Stream(mockStream as unknown as MastraAgentNetworkStream, { from: 'network' });

    const chunks: any[] = [];
    for await (const chunk of transformedStream) {
      chunks.push(chunk);
    }

    const textDeltaChunks = chunks.filter(c => c.type === 'text-delta');

    // Fallback SHOULD work for non-none routing (sub-agent delegation)
    expect(textDeltaChunks.length).toBeGreaterThan(0);
    const textContent = textDeltaChunks.map(c => c.delta || '').join('');
    expect(textContent).toContain('Here are the search results');
  });
});

/**
 * Tests documenting the tool-result JSON leak bug (#13268).
 *
 * Bug: When using chatRoute with multi-step agent execution, some models
 * (e.g. gpt-oss-120b via OpenRouter) echo previous tool-result JSON as
 * text-delta events in intermediate steps. This causes raw JSON like
 * '{"priority":"critical","recommendation":"..."}' to appear as visible
 * text in the chat UI.
 *
 * These tests reproduce the bug scenario from the issue and document
 * current behavior so we can validate any fix against them.
 */
describe('transformAgent - tool-result JSON leak (#13268)', () => {
  function createBufferedSteps(runId: string) {
    const bufferedSteps = new Map<string, any>();
    bufferedSteps.set(runId, {
      id: runId,
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: [],
      sources: [],
      files: [],
      steps: [],
      status: 'running',
      response: { id: '', timestamp: new Date(), modelId: '', messages: [], uiMessages: [] },
    });
    return bufferedSteps;
  }

  describe('bug reproduction: model echoes tool-result JSON as text', () => {
    it('leaks tool-result JSON into step text when model echoes it as text-delta', () => {
      // Issue scenario: Step has tool calls, but model also emits a previous
      // step's tool result as a text-delta. On main, this JSON ends up in step text
      // and is shown to the user as raw JSON in the chat UI.
      const runId = 'run-1';
      const bufferedSteps = createBufferedSteps(runId);

      // Model echoes previous tool result as text-delta (the bug)
      transformAgent(
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: '{"priority":"critical","recommendation":"upgrade immediately"}' },
        } as ChunkType,
        bufferedSteps,
      );

      // Model also makes a tool call in this step
      transformAgent(
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'recordDefect', args: { id: '123' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-result',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'recordDefect', result: { saved: true } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'tool-calls', warnings: [] },
            output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      const step = bufferedSteps.get(runId)!.steps[0];

      // Tool-result JSON echoed by the model should NOT appear as step text
      expect(step.text).not.toContain('{"priority":"critical"');
      expect(step.toolCalls).toHaveLength(1);
    });

    it('reproduces the full 3-step scenario from issue #13268', () => {
      // Issue describes: Step 1 (classifyDefect tool call) -> Step 2 (recordDefect +
      // updateStepStatus tool calls, with leaked JSON as text) -> Step 3 (text response)
      const runId = 'run-1';
      const bufferedSteps = createBufferedSteps(runId);

      // --- Step 1: classifyDefect tool call (works fine) ---
      transformAgent(
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'classifyDefect', args: { description: 'valve leak' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-result',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            toolCallId: 'tc-1',
            toolName: 'classifyDefect',
            result: { priority: 'critical', recommendation: 'upgrade immediately' },
          },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'tool-calls', warnings: [] },
            output: { usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      const step1 = bufferedSteps.get(runId)!.steps[0];
      expect(step1.text).toBe('');
      expect(step1.toolCalls).toHaveLength(1);

      // --- Step 2: model echoes Step 1 tool result as text, then makes more tool calls ---
      // This is the buggy step — model emits the classifyDefect result as text-delta
      transformAgent(
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: '{"priority":"critical","recommendation":"upgrade immediately"}' },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-2', toolName: 'recordDefect', args: { id: 'D-001' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-result',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-2', toolName: 'recordDefect', result: { saved: true } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-3', toolName: 'updateStepStatus', args: { step: 'inspect', status: 'done' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-result',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-3', toolName: 'updateStepStatus', result: { updated: true } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'tool-calls', warnings: [] },
            output: { usage: { inputTokens: 30, outputTokens: 20, totalTokens: 50 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      const step2 = bufferedSteps.get(runId)!.steps[1];
      // Leaked JSON from Step 1's tool result should NOT appear as text in Step 2
      expect(step2.text).not.toContain('{"priority":"critical"');
      expect(step2.toolCalls).toHaveLength(2);

      // --- Step 3: actual text response (works fine) ---
      transformAgent(
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: 'The defect has been classified as critical and recorded.' },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'stop', warnings: [] },
            output: { usage: { inputTokens: 40, outputTokens: 15, totalTokens: 55 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      const step3 = bufferedSteps.get(runId)!.steps[2];
      expect(step3.text).toBe('The defect has been classified as critical and recorded.');
      expect(step3.toolCalls).toHaveLength(0);
    });
  });

  describe('baseline: text accumulation works correctly for non-buggy cases', () => {
    it('preserves text when step has no tool calls', () => {
      const runId = 'run-1';
      const bufferedSteps = createBufferedSteps(runId);

      transformAgent(
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: 'Here is the analysis: ' },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: 'the system is healthy.' },
        } as ChunkType,
        bufferedSteps,
      );

      expect(bufferedSteps.get(runId)!.text).toBe('Here is the analysis: the system is healthy.');
      expect(bufferedSteps.get(runId)!.toolCalls).toHaveLength(0);
    });

    it('produces correct text in step result for text-only steps', () => {
      const runId = 'run-1';
      const bufferedSteps = createBufferedSteps(runId);

      transformAgent(
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: 'The answer is 42.' },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'stop', warnings: [] },
            output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      const stepResult = bufferedSteps.get(runId)!.steps[0];
      expect(stepResult.text).toBe('The answer is 42.');
      expect(stepResult.toolCalls).toHaveLength(0);
    });

    it('produces empty text for tool-call-only steps (no text-delta emitted)', () => {
      const runId = 'run-1';
      const bufferedSteps = createBufferedSteps(runId);

      // Step with only tool calls, no text-delta at all (well-behaved model)
      transformAgent(
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'search', args: { q: 'test' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-result',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'search', result: { data: 'found' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'tool-calls', warnings: [] },
            output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      const stepResult = bufferedSteps.get(runId)!.steps[0];
      expect(stepResult.text).toBe('');
      expect(stepResult.toolCalls).toHaveLength(1);
    });

    it('isolates text between steps in multi-step execution', () => {
      const runId = 'run-1';
      const bufferedSteps = createBufferedSteps(runId);

      // --- Step 1: tool-call only (well-behaved, no text leak) ---
      transformAgent(
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'search', args: { q: 'test' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-result',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'search', result: { data: 'result' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'tool-calls', warnings: [] },
            output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      // --- Step 2: text response ---
      transformAgent(
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: 'Based on the search results, here is the answer.' },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'stop', warnings: [] },
            output: { usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      const step1 = bufferedSteps.get(runId)!.steps[0];
      expect(step1.text).toBe('');
      expect(step1.toolCalls).toHaveLength(1);

      const step2 = bufferedSteps.get(runId)!.steps[1];
      expect(step2.text).toBe('Based on the search results, here is the answer.');
      // NOTE: transformAgent on main does not reset per-step state on step-finish,
      // so step 1's toolCalls bleed into step 2's snapshot.
      expect(step2.toolCalls).toHaveLength(1);
    });
  });

  describe('edge case: legitimate text alongside tool calls', () => {
    it('accumulates legitimate pre-tool-call text into step result', () => {
      // Some models emit text like "Let me search for that" before making a tool call.
      // This is legitimate behavior — unlike leaked JSON, this is intentional model output.
      // Currently this text is accumulated into the step result.
      const runId = 'run-1';
      const bufferedSteps = createBufferedSteps(runId);

      transformAgent(
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: 'Let me look that up for you.' },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'web_search', args: { query: 'weather' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'tool-result',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'web_search', result: { temp: '72F' } },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'tool-calls', warnings: [] },
            output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      const stepResult = bufferedSteps.get(runId)!.steps[0];
      // Legitimate text is preserved in step result (not leaked JSON)
      expect(stepResult.text).toBe('Let me look that up for you.');
      expect(stepResult.toolCalls).toHaveLength(1);
    });

    it('accumulates text arriving after tool-call in the same step', () => {
      // Some models may emit text after tool-call chunks in the same step.
      const runId = 'run-1';
      const bufferedSteps = createBufferedSteps(runId);

      transformAgent(
        {
          type: 'tool-call',
          runId,
          from: ChunkFrom.AGENT,
          payload: { toolCallId: 'tc-1', toolName: 'search', args: {} },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'text-delta',
          runId,
          from: ChunkFrom.AGENT,
          payload: { text: 'I called the search tool.' },
        } as ChunkType,
        bufferedSteps,
      );

      transformAgent(
        {
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: runId,
            stepResult: { reason: 'tool-calls', warnings: [] },
            output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
            metadata: {},
            messages: { nonUser: [] },
          },
        } as ChunkType,
        bufferedSteps,
      );

      const stepResult = bufferedSteps.get(runId)!.steps[0];
      // Text is accumulated regardless of ordering relative to tool-call
      expect(stepResult.text).toBe('I called the search tool.');
      expect(stepResult.toolCalls).toHaveLength(1);
    });
  });
});
