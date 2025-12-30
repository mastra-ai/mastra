import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType, MastraAgentNetworkStream } from '@mastra/core/stream';
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
        runId: 'agent-run-id',
        toolCallId: 'tool-call-1',
        toolName: 'suspendable-tool',
        suspendPayload: {
          reason: 'Waiting for user approval',
          data: { value: 42 },
        },
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

describe('Network stream text extraction', () => {
  it('should emit text events when routing agent handles request without delegation', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'network-execution-event-start',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: { networkId: 'test-network' },
        });
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
        controller.enqueue({
          type: 'network-execution-event-finish',
          runId: 'network-run-1',
          from: 'NETWORK',
          payload: {
            task: 'Who are you?',
            result: 'I am a helpful assistant.',
            status: 'finished',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
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

    expect(textStartChunks.length).toBeGreaterThan(0);
    expect(textDeltaChunks.length).toBeGreaterThan(0);

    const textContent = textDeltaChunks.map(c => c.delta || '').join('');
    expect(textContent).toContain('I am a helpful assistant');
  });
});
