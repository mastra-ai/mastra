import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveInitialMessages, resolveToChildMessages } from './resolveInitialMessages';
import { MastraUIMessage } from '../types';

describe('resolveInitialMessages', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Network execution data parsing', () => {
    it('should transform network message with agent execution data', () => {
      const networkData = {
        isNetwork: true,
        selectionReason: 'Best agent for the task',
        primitiveType: 'agent',
        primitiveId: 'weather-agent',
        input: 'What is the weather?',
        finalResult: {
          text: 'The weather is sunny',
          toolCalls: [],
          messages: [],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
          metadata: {
            mode: 'generate',
          },
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolCallId: 'weather-agent',
            toolName: 'weather-agent',
            state: 'output-available',
            input: 'What is the weather?',
            output: {
              childMessages: [
                {
                  type: 'text',
                  content: 'The weather is sunny',
                },
              ],
              result: 'The weather is sunny',
            },
          },
        ],
        metadata: {
          mode: 'network',
          selectionReason: 'Best agent for the task',
          agentInput: 'What is the weather?',
          from: 'AGENT',
        },
      });
    });

    it('should transform network message with workflow execution data', () => {
      const networkData = {
        isNetwork: true,
        selectionReason: 'Workflow needed',
        primitiveType: 'workflow',
        primitiveId: 'data-workflow',
        input: { data: 'input' },
        finalResult: {
          text: 'Workflow completed',
          toolCalls: [],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result[0].metadata).toMatchObject({
        mode: 'network',
        from: 'WORKFLOW',
        selectionReason: 'Workflow needed',
      });
    });

    it('should handle network message with tool calls', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'search-agent',
        input: 'Search query',
        finalResult: {
          text: 'Search results',
          toolCalls: [
            {
              type: 'tool-call',
              runId: 'run-1',
              from: 'AGENT',
              payload: {
                toolCallId: 'call-1',
                toolName: 'web-search',
                args: { query: 'test' },
              },
            },
          ],
          messages: [
            {
              role: 'assistant',
              id: 'msg-inner-1',
              createdAt: '2024-01-01',
              type: 'assistant',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call-1',
                  toolName: 'web-search',
                  result: {
                    items: ['result1', 'result2'],
                  },
                },
              ],
            },
          ],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-3',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toHaveLength(2);
      expect(output.childMessages[0]).toEqual({
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'web-search',
        args: { query: 'test' },
        toolOutput: { items: ['result1', 'result2'] },
      });
      expect(output.childMessages[1]).toEqual({
        type: 'text',
        content: 'Search results',
      });
    });

    it('should handle workflow tool result', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'orchestrator',
        input: 'Run workflow',
        finalResult: {
          text: 'Workflow done',
          toolCalls: [
            {
              type: 'tool-call',
              runId: 'run-2',
              from: 'AGENT',
              payload: {
                toolCallId: 'wf-call-1',
                toolName: 'data-workflow',
                args: { input: 'data' },
              },
            },
          ],
          messages: [
            {
              role: 'assistant',
              id: 'msg-inner-2',
              createdAt: '2024-01-01',
              type: 'assistant',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'wf-call-1',
                  toolName: 'data-workflow',
                  result: {
                    result: {
                      steps: {
                        step1: { status: 'success' },
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-4',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages[0]).toMatchObject({
        type: 'tool',
        toolCallId: 'wf-call-1',
        toolName: 'data-workflow',
        toolOutput: {
          steps: {
            step1: { status: 'success' },
          },
        },
      });
    });

    it('should handle tool call without matching result', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-1',
        input: 'test',
        finalResult: {
          text: 'Done',
          toolCalls: [
            {
              type: 'tool-call',
              runId: 'run-3',
              from: 'AGENT',
              payload: {
                toolCallId: 'orphan-call',
                toolName: 'orphan-tool',
                args: {},
              },
            },
          ],
          messages: [],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-5',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages[0]).toEqual({
        type: 'tool',
        toolCallId: 'orphan-call',
        toolName: 'orphan-tool',
        args: {},
        toolOutput: undefined,
      });
    });

    it('should handle empty tool calls array', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-2',
        input: 'test',
        finalResult: {
          text: 'Response',
          toolCalls: [],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-6',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toEqual([
        {
          type: 'text',
          content: 'Response',
        },
      ]);
    });

    it('should handle missing finalResult', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-3',
        input: 'test',
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-7',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      const output = (result[0].parts[0] as any).output;
      expect(output).toEqual({
        childMessages: [],
        result: '',
      });
    });

    it('should handle missing finalResult.text', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-4',
        input: 'test',
        finalResult: {
          toolCalls: [],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-8',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toEqual([]);
      expect(output.result).toBe('');
    });

    it('should handle empty selectionReason', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-5',
        input: 'test',
        finalResult: {
          text: 'Result',
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-9',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result[0].metadata).toMatchObject({
        selectionReason: '',
      });
    });

    it('should handle empty primitiveType', () => {
      const networkData = {
        isNetwork: true,
        primitiveId: 'primitive-1',
        input: 'test',
        finalResult: {
          text: 'Result',
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-10',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result[0].metadata).toMatchObject({
        from: 'WORKFLOW',
      });
    });

    it('should handle string content in nested messages', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-6',
        input: 'test',
        finalResult: {
          text: 'Result',
          toolCalls: [
            {
              type: 'tool-call',
              runId: 'run-4',
              from: 'AGENT',
              payload: {
                toolCallId: 'call-2',
                toolName: 'tool-2',
                args: {},
              },
            },
          ],
          messages: [
            {
              role: 'assistant',
              id: 'msg-inner-3',
              createdAt: '2024-01-01',
              type: 'assistant',
              content: 'String content instead of array',
            },
          ],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-11',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages[0].toolOutput).toBeUndefined();
    });

    it('should skip non-tool-call chunks', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-7',
        input: 'test',
        finalResult: {
          text: 'Result',
          toolCalls: [
            {
              type: 'text-delta',
              runId: 'run-5',
              from: 'AGENT',
              payload: {
                text: 'Not a tool call',
              },
            },
          ],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-12',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toEqual([
        {
          type: 'text',
          content: 'Result',
        },
      ]);
    });

    // Note: Do we still need this test? Leaving it here for now in case we need to log the parsed JSON again.
    // it('should log the parsed JSON', () => {
    //   const networkData = {
    //     isNetwork: true,
    //     primitiveType: 'agent',
    //     primitiveId: 'agent-8',
    //     input: 'test',
    //     finalResult: {
    //       text: 'Result',
    //     },
    //   };

    //   const messages: MastraUIMessage[] = [
    //     {
    //       id: 'msg-13',
    //       role: 'assistant',
    //       parts: [
    //         {
    //           type: 'text',
    //           text: JSON.stringify(networkData),
    //         },
    //       ],
    //     },
    //   ];

    //   resolveInitialMessages(messages);

    //   expect(consoleLogSpy).toHaveBeenCalledWith('json', networkData);
    // });
  });

  describe('Non-network messages', () => {
    it('should return original message if isNetwork is false', () => {
      const networkData = {
        isNetwork: false,
        text: 'Regular message',
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-14',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toEqual(messages);
    });

    it('should return original message if no network part found', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-15',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Regular text message',
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toEqual(messages);
    });

    it('should return original message if text does not contain isNetwork', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-16',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: '{"someOtherField": true}',
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toEqual(messages);
    });

    it('should return original message for non-text parts', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-17',
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

      const result = resolveInitialMessages(messages);

      expect(result).toEqual(messages);
    });

    it('should handle user messages without modification', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-18',
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'User question',
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toEqual(messages);
    });

    it('should handle system messages without modification', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-19',
          role: 'system',
          parts: [
            {
              type: 'text',
              text: 'System instruction',
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toEqual(messages);
    });
  });

  describe('Error handling', () => {
    it('should return original message on JSON parse error', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-20',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: '{"isNetwork":true invalid json',
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toEqual(messages);
    });

    it('should handle malformed JSON gracefully', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-21',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Not JSON at all but contains "isNetwork":true',
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toEqual(messages);
    });

    it('should handle empty text gracefully', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-22',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: '',
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toEqual(messages);
    });
  });

  describe('Multiple messages', () => {
    it('should process multiple messages independently', () => {
      const networkData1 = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-1',
        input: 'query 1',
        finalResult: { text: 'result 1' },
      };

      const networkData2 = {
        isNetwork: true,
        primitiveType: 'workflow',
        primitiveId: 'workflow-1',
        input: 'query 2',
        finalResult: { text: 'result 2' },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-23',
          role: 'assistant',
          parts: [{ type: 'text', text: JSON.stringify(networkData1) }],
        },
        {
          id: 'msg-24',
          role: 'user',
          parts: [{ type: 'text', text: 'User message' }],
        },
        {
          id: 'msg-25',
          role: 'assistant',
          parts: [{ type: 'text', text: JSON.stringify(networkData2) }],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toHaveLength(3);
      expect(result[0].parts[0]).toMatchObject({
        type: 'dynamic-tool',
        toolName: 'agent-1',
      });
      expect(result[1]).toEqual(messages[1]);
      expect(result[2].parts[0]).toMatchObject({
        type: 'dynamic-tool',
        toolName: 'workflow-1',
      });
    });

    it('should handle mix of network and non-network messages', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-9',
        input: 'test',
        finalResult: { text: 'network result' },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-26',
          role: 'user',
          parts: [{ type: 'text', text: 'Question' }],
        },
        {
          id: 'msg-27',
          role: 'assistant',
          parts: [{ type: 'text', text: JSON.stringify(networkData) }],
        },
        {
          id: 'msg-28',
          role: 'user',
          parts: [{ type: 'text', text: 'Follow-up' }],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(messages[0]);
      expect(result[1].parts[0].type).toBe('dynamic-tool');
      expect(result[2]).toEqual(messages[2]);
    });

    it('should handle empty messages array', () => {
      const messages: MastraUIMessage[] = [];

      const result = resolveInitialMessages(messages);

      expect(result).toEqual([]);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle message with multiple parts', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-10',
        input: 'test',
        finalResult: { text: 'result' },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-29',
          role: 'assistant',
          parts: [
            {
              type: 'source-url',
              sourceId: 'src-1',
              url: 'https://example.com',
              title: 'Source',
            },
            {
              type: 'text',
              text: JSON.stringify(networkData),
            },
          ],
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0].type).toBe('dynamic-tool');
    });

    it('should preserve message metadata', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'agent-11',
        input: 'test',
        finalResult: { text: 'result' },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-30',
          role: 'assistant',
          parts: [{ type: 'text', text: JSON.stringify(networkData) }],
          metadata: {
            mode: 'generate',
            customField: 'custom-value',
          } as any,
        },
      ];

      const result = resolveInitialMessages(messages);

      expect(result[0].metadata).toMatchObject({
        mode: 'network',
        customField: 'custom-value',
      });
    });

    it('should handle multiple tool calls with results', () => {
      const networkData = {
        isNetwork: true,
        primitiveType: 'agent',
        primitiveId: 'multi-tool-agent',
        input: 'multi task',
        finalResult: {
          text: 'All done',
          toolCalls: [
            {
              type: 'tool-call',
              runId: 'run-6',
              from: 'AGENT',
              payload: {
                toolCallId: 'call-a',
                toolName: 'tool-a',
                args: { param: 'a' },
              },
            },
            {
              type: 'tool-call',
              runId: 'run-7',
              from: 'AGENT',
              payload: {
                toolCallId: 'call-b',
                toolName: 'tool-b',
                args: { param: 'b' },
              },
            },
          ],
          messages: [
            {
              role: 'assistant',
              id: 'msg-inner-4',
              createdAt: '2024-01-01',
              type: 'assistant',
              content: [
                {
                  type: 'tool-result',
                  toolCallId: 'call-a',
                  toolName: 'tool-a',
                  result: { output: 'a' },
                },
                {
                  type: 'tool-result',
                  toolCallId: 'call-b',
                  toolName: 'tool-b',
                  result: { output: 'b' },
                },
              ],
            },
          ],
        },
      };

      const messages: MastraUIMessage[] = [
        {
          id: 'msg-31',
          role: 'assistant',
          parts: [{ type: 'text', text: JSON.stringify(networkData) }],
        },
      ];

      const result = resolveInitialMessages(messages);

      const output = (result[0].parts[0] as any).output;
      expect(output.childMessages).toHaveLength(3);
      expect(output.childMessages[0]).toMatchObject({
        type: 'tool',
        toolCallId: 'call-a',
        toolOutput: { output: 'a' },
      });
      expect(output.childMessages[1]).toMatchObject({
        type: 'tool',
        toolCallId: 'call-b',
        toolOutput: { output: 'b' },
      });
      expect(output.childMessages[2]).toMatchObject({
        type: 'text',
        content: 'All done',
      });
    });
  });
});

