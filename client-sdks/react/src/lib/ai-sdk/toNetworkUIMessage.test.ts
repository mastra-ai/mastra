import { describe, it, expect } from 'vitest';
import { toNetworkUIMessage } from './toNetworkUIMessage';
import { NetworkChunkType, ChunkFrom } from '@mastra/core/stream';
import { MastraUIMessage } from './toUIMessage';

describe('toNetworkUIMessage', () => {
  describe('agent-execution-start', () => {
    it('should create a new assistant message with dynamic-tool part', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Test task',
            primitiveId: 'my-agent',
            primitiveType: 'agent',
            prompt: 'Hello agent',
            result: '',
            isComplete: false,
            selectionReason: 'User requested',
            iteration: 0,
          },
        },
      };

      const conversation: MastraUIMessage[] = [];
      const result = toNetworkUIMessage({ chunk, conversation });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'run-123',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'my-agent',
            toolCallId: 'run-123',
            state: 'input-available',
            input: expect.objectContaining({
              task: 'Test task',
              primitiveId: 'my-agent',
              primitiveType: 'agent',
              prompt: 'Hello agent',
            }),
            output: {
              networkMetadata: {
                selectionReason: 'User requested',
                from: 'AGENT',
              },
              result: undefined,
            },
          },
        ],
      });
    });

    it('should return unchanged conversation if primitiveId or runId is missing', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Test task',
            primitiveId: '',
            primitiveType: 'agent',
            prompt: 'Hello agent',
            result: '',
            selectionReason: '',
            iteration: 0,
          },
        },
      };

      const conversation: MastraUIMessage[] = [];
      const result = toNetworkUIMessage({ chunk, conversation });

      expect(result).toEqual([]);
    });
  });

  describe('workflow-execution-start', () => {
    it('should create a new assistant message with WORKFLOW from type', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-start',
        runId: 'workflow-run-123',
        from: ChunkFrom.WORKFLOW,
        payload: {
          name: 'my-workflow',
          runId: 'workflow-run-123',
          args: {
            task: 'Test workflow',
            primitiveId: 'my-workflow',
            primitiveType: 'workflow',
            prompt: 'Run workflow',
            result: '',
            selectionReason: 'Workflow selected',
            iteration: 0,
          },
        },
      };

      const conversation: MastraUIMessage[] = [];
      const result = toNetworkUIMessage({ chunk, conversation });

      expect(result).toHaveLength(1);
      expect(result[0].parts[0]).toMatchObject({
        input: expect.objectContaining({
          task: 'Test workflow',
          primitiveId: 'my-workflow',
        }),
        output: {
          networkMetadata: {
            selectionReason: 'Workflow selected',
            from: 'WORKFLOW',
          },
          result: undefined,
        },
      });
    });
  });

  describe('agent-execution-event-* chunks', () => {
    it('should accumulate text-delta in messages array', () => {
      // First create the agent message
      const startChunk: NetworkChunkType = {
        type: 'agent-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Test task',
            primitiveId: 'my-agent',
            primitiveType: 'agent',
            prompt: 'Hello',
            result: '',
            selectionReason: '',
            iteration: 0,
          },
        },
      };

      let conversation = toNetworkUIMessage({ chunk: startChunk, conversation: [] });

      // Now add text-delta events
      const textChunk: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          type: 'text-delta',
          payload: {
            id: 'text-1',
            text: 'Hello ',
          },
        },
      };

      conversation = toNetworkUIMessage({ chunk: textChunk, conversation });

      expect(conversation[0].parts[0]).toMatchObject({
        type: 'dynamic-tool',
        input: expect.objectContaining({
          messages: [{ type: 'text', content: 'Hello ' }],
        }),
      });

      // Add more text
      const textChunk2: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          type: 'text-delta',
          payload: {
            id: 'text-1',
            text: 'world',
          },
        },
      };

      conversation = toNetworkUIMessage({ chunk: textChunk2, conversation });

      expect(conversation[0].parts[0]).toMatchObject({
        input: expect.objectContaining({
          messages: [{ type: 'text', content: 'Hello world' }],
        }),
      });
    });

    it('should handle tool-call events by adding to messages array', () => {
      const startChunk: NetworkChunkType = {
        type: 'agent-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Test',
            primitiveId: 'my-agent',
            primitiveType: 'agent',
            prompt: 'Test',
            result: '',
            selectionReason: '',
            iteration: 0,
          },
        },
      };

      let conversation = toNetworkUIMessage({ chunk: startChunk, conversation: [] });

      const toolCallChunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-call',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          type: 'tool-call',
          payload: {
            toolCallId: 'tool-call-1',
            toolName: 'search',
            args: { query: 'test' },
          },
        },
      };

      conversation = toNetworkUIMessage({ chunk: toolCallChunk, conversation });

      expect(conversation[0].parts[0]).toMatchObject({
        input: expect.objectContaining({
          messages: [
            {
              type: 'tool',
              toolCallId: 'tool-call-1',
              toolName: 'search',
              toolInput: { query: 'test' },
            },
          ],
        }),
      });
    });

    it('should handle tool-result events by updating the last tool message', () => {
      const startChunk: NetworkChunkType = {
        type: 'agent-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Test',
            primitiveId: 'my-agent',
            primitiveType: 'agent',
            prompt: 'Test',
            result: '',
            selectionReason: '',
            iteration: 0,
          },
        },
      };

      let conversation = toNetworkUIMessage({ chunk: startChunk, conversation: [] });

      const toolCallChunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-call',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          type: 'tool-call',
          payload: {
            toolCallId: 'tool-call-1',
            toolName: 'search',
            args: { query: 'test' },
          },
        },
      };

      conversation = toNetworkUIMessage({ chunk: toolCallChunk, conversation });

      const toolResultChunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-result',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          type: 'tool-result',
          payload: {
            toolCallId: 'tool-call-1',
            toolName: 'search',
            result: { data: 'found' },
          },
        },
      };

      conversation = toNetworkUIMessage({ chunk: toolResultChunk, conversation });

      expect(conversation[0].parts[0]).toMatchObject({
        input: expect.objectContaining({
          messages: [
            {
              type: 'tool',
              toolCallId: 'tool-call-1',
              toolName: 'search',
              toolInput: { query: 'test' },
              toolOutput: { data: 'found' },
            },
          ],
        }),
      });
    });
  });

  describe('workflow-execution-event-* chunks', () => {
    it('should accumulate workflow state using mapWorkflowStreamChunkToWatchResult in output', () => {
      const startChunk: NetworkChunkType = {
        type: 'workflow-execution-start',
        runId: 'workflow-123',
        from: ChunkFrom.WORKFLOW,
        payload: {
          name: 'my-workflow',
          runId: 'workflow-123',
          args: {
            task: 'Test',
            primitiveId: 'my-workflow',
            primitiveType: 'workflow',
            prompt: 'Test',
            result: '',
            selectionReason: '',
            iteration: 0,
          },
        },
      };

      let conversation = toNetworkUIMessage({ chunk: startChunk, conversation: [] });

      const workflowEventChunk: NetworkChunkType = {
        type: 'workflow-execution-event-step-start',
        runId: 'workflow-123',
        from: ChunkFrom.WORKFLOW,
        payload: {
          type: 'workflow-step-start',
          runId: 'workflow-123',
          from: 'WORKFLOW',
          payload: {
            id: 'step-1',
            status: 'running',
          },
        },
      };

      conversation = toNetworkUIMessage({ chunk: workflowEventChunk, conversation });

      expect(conversation[0].parts[0]).toMatchObject({
        output: expect.any(Object),
      });
    });
  });

  describe('tool-execution-start', () => {
    it('should add a new tool part to the current message', () => {
      const startChunk: NetworkChunkType = {
        type: 'agent-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Test',
            primitiveId: 'my-agent',
            primitiveType: 'agent',
            prompt: 'Test',
            result: '',
            selectionReason: '',
            iteration: 0,
          },
        },
      };

      let conversation = toNetworkUIMessage({ chunk: startChunk, conversation: [] });

      const toolExecStartChunk: NetworkChunkType = {
        type: 'tool-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          runId: 'run-123',
          args: {
            toolName: 'calculator',
            toolCallId: 'calc-1',
            args: { operation: 'add', a: 1, b: 2 },
            selectionReason: 'Math needed',
          },
        },
      };

      conversation = toNetworkUIMessage({ chunk: toolExecStartChunk, conversation });

      expect(conversation[0].parts).toHaveLength(2);
      expect(conversation[0].parts[1]).toMatchObject({
        type: 'dynamic-tool',
        toolName: 'calculator',
        toolCallId: 'calc-1',
        state: 'input-available',
        input: {
          operation: 'add',
          a: 1,
          b: 2,
        },
        output: {
          networkMetadata: {
            selectionReason: 'Math needed',
          },
          result: undefined,
        },
      });
    });
  });

  describe('tool-execution-end', () => {
    it('should mark the tool as output-available with result', () => {
      const startChunk: NetworkChunkType = {
        type: 'agent-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Test',
            primitiveId: 'my-agent',
            primitiveType: 'agent',
            prompt: 'Test',
            result: '',
            selectionReason: '',
            iteration: 0,
          },
        },
      };

      let conversation = toNetworkUIMessage({ chunk: startChunk, conversation: [] });

      const toolExecStartChunk: NetworkChunkType = {
        type: 'tool-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          runId: 'run-123',
          args: {
            toolName: 'calculator',
            toolCallId: 'calc-1',
            args: { operation: 'add' },
          },
        },
      };

      conversation = toNetworkUIMessage({ chunk: toolExecStartChunk, conversation });

      const toolExecEndChunk: NetworkChunkType = {
        type: 'tool-execution-end',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          task: 'Test',
          primitiveId: 'calculator',
          primitiveType: 'tool',
          result: { answer: 3 },
          isComplete: true,
          iteration: 0,
          toolCallId: 'calc-1',
          toolName: 'calculator',
        },
      };

      conversation = toNetworkUIMessage({ chunk: toolExecEndChunk, conversation });

      expect(conversation[0].parts[1]).toMatchObject({
        type: 'dynamic-tool',
        toolName: 'calculator',
        toolCallId: 'calc-1',
        state: 'output-available',
        output: {
          networkMetadata: {
            selectionReason: '',
          },
          result: { answer: 3 },
        },
      });
    });
  });

  describe('agent-execution-end', () => {
    it('should mark the agent tool as output-available', () => {
      const startChunk: NetworkChunkType = {
        type: 'agent-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Test',
            primitiveId: 'my-agent',
            primitiveType: 'agent',
            prompt: 'Test',
            result: 'Agent completed successfully',
            selectionReason: '',
            iteration: 0,
          },
        },
      };

      let conversation = toNetworkUIMessage({ chunk: startChunk, conversation: [] });

      const endChunk: NetworkChunkType = {
        type: 'agent-execution-end',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          task: 'Test',
          agentId: 'agent-1',
          result: 'Agent completed successfully',
          isComplete: true,
          iteration: 0,
        },
      };

      conversation = toNetworkUIMessage({ chunk: endChunk, conversation });

      expect(conversation[0].parts[0]).toMatchObject({
        type: 'dynamic-tool',
        state: 'output-available',
        output: {
          networkMetadata: {
            selectionReason: '',
            from: 'AGENT',
          },
          result: 'Agent completed successfully',
        },
      });
    });
  });

  describe('workflow-execution-end', () => {
    it('should mark the workflow tool as output-available', () => {
      const startChunk: NetworkChunkType = {
        type: 'workflow-execution-start',
        runId: 'workflow-123',
        from: ChunkFrom.WORKFLOW,
        payload: {
          name: 'my-workflow',
          runId: 'workflow-123',
          args: {
            task: 'Test',
            primitiveId: 'my-workflow',
            primitiveType: 'workflow',
            prompt: 'Test',
            result: 'Workflow completed',
            selectionReason: '',
            iteration: 0,
          },
        },
      };

      let conversation = toNetworkUIMessage({ chunk: startChunk, conversation: [] });

      const endChunk: NetworkChunkType = {
        type: 'workflow-execution-end',
        runId: 'workflow-123',
        from: ChunkFrom.WORKFLOW,
        payload: {
          task: 'Test',
          primitiveId: 'my-workflow',
          primitiveType: 'workflow',
          result: 'Workflow completed',
          isComplete: true,
          iteration: 0,
        },
      };

      conversation = toNetworkUIMessage({ chunk: endChunk, conversation });

      expect(conversation[0].parts[0]).toMatchObject({
        state: 'output-available',
        output: {
          networkMetadata: {
            selectionReason: '',
            from: 'WORKFLOW',
          },
          result: 'Workflow completed',
        },
      });
    });
  });

  describe('network-execution-event-step-finish', () => {
    it('should create a new text message with the result', () => {
      const chunk: NetworkChunkType = {
        type: 'network-execution-event-step-finish',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          task: 'Test',
          result: 'Final result text',
          isComplete: true,
          iteration: 1,
        },
      };

      const conversation: MastraUIMessage[] = [];
      const result = toNetworkUIMessage({ chunk, conversation });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'run-123',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Final result text',
            state: 'done',
          },
        ],
      });
    });
  });

  describe('integration: full agent execution flow', () => {
    it('should properly accumulate all chunks into ONE message', () => {
      let conversation: MastraUIMessage[] = [];

      // 1. Agent execution start
      const startChunk: NetworkChunkType = {
        type: 'agent-execution-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Search and summarize',
            primitiveId: 'search-agent',
            primitiveType: 'agent',
            prompt: 'Find info about AI',
            result: '',
            selectionReason: 'User needs information',
            iteration: 0,
          },
        },
      };
      conversation = toNetworkUIMessage({ chunk: startChunk, conversation });
      expect(conversation).toHaveLength(1);

      // 2. Text delta
      const textChunk: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          type: 'text-delta',
          payload: { id: 'text-1', text: 'Searching...' },
        },
      };
      conversation = toNetworkUIMessage({ chunk: textChunk, conversation });
      expect(conversation).toHaveLength(1);

      // 3. Tool call
      const toolCallChunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-call',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          type: 'tool-call',
          payload: {
            toolCallId: 'search-1',
            toolName: 'web_search',
            args: { query: 'AI information' },
          },
        },
      };
      conversation = toNetworkUIMessage({ chunk: toolCallChunk, conversation });
      expect(conversation).toHaveLength(1);

      // 4. Tool result
      const toolResultChunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-result',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          type: 'tool-result',
          payload: {
            toolCallId: 'search-1',
            toolName: 'web_search',
            result: { results: ['AI is...'] },
          },
        },
      };
      conversation = toNetworkUIMessage({ chunk: toolResultChunk, conversation });
      expect(conversation).toHaveLength(1);

      // 5. More text
      const textChunk2: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          type: 'text-delta',
          payload: { id: 'text-2', text: ' Summary complete.' },
        },
      };
      conversation = toNetworkUIMessage({ chunk: textChunk2, conversation });
      expect(conversation).toHaveLength(1);

      // 6. Agent execution end
      const endChunk: NetworkChunkType = {
        type: 'agent-execution-end',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          task: 'Search and summarize',
          agentId: 'agent-1',
          result: 'AI is a field of computer science...',
          isComplete: true,
          iteration: 0,
        },
      };
      conversation = toNetworkUIMessage({ chunk: endChunk, conversation });

      // Verify: Should still be ONE message with all accumulated state
      expect(conversation).toHaveLength(1);
      expect(conversation[0].parts).toHaveLength(1);
      expect(conversation[0].parts[0]).toMatchObject({
        type: 'dynamic-tool',
        toolName: 'search-agent',
        state: 'output-available',
        input: expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ type: 'text' }),
            expect.objectContaining({ type: 'tool', toolName: 'web_search' }),
          ]),
        }),
      });
    });
  });

  describe('edge cases', () => {
    it('should return unchanged conversation for unsupported chunk types', () => {
      const chunk: NetworkChunkType = {
        type: 'routing-agent-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          inputData: {
            task: 'Test',
            primitiveId: 'router',
            primitiveType: 'agent',
            result: '',
            iteration: 0,
            isOneOff: false,
            verboseIntrospection: false,
          },
        },
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello', state: 'done' }],
        },
      ];

      const result = toNetworkUIMessage({ chunk, conversation });
      expect(result).toEqual(conversation);
    });

    it('should always return new array reference for React', () => {
      const conversation: MastraUIMessage[] = [];
      const chunk: NetworkChunkType = {
        type: 'routing-agent-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          inputData: {
            task: 'Test',
            primitiveId: 'router',
            primitiveType: 'agent',
            result: '',
            iteration: 0,
            isOneOff: false,
            verboseIntrospection: false,
          },
        },
      };

      const result = toNetworkUIMessage({ chunk, conversation });
      expect(result).not.toBe(conversation);
    });
  });
});