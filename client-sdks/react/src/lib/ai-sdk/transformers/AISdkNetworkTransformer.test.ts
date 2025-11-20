import { describe, it, expect, beforeEach } from 'vitest';
import { AISdkNetworkTransformer } from './AISdkNetworkTransformer';
import { MastraUIMessage, MastraUIMessageMetadata } from '../types';
import { NetworkChunkType, ChunkFrom } from '@mastra/core/stream';

describe('AISdkNetworkTransformer', () => {
  let transformer: AISdkNetworkTransformer;
  const baseMetadata: MastraUIMessageMetadata = {
    mode: 'network',
  };

  beforeEach(() => {
    transformer = new AISdkNetworkTransformer();
  });

  describe('transform - routing-agent-text-delta', () => {
    it('should add new text part when none exists', () => {
      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: 'Hello' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0].parts).toEqual([
        {
          type: 'text',
          text: 'Hello',
          state: 'streaming',
        },
      ]);
    });

    it('should append text to existing text part', () => {
      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: ' world' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Hello',
              state: 'streaming',
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toEqual([
        {
          type: 'text',
          text: 'Hello world',
          state: 'streaming',
        },
      ]);
    });

    it('should return unchanged if no assistant message exists', () => {
      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: 'Hello' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual(conversation);
    });

    it('should return unchanged for empty conversation', () => {
      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: 'Hello' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });

    it('should handle non-text parts in message', () => {
      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: 'New text' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'source-url',
              sourceId: 'src-1',
              url: 'https://example.com',
              title: 'Example',
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toHaveLength(2);
      expect(result[0].parts[1]).toEqual({
        type: 'text',
        text: 'New text',
        state: 'streaming',
      });
    });
  });

  describe('transform - network-execution-event-step-finish', () => {
    it('should add text part if none exists', () => {
      const chunk: NetworkChunkType = {
        type: 'network-execution-event-step-finish',
        payload: { result: 'Task completed' } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toEqual([
        {
          type: 'text',
          text: 'Task completed',
          state: 'done',
        },
      ]);
    });

    it('should mark existing text part as done', () => {
      const chunk: NetworkChunkType = {
        type: 'network-execution-event-step-finish',
        payload: { result: 'Final result' } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Streaming text',
              state: 'streaming',
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toEqual([
        {
          type: 'text',
          text: 'Streaming text',
          state: 'done',
        },
      ]);
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: NetworkChunkType = {
        type: 'network-execution-event-step-finish',
        payload: { result: 'Result' } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });

    it('should return unchanged if last message is not assistant', () => {
      const chunk: NetworkChunkType = {
        type: 'network-execution-event-step-finish',
        payload: { result: 'Result' } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual(conversation);
    });
  });

  describe('transform - agent-execution-start', () => {
    it('should create new message with agent tool call', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-start',
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Search for weather',
            primitiveId: 'weather-agent',
            primitiveType: 'agent',
            prompt: 'What is the weather?',
            result: '',
            selectionReason: 'Best match',
            iteration: 0,
          },
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'weather-agent',
            toolCallId: 'run-123',
            state: 'input-available',
            input: (chunk.payload as any).args,
          },
        ],
        metadata: {
          mode: 'network',
          from: ChunkFrom.AGENT,
          selectionReason: 'Best match',
          agentInput: 'Search for weather',
        },
      });
      expect(result[0].id).toMatch(/^agent-execution-start-run-123-/);
    });

    it('should return unchanged if missing primitiveId', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-start',
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Search',
            // primitiveId missing
            primitiveType: 'agent',
          } as any,
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });

    it('should return unchanged if missing runId', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-start',
        payload: {
          agentId: 'agent-1',
          runId: '',
          args: {
            task: 'Search',
            primitiveId: 'test-agent',
            primitiveType: 'agent',
          } as any,
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });

    it('should handle agent with empty selectionReason', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-start',
        payload: {
          agentId: 'agent-1',
          runId: 'run-123',
          args: {
            task: 'Task',
            primitiveId: 'agent-id',
            primitiveType: 'agent',
          } as any,
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].metadata).toMatchObject({
        selectionReason: '',
      });
    });
  });

  describe('transform - agent-execution-end', () => {
    it('should update tool with result', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-end',
        payload: {
          task: 'Search',
          agentId: 'agent-1',
          result: 'Weather is sunny',
          isComplete: true,
          iteration: 0,
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'weather-agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        type: 'dynamic-tool',
        toolName: 'weather-agent',
        toolCallId: 'run-123',
        state: 'output-available',
        output: {
          result: 'Weather is sunny',
        },
      });
    });

    it('should preserve existing output when updating', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-end',
        payload: {
          task: 'Process',
          agentId: 'agent-1',
          result: 'Final result',
          isComplete: true,
          iteration: 0,
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'process-agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [{ type: 'text', content: 'Processing...' }],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output).toMatchObject({
        childMessages: [{ type: 'text', content: 'Processing...' }],
        result: 'Final result',
      });
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-end',
        payload: {
          task: 'Task',
          agentId: 'agent-1',
          result: 'Result',
          isComplete: true,
          iteration: 0,
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });

    it('should handle missing tool part gracefully', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-end',
        payload: {
          task: 'Task',
          agentId: 'agent-1',
          result: 'Result',
          isComplete: true,
          iteration: 0,
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'No tool here',
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      // Should return the conversation with parts unchanged
      expect(result[0].parts).toEqual([
        {
          type: 'text',
          text: 'No tool here',
        },
      ]);
    });
  });

  describe('transform - agent-execution-event (text-delta)', () => {
    it('should append text to child messages', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        payload: {
          type: 'text-delta',
          payload: { text: ' world' },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [{ type: 'text', content: 'Hello' }],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toEqual([{ type: 'text', content: 'Hello world' }]);
    });

    it('should create new text message if last is not text', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        payload: {
          type: 'text-delta',
          payload: { text: 'New text' },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [{ type: 'tool', toolCallId: 'tool-1' }],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toHaveLength(2);
      expect(output.childMessages[1]).toEqual({ type: 'text', content: 'New text' });
    });

    it('should initialize childMessages if not exists', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        payload: {
          type: 'text-delta',
          payload: { text: 'First text' },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toEqual([{ type: 'text', content: 'First text' }]);
    });
  });

  describe('transform - agent-execution-event (tool-call)', () => {
    it('should add tool call to child messages', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-call',
        payload: {
          type: 'tool-call',
          payload: {
            toolCallId: 'call-1',
            toolName: 'search',
            args: { query: 'test' },
          },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toEqual([
        {
          type: 'tool',
          toolCallId: 'call-1',
          toolName: 'search',
          args: { query: 'test' },
        },
      ]);
    });

    it('should preserve existing child messages when adding tool call', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-call',
        payload: {
          type: 'tool-call',
          payload: {
            toolCallId: 'call-2',
            toolName: 'calculator',
            args: { a: 1, b: 2 },
          },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [{ type: 'text', content: 'Thinking...' }],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toHaveLength(2);
      expect(output.childMessages[0]).toEqual({ type: 'text', content: 'Thinking...' });
      expect(output.childMessages[1]).toMatchObject({ type: 'tool', toolCallId: 'call-2' });
    });
  });

  describe('transform - agent-execution-event (tool-output workflow)', () => {
    it('should accumulate workflow state in tool output', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-output',
        payload: {
          type: 'tool-output',
          payload: {
            output: {
              type: 'workflow-start',
              payload: { workflowId: 'wf-1' },
              runId: 'wf-run-1',
            },
          },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [
                  {
                    type: 'tool',
                    toolCallId: 'wf-call-1',
                    toolName: 'workflow',
                  },
                ],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages[0].toolOutput).toMatchObject({
        status: 'running',
        steps: {},
      });
    });

    it('should update existing workflow state', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-output',
        payload: {
          type: 'tool-output',
          payload: {
            output: {
              type: 'workflow-step-result',
              payload: {
                id: 'step1',
                status: 'success',
                output: 'result',
              },
              runId: 'wf-run-1',
            },
          },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [
                  {
                    type: 'tool',
                    toolCallId: 'wf-call-1',
                    toolName: 'workflow',
                    toolOutput: {
                      status: 'running',
                      steps: {},
                    },
                  },
                ],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages[0].toolOutput.steps).toHaveProperty('step1');
    });

    it('should handle workflow output when no tool messages exist', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-output',
        payload: {
          type: 'tool-output',
          payload: {
            output: {
              type: 'workflow-start',
              payload: {},
              runId: 'wf-run-1',
            },
          },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      // Should handle gracefully when no tool messages exist
      expect(result[0].parts[0]).toBeDefined();
    });
  });

  describe('transform - agent-execution-event (tool-result)', () => {
    it('should add tool result to child messages', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-result',
        payload: {
          type: 'tool-result',
          payload: {
            toolCallId: 'call-1',
            toolName: 'search',
            result: { items: ['result1', 'result2'] },
          },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [
                  {
                    type: 'tool',
                    toolCallId: 'call-1',
                    toolName: 'search',
                  },
                ],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages[0].toolOutput).toEqual({ items: ['result1', 'result2'] });
    });

    it('should handle workflow tool result', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-result',
        payload: {
          type: 'tool-result',
          payload: {
            toolCallId: 'wf-call-1',
            toolName: 'workflow-test',
            result: {
              result: {
                steps: { step1: { status: 'success' } },
              },
            },
          },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [
                  {
                    type: 'tool',
                    toolCallId: 'wf-call-1',
                    toolName: 'workflow-test',
                  },
                ],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages[0].toolOutput).toEqual({
        steps: { step1: { status: 'success' } },
      });
    });

    it('should handle when no tool messages exist', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-tool-result',
        payload: {
          type: 'tool-result',
          payload: {
            result: 'result',
          },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'run-123',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [],
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      // Should handle gracefully
      expect(result[0].parts[0]).toBeDefined();
    });
  });

  describe('transform - agent-execution-event (no tool part)', () => {
    it('should return unchanged if no tool part exists', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        payload: {
          type: 'text-delta',
          payload: { text: 'text' },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'No tool part',
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual(conversation);
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        payload: {
          type: 'text-delta',
          payload: { text: 'text' },
        } as any,
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });
  });

  describe('transform - workflow-execution-start', () => {
    it('should create new message with workflow tool call', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-start',
        payload: {
          name: 'data-workflow',
          runId: 'wf-run-1',
          args: {
            task: 'Process data',
            primitiveId: 'data-processor',
            primitiveType: 'workflow',
            prompt: '{"input": "data"}',
            result: '',
            selectionReason: 'Data processing needed',
            iteration: 0,
          },
        },
        runId: 'wf-run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'data-processor',
            toolCallId: 'wf-run-1',
            state: 'input-available',
            input: chunk.payload.args,
          },
        ],
        metadata: {
          mode: 'network',
          from: 'WORKFLOW',
          selectionReason: 'Data processing needed',
          agentInput: { input: 'data' },
        },
      });
      expect(result[0].id).toMatch(/^workflow-start-wf-run-1-/);
    });

    it('should handle non-JSON prompt', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-start',
        payload: {
          name: 'workflow',
          runId: 'wf-run-1',
          args: {
            task: 'Task',
            primitiveId: 'wf-id',
            primitiveType: 'workflow',
            prompt: 'Plain text prompt',
          } as any,
        },
        runId: 'wf-run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].metadata).toMatchObject({
        agentInput: 'Plain text prompt',
      });
    });

    it('should return unchanged if missing primitiveId', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-start',
        payload: {
          name: 'workflow',
          runId: 'wf-run-1',
          args: {
            task: 'Task',
            primitiveType: 'workflow',
          } as any,
        },
        runId: 'wf-run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });

    it('should return unchanged if missing runId', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-start',
        payload: {
          name: 'workflow',
          runId: '',
          args: {
            task: 'Task',
            primitiveId: 'wf-id',
            primitiveType: 'workflow',
          } as any,
        },
        runId: 'wf-run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });
  });

  describe('transform - workflow-execution-event', () => {
    it('should accumulate workflow state', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-event-workflow-start',
        payload: {
          type: 'workflow-start',
          payload: { workflowId: 'wf-1' },
          runId: 'wf-run-1',
          from: 'WORKFLOW',
        } as any,
        runId: 'wf-run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'workflow',
              toolCallId: 'wf-run-1',
              state: 'input-available',
              input: {},
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output).toMatchObject({
        status: 'running',
        steps: {},
      });
    });

    it('should update existing workflow state', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-event-workflow-step-result',
        payload: {
          type: 'workflow-step-result',
          payload: {
            id: 'step1',
            status: 'success',
            output: 'Step completed',
          },
          runId: 'wf-run-1',
          from: 'WORKFLOW',
        } as any,
        runId: 'wf-run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'workflow',
              toolCallId: 'wf-run-1',
              state: 'input-available',
              input: {},
              output: {
                status: 'running',
                steps: {},
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      const output = (result[0].parts[0] as any).output;
      expect(output.steps).toHaveProperty('step1');
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-event-workflow-start',
        payload: {
          type: 'workflow-start',
        } as any,
        runId: 'wf-run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });

    it('should return unchanged if no tool part', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-event-workflow-start',
        payload: {
          type: 'workflow-start',
        } as any,
        runId: 'wf-run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'No tool',
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual(conversation);
    });

    it('should return unchanged if tool part is not dynamic-tool', () => {
      const chunk: NetworkChunkType = {
        type: 'workflow-execution-event-workflow-start',
        payload: {
          type: 'workflow-start',
        } as any,
        runId: 'wf-run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'source-url',
              sourceId: 'src-1',
              url: 'https://example.com',
              title: 'Example',
            } as any,
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual(conversation);
    });
  });

  describe('transform - tool-execution-start', () => {
    it('should create new message when no assistant message exists', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-start',
        payload: {
          args: {
            toolName: 'calculator',
            toolCallId: 'calc-1',
            args: { a: 1, b: 2 },
            selectionReason: 'Math needed',
          } as any,
          runId: 'run-123',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'calculator',
            toolCallId: 'calc-1',
            state: 'input-available',
            input: { a: 1, b: 2 },
          },
        ],
        metadata: {
          mode: 'network',
          selectionReason: 'Math needed',
          agentInput: { a: 1, b: 2 },
        },
      });
      expect(result[0].id).toMatch(/^tool-start-run-123-/);
    });

    it('should add tool to existing assistant message', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-start',
        payload: {
          args: {
            toolName: 'search',
            toolCallId: 'search-1',
            args: { query: 'test' },
          } as any,
          runId: 'run-123',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Let me search for that',
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toHaveLength(2);
      expect(result[0].parts[1]).toMatchObject({
        type: 'dynamic-tool',
        toolName: 'search',
        toolCallId: 'search-1',
        state: 'input-available',
        input: { query: 'test' },
      });
    });

    it('should handle missing toolName', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-start',
        payload: {
          args: {
            toolCallId: 'unknown-1',
            args: {},
          } as any,
          runId: 'run-123',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        toolName: 'unknown',
      });
    });

    it('should handle missing toolCallId', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-start',
        payload: {
          args: {
            toolName: 'test-tool',
            args: {},
          } as any,
          runId: 'run-123',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        toolCallId: 'unknown',
      });
    });

    it('should use selectionReason from args if metadata mode is network', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-start',
        payload: {
          args: {
            toolName: 'tool',
            toolCallId: 'tool-1',
            args: {},
            selectionReason: 'From args',
          } as any,
          runId: 'run-123',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const metadata: MastraUIMessageMetadata = {
        mode: 'network',
        selectionReason: 'From metadata',
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata });

      expect(result[0].metadata).toMatchObject({
        selectionReason: 'From metadata',
      });
    });

    it('should handle empty selectionReason', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-start',
        payload: {
          args: {
            toolName: 'tool',
            toolCallId: 'tool-1',
            args: {},
          } as any,
          runId: 'run-123',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].metadata).toMatchObject({
        selectionReason: undefined,
      });
    });
  });

  describe('transform - tool-execution-end', () => {
    it('should update tool with result', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-end',
        payload: {
          task: 'Calculate',
          primitiveId: 'calculator',
          primitiveType: 'tool',
          result: 42,
          isComplete: true,
          iteration: 0,
          toolCallId: 'calc-1',
          toolName: 'calculator',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'calculator',
              toolCallId: 'calc-1',
              state: 'input-available',
              input: { a: 20, b: 22 },
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        type: 'dynamic-tool',
        toolName: 'calculator',
        toolCallId: 'calc-1',
        state: 'output-available',
        output: 42,
      });
    });

    it('should preserve existing output result', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-end',
        payload: {
          task: 'Task',
          primitiveId: 'tool',
          primitiveType: 'tool',
          result: 'new result',
          isComplete: true,
          iteration: 0,
          toolCallId: 'tool-1',
          toolName: 'tool',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'tool',
              toolCallId: 'tool-1',
              state: 'input-available',
              input: {},
              output: {
                result: 'existing result',
              } as any,
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect((result[0].parts[0] as any).output).toBe('existing result');
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-end',
        payload: {
          task: 'Task',
          primitiveId: 'tool',
          primitiveType: 'tool',
          result: 'result',
          isComplete: true,
          iteration: 0,
          toolCallId: 'tool-1',
          toolName: 'tool',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });

    it('should return unchanged if tool not found', () => {
      const chunk: NetworkChunkType = {
        type: 'tool-execution-end',
        payload: {
          task: 'Task',
          primitiveId: 'tool',
          primitiveType: 'tool',
          result: 'result',
          isComplete: true,
          iteration: 0,
          toolCallId: 'missing-1',
          toolName: 'tool',
        },
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'other-tool',
              toolCallId: 'other-1',
              state: 'input-available',
              input: {},
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      // Tool should remain unchanged
      expect(result[0].parts[0]).toMatchObject({
        toolCallId: 'other-1',
        state: 'input-available',
      });
    });
  });

  describe('transform - unknown chunk types', () => {
    it('should return unchanged for unknown chunk type', () => {
      const chunk: any = {
        type: 'unknown-type',
        payload: {},
        runId: 'run-123',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Existing message',
            },
          ],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual(conversation);
    });
  });

  describe('immutability', () => {
    it('should not mutate original conversation array', () => {
      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: 'New text' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const originalLength = conversation.length;
      const originalParts = conversation[0].parts;

      transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(conversation.length).toBe(originalLength);
      expect(conversation[0].parts).toBe(originalParts);
    });

    it('should return new array reference', () => {
      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: 'Text' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result).not.toBe(conversation);
    });

    it('should create new message objects when modifying', () => {
      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: ' added' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const originalMessage: MastraUIMessage = {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Original',
            state: 'streaming',
          },
        ],
      };

      const conversation: MastraUIMessage[] = [originalMessage];
      const result = transformer.transform({ chunk, conversation, metadata: baseMetadata });

      expect(result[0]).not.toBe(originalMessage);
      expect(result[0].parts).not.toBe(originalMessage.parts);
      expect(originalMessage.parts[0]).toMatchObject({
        text: 'Original',
      });
    });
  });
});
