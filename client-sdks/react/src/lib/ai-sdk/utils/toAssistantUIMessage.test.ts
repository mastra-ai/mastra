import { describe, it, expect } from 'vitest';
import { toAssistantUIMessage } from './toAssistantUIMessage';
import { MastraUIMessage } from '../types';

describe('toAssistantUIMessage', () => {
  describe('Basic message conversion', () => {
    it('should convert a simple text message', () => {
      const message: MastraUIMessage = {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello, world!',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result).toEqual({
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello, world!',
          },
        ],
        id: 'msg-1',
        createdAt: undefined,
        status: { type: 'complete', reason: 'stop' },
      });
    });

    it('should convert a user message', () => {
      const message: MastraUIMessage = {
        id: 'msg-2',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'What is the weather?',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result).toEqual({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What is the weather?',
          },
        ],
        id: 'msg-2',
        createdAt: undefined,
      });
    });

    it('should include createdAt timestamp when present', () => {
      const timestamp = new Date('2024-01-01T00:00:00Z');
      const message = {
        id: 'msg-3',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Test',
            state: 'done',
          },
        ],
        createdAt: timestamp,
      } as MastraUIMessage & { createdAt: Date };

      const result = toAssistantUIMessage(message);

      expect(result.createdAt).toBe(timestamp);
    });
  });

  describe('Message parts conversion', () => {
    it('should convert text parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-4',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'First paragraph.',
            state: 'done',
          },
          {
            type: 'text',
            text: 'Second paragraph.',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'First paragraph.',
        },
        {
          type: 'text',
          text: 'Second paragraph.',
        },
      ]);
    });

    it('should convert reasoning parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-5',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'Let me think about this problem...',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'reasoning',
          text: 'Let me think about this problem...',
        },
      ]);
    });

    it('should convert source-url parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-6',
        role: 'assistant',
        parts: [
          {
            type: 'source-url',
            sourceId: 'source-1',
            url: 'https://example.com',
            title: 'Example Website',
            providerMetadata: {},
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'source',
          sourceType: 'url',
          id: 'source-1',
          url: 'https://example.com',
          title: 'Example Website',
        },
      ]);
    });

    it('should convert source-document parts to file parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-7',
        role: 'assistant',
        parts: [
          {
            type: 'source-document',
            sourceId: 'doc-1',
            mediaType: 'application/pdf',
            title: 'Document',
            filename: 'document.pdf',
            providerMetadata: {},
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'file',
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          data: '',
        },
      ]);
    });

    it('should convert file parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-8',
        role: 'assistant',
        parts: [
          {
            type: 'file',
            mediaType: 'text/plain',
            url: 'data:text/plain,Hello',
            providerMetadata: {},
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'file',
          mimeType: 'text/plain',
          data: 'data:text/plain,Hello',
        },
      ]);
    });

    it('should convert image parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-9',
        role: 'assistant',
        parts: [
          {
            type: 'file',
            mediaType: 'image/png',
            url: 'data:image/png;base64,iVBORw0KGgo=',
            providerMetadata: {},
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'file',
          mimeType: 'image/png',
          data: 'data:image/png;base64,iVBORw0KGgo=',
        },
      ]);
    });
  });

  describe('Tool call conversion', () => {
    it('should convert dynamic-tool parts with input-available state', () => {
      const message: MastraUIMessage = {
        id: 'msg-10',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'search',
            toolCallId: 'call-1',
            state: 'input-available',
            input: { query: 'weather' },
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'search',
          argsText: '{"query":"weather"}',
        },
      ]);
      expect(result.status).toEqual({ type: 'requires-action', reason: 'tool-calls' });
    });

    it('should convert dynamic-tool parts with output-available state', () => {
      const message: MastraUIMessage = {
        id: 'msg-11',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'calculator',
            toolCallId: 'call-2',
            state: 'output-available',
            input: { operation: 'add', a: 2, b: 3 },
            output: { result: 5 },
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'tool-call',
          toolCallId: 'call-2',
          toolName: 'calculator',
          argsText: '{"operation":"add","a":2,"b":3}',
          result: { result: 5 },
        },
      ]);
      expect(result.status).toEqual({ type: 'complete', reason: 'stop' });
    });

    it('should convert dynamic-tool parts with output-error state', () => {
      const message: MastraUIMessage = {
        id: 'msg-12',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'database',
            toolCallId: 'call-3',
            state: 'output-error',
            input: { query: 'SELECT *' },
            errorText: 'Connection timeout',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'tool-call',
          toolCallId: 'call-3',
          toolName: 'database',
          argsText: '{"query":"SELECT *"}',
          result: 'Connection timeout',
          isError: true,
        },
      ]);
      expect(result.status).toEqual({ type: 'incomplete', reason: 'error' });
    });

    it('should handle unknown part types gracefully', () => {
      const message: MastraUIMessage = {
        id: 'msg-13',
        role: 'assistant',
        parts: [
          {
            type: 'step-start' as never,
            stepId: 'step-1',
          } as never,
        ],
      };

      const result = toAssistantUIMessage(message);

      // Unknown parts should be converted to text
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toMatchObject({
        type: 'text',
      });
    });
  });

  describe('Message status handling', () => {
    it('should set status to running for streaming text', () => {
      const message: MastraUIMessage = {
        id: 'msg-14',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Generating response...',
            state: 'streaming',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toEqual({ type: 'running' });
    });

    it('should set status to running for streaming reasoning', () => {
      const message: MastraUIMessage = {
        id: 'msg-15',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'Thinking...',
            state: 'streaming',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toEqual({ type: 'running' });
    });

    it('should set status to complete for done text', () => {
      const message: MastraUIMessage = {
        id: 'msg-16',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Complete response.',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toEqual({ type: 'complete', reason: 'stop' });
    });

    it('should not set status for user messages', () => {
      const message: MastraUIMessage = {
        id: 'msg-17',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'User message',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toBeUndefined();
    });

    it('should prioritize streaming status over tool status', () => {
      const message: MastraUIMessage = {
        id: 'msg-18',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Streaming...',
            state: 'streaming',
          },
          {
            type: 'dynamic-tool',
            toolName: 'test',
            toolCallId: 'call-5',
            state: 'input-available',
            input: {},
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toEqual({ type: 'running' });
    });
  });

  describe('Complex message scenarios', () => {
    it('should handle mixed content types', () => {
      const message: MastraUIMessage = {
        id: 'msg-19',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'Let me search for that.',
            state: 'done',
          },
          {
            type: 'dynamic-tool',
            toolName: 'web_search',
            toolCallId: 'search-1',
            state: 'output-available',
            input: { query: 'AI news' },
            output: { results: ['Article 1', 'Article 2'] },
          },
          {
            type: 'text',
            text: 'Here are the results I found:',
            state: 'done',
          },
          {
            type: 'source-url',
            sourceId: 'src-1',
            url: 'https://example.com/article1',
            title: 'Article 1',
            providerMetadata: {},
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toHaveLength(4);
      expect(result.content[0]).toMatchObject({ type: 'reasoning' });
      expect(result.content[1]).toMatchObject({ type: 'tool-call' });
      expect(result.content[2]).toMatchObject({ type: 'text' });
      expect(result.content[3]).toMatchObject({ type: 'source' });
    });

    it('should handle toUIMessage output format', () => {
      const message: MastraUIMessage = {
        id: 'run-123',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Processing...',
            state: 'done',
            providerMetadata: { model: { name: 'gpt-4' } },
          },
          {
            type: 'dynamic-tool',
            toolName: 'calculator',
            toolCallId: 'calc-1',
            state: 'output-available',
            input: { x: 5, y: 3 },
            output: [{ step: 1, result: 8 }],
            callProviderMetadata: { latency: { value: 100 } },
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.role).toBe('assistant');
      expect(result.id).toBe('run-123');
      expect(result.content).toHaveLength(2);
      expect(result.status).toEqual({ type: 'complete', reason: 'stop' });
    });

    it('should handle toNetworkUIMessage output format', () => {
      const message: MastraUIMessage = {
        id: 'run-456',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'my-agent',
            toolCallId: 'run-456',
            state: 'output-available',
            input: {
              task: 'Search and summarize',
              primitiveId: 'search-agent',
              messages: [
                { type: 'text', content: 'Searching...' },
                { type: 'tool', toolCallId: 'search-1', toolName: 'web_search', toolInput: { query: 'AI' } },
              ],
            },
            output: {
              networkMetadata: {
                selectionReason: 'User requested',
                from: 'AGENT',
              },
              result: 'Search completed',
            },
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.role).toBe('assistant');
      expect(result.id).toBe('run-456');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toMatchObject({
        type: 'tool-call',
        toolName: 'my-agent',
        toolCallId: 'run-456',
      });
    });
  });

  describe('Metadata and attachments', () => {
    it('should include metadata when present', () => {
      const message: MastraUIMessage = {
        id: 'msg-20',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Response with metadata',
            state: 'done',
          },
        ],
        metadata: {
          mode: 'stream',
        },
      };

      const result = toAssistantUIMessage(message);

      expect(result.metadata).toEqual({
        custom: {
          mode: 'stream',
        },
      });
    });

    it('should handle messages without attachments', () => {
      const message: MastraUIMessage = {
        id: 'msg-21',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Message without attachments',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.attachments).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty parts array', () => {
      const message: MastraUIMessage = {
        id: 'msg-22',
        role: 'assistant',
        parts: [],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([]);
      expect(result.status).toBeUndefined();
    });

    it('should handle messages without id', () => {
      const message: MastraUIMessage = {
        id: '',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'No ID',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.id).toBe('');
    });

    it('should handle complex nested tool output', () => {
      const message: MastraUIMessage = {
        id: 'msg-23',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'workflow',
            toolCallId: 'wf-1',
            state: 'output-available',
            input: { workflowId: 'wf-456' },
            output: {
              runId: 'wf-run-789',
              payload: {
                workflowState: {
                  status: 'success',
                  steps: {
                    'step-1': {
                      id: 'step-1',
                      status: 'success',
                      output: 'processed data',
                    },
                  },
                },
              },
            },
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        type: 'tool-call',
        toolName: 'workflow',
        result: expect.objectContaining({
          runId: 'wf-run-789',
          payload: expect.objectContaining({
            workflowState: expect.objectContaining({
              status: 'success',
            }),
          }),
        }),
      });
    });

    it('should handle null or undefined values gracefully', () => {
      const message: MastraUIMessage = {
        id: 'msg-24',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: '',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toEqual({
        type: 'text',
        text: '',
      });
    });
  });

  describe('Type safety', () => {
    it('should handle system role messages', () => {
      const message: MastraUIMessage = {
        id: 'sys-1',
        role: 'system',
        parts: [
          {
            type: 'text',
            text: 'System instruction',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.role).toBe('system');
      expect(result.status).toBeUndefined();
    });

    it('should preserve part order', () => {
      const message: MastraUIMessage = {
        id: 'msg-25',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'First', state: 'done' },
          { type: 'reasoning', text: 'Second', state: 'done' },
          { type: 'text', text: 'Third', state: 'done' },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({ type: 'text', text: 'First' });
      expect(result.content[1]).toMatchObject({ type: 'reasoning', text: 'Second' });
      expect(result.content[2]).toMatchObject({ type: 'text', text: 'Third' });
    });
  });
});