describe('resolveToChildMessages', () => {
  describe('Basic functionality', () => {
    it('should extract child messages from tool parts', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-search',
              toolCallId: 'call-1',
              input: { query: 'test' },
              output: { results: ['item1'] },
            } as any,
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([
        {
          type: 'tool',
          toolCallId: 'call-1',
          toolName: 'search',
          args: { query: 'test' },
          toolOutput: { results: ['item1'] },
        },
      ]);
    });

    it('should extract child messages from workflow tool parts', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [
            {
              type: 'tool-workflow-processor',
              toolCallId: 'wf-call-1',
              input: { data: 'input' },
              output: {
                result: {
                  steps: { step1: { status: 'success' } },
                },
                runId: 'wf-run-1',
              },
            } as any,
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([
        {
          type: 'tool',
          toolCallId: 'wf-call-1',
          toolName: 'workflow-processor',
          args: { data: 'input' },
          toolOutput: {
            steps: { step1: { status: 'success' } },
            runId: 'wf-run-1',
          },
        },
      ]);
    });

    it('should extract text parts', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-3',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Response text',
            },
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([
        {
          type: 'text',
          content: 'Response text',
        },
      ]);
    });

    it('should handle mixed tool and text parts', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-4',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Let me search for that',
            },
            {
              type: 'tool-search',
              toolCallId: 'search-1',
              input: { query: 'test' },
              output: { results: [] },
            } as any,
            {
              type: 'text',
              text: 'Here are the results',
            },
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ type: 'text', content: 'Let me search for that' });
      expect(result[1]).toMatchObject({ type: 'tool', toolName: 'search' });
      expect(result[2]).toMatchObject({ type: 'text', content: 'Here are the results' });
    });

    it('should return empty array if no assistant message found', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-5',
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'User question',
            },
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([]);
    });

    it('should return empty array for empty messages', () => {
      const messages: MastraUIMessage[] = [];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([]);
    });

    it('should return empty array if assistant has no parts', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-6',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([]);
    });

    it('should skip non-tool and non-text parts', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-7',
          role: 'assistant',
          parts: [
            {
              type: 'source-url',
              sourceId: 'src-1',
              url: 'https://example.com',
              title: 'Example',
            },
            {
              type: 'text',
              text: 'Text part',
            },
            {
              type: 'file',
              mediaType: 'image/png',
              url: 'data:...',
            },
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([
        {
          type: 'text',
          content: 'Text part',
        },
      ]);
    });

    it('should find first assistant message in multiple messages', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-8',
          role: 'user',
          parts: [{ type: 'text', text: 'Question' }],
        },
        {
          id: 'msg-9',
          role: 'assistant',
          parts: [
            {
              type: 'tool-calculator',
              toolCallId: 'calc-1',
              input: { a: 1, b: 2 },
              output: 3,
            } as any,
          ],
        },
        {
          id: 'msg-10',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Second assistant message' }],
        },
      ];

      const result = resolveToChildMessages(messages);

      // Should only process the first assistant message
      expect(result).toEqual([
        {
          type: 'tool',
          toolCallId: 'calc-1',
          toolName: 'calculator',
          args: { a: 1, b: 2 },
          toolOutput: 3,
        },
      ]);
    });

    it('should handle tool parts with missing output', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-11',
          role: 'assistant',
          parts: [
            {
              type: 'tool-pending',
              toolCallId: 'pending-1',
              input: {},
            } as any,
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([
        {
          type: 'tool',
          toolCallId: 'pending-1',
          toolName: 'pending',
          args: {},
          toolOutput: undefined,
        },
      ]);
    });

    it('should handle workflow tool with missing result', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-12',
          role: 'assistant',
          parts: [
            {
              type: 'tool-workflow-test',
              toolCallId: 'wf-1',
              input: {},
              output: {
                runId: 'run-1',
              },
            } as any,
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([
        {
          type: 'tool',
          toolCallId: 'wf-1',
          toolName: 'workflow-test',
          args: {},
          toolOutput: {
            runId: 'run-1',
          },
        },
      ]);
    });

    it('should handle multiple tool parts', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-13',
          role: 'assistant',
          parts: [
            {
              type: 'tool-search',
              toolCallId: 'search-1',
              input: { query: 'a' },
              output: { results: ['a'] },
            } as any,
            {
              type: 'tool-calculator',
              toolCallId: 'calc-1',
              input: { x: 1 },
              output: 1,
            } as any,
            {
              type: 'tool-database',
              toolCallId: 'db-1',
              input: { query: 'SELECT *' },
              output: { rows: [] },
            } as any,
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ toolName: 'search' });
      expect(result[1]).toMatchObject({ toolName: 'calculator' });
      expect(result[2]).toMatchObject({ toolName: 'database' });
    });

    it('should handle empty text content', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-14',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: '',
            },
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([
        {
          type: 'text',
          content: '',
        },
      ]);
    });

    it('should handle tool with special characters in name', () => {
      const messages: MastraUIMessage[] = [
        {
          id: 'msg-15',
          role: 'assistant',
          parts: [
            {
              type: 'tool-my-special_tool-v2',
              toolCallId: 'special-1',
              input: {},
              output: 'result',
            } as any,
          ],
        },
      ];

      const result = resolveToChildMessages(messages);

      expect(result).toEqual([
        {
          type: 'tool',
          toolCallId: 'special-1',
          toolName: 'my-special_tool-v2',
          args: {},
          toolOutput: 'result',
        },
      ]);
    });
  });
});
