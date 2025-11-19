import { describe, it, expect } from 'vitest';
import { toAssistantUIMessage } from './toAssistantUIMessage';
import { MastraUIMessage } from '../types';
import { ThreadMessageLike } from '@assistant-ui/react';

describe('toAssistantUIMessage', () => {
  describe('Basic message conversion', () => {
    it('should convert a simple text message from assistant', () => {
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
            metadata: undefined,
          },
        ],
        id: 'msg-1',
        createdAt: undefined,
        status: { type: 'complete', reason: 'stop' },
        attachments: undefined,
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
            metadata: undefined,
          },
        ],
        id: 'msg-2',
        createdAt: undefined,
        status: undefined,
        attachments: undefined,
      });
    });

    it('should convert a system message', () => {
      const message: MastraUIMessage = {
        id: 'msg-3',
        role: 'system',
        parts: [
          {
            type: 'text',
            text: 'You are a helpful assistant.',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result).toEqual({
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a helpful assistant.',
            metadata: undefined,
          },
        ],
        id: 'msg-3',
        createdAt: undefined,
        status: undefined,
        attachments: undefined,
      });
    });

    it('should include createdAt when present', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const message = {
        id: 'msg-4',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Test message',
            state: 'done',
          },
        ],
        createdAt,
      } as MastraUIMessage & { createdAt: Date };

      const result = toAssistantUIMessage(message);

      expect(result.createdAt).toBe(createdAt);
    });

    it('should include experimental_attachments when present', () => {
      const attachments = [{ id: 'attach-1', name: 'file.txt', type: 'text/plain' as const }];
      const message = {
        id: 'msg-5',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Message with attachments',
            state: 'done',
          },
        ],
        experimental_attachments: attachments,
      } as MastraUIMessage & { experimental_attachments: typeof attachments };

      const result = toAssistantUIMessage(message);

      expect(result.attachments).toBe(attachments);
    });

    it('should pass metadata to each content part', () => {
      const message: MastraUIMessage = {
        id: 'msg-6',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'First part',
            state: 'done',
          },
          {
            type: 'text',
            text: 'Second part',
            state: 'done',
          },
        ],
        metadata: {
          mode: 'stream',
          customField: 'value',
        } as any,
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        metadata: { mode: 'stream', customField: 'value' },
      });
      expect(result.content[1]).toMatchObject({
        metadata: { mode: 'stream', customField: 'value' },
      });
    });
  });

  describe('Text and reasoning parts', () => {
    it('should convert text parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-7',
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
            state: 'streaming',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'First paragraph.',
          metadata: undefined,
        },
        {
          type: 'text',
          text: 'Second paragraph.',
          metadata: undefined,
        },
      ]);
    });

    it('should convert reasoning parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-8',
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
          metadata: undefined,
        },
      ]);
    });

    it('should handle text parts without state property', () => {
      const message: MastraUIMessage = {
        id: 'msg-9',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'No state property',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        type: 'text',
        text: 'No state property',
      });
      expect(result.status).toEqual({ type: 'complete', reason: 'stop' });
    });
  });

  describe('Source parts', () => {
    it('should convert source-url parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-10',
        role: 'assistant',
        parts: [
          {
            type: 'source-url',
            sourceId: 'source-1',
            url: 'https://example.com',
            title: 'Example Website',
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
          metadata: undefined,
        },
      ]);
    });

    it('should convert source-document parts to file parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-11',
        role: 'assistant',
        parts: [
          {
            type: 'source-document',
            sourceId: 'doc-1',
            mediaType: 'application/pdf',
            title: 'Document',
            filename: 'document.pdf',
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
          metadata: undefined,
        },
      ]);
    });

    it('should handle source parts with metadata', () => {
      const message: MastraUIMessage = {
        id: 'msg-12',
        role: 'assistant',
        parts: [
          {
            type: 'source-url',
            sourceId: 'source-2',
            url: 'https://example.com/article',
            title: 'Article',
          },
        ],
        metadata: {
          mode: 'generate',
        },
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        type: 'source',
        metadata: { mode: 'generate' },
      });
    });
  });

  describe('File parts', () => {
    it('should convert file parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-13',
        role: 'assistant',
        parts: [
          {
            type: 'file',
            mediaType: 'text/plain',
            url: 'data:text/plain,Hello',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'file',
          mimeType: 'text/plain',
          data: 'data:text/plain,Hello',
          metadata: undefined,
        },
      ]);
    });

    it('should handle image files with proper type detection and metadata', () => {
      const message: MastraUIMessage = {
        id: 'msg-14b',
        role: 'assistant',
        parts: [
          {
            type: 'file',
            mediaType: 'image/jpeg',
            url: 'https://example.com/image.jpg',
          },
        ],
        metadata: {
          mode: 'stream',
          customField: 'value',
        } as any,
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'image',
          image: 'https://example.com/image.jpg',
          metadata: {
            mode: 'stream',
            customField: 'value',
          },
        },
      ]);
    });

    it('should handle different image formats correctly', () => {
      const message: MastraUIMessage = {
        id: 'msg-14c',
        role: 'assistant',
        parts: [
          {
            type: 'file',
            mediaType: 'image/gif',
            url: 'https://example.com/animation.gif',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'image',
          image: 'https://example.com/animation.gif',
          metadata: undefined,
        },
      ]);
    });
  });

  describe('Dynamic tool parts', () => {
    it('should convert dynamic-tool parts with input-available state', () => {
      const message: MastraUIMessage = {
        id: 'msg-15',
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
          args: { query: 'weather' },
          metadata: undefined,
        },
      ]);
      expect(result.status).toEqual({ type: 'requires-action', reason: 'tool-calls' });
    });

    it('should convert dynamic-tool parts with output-available state', () => {
      const message: MastraUIMessage = {
        id: 'msg-16',
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
          args: { operation: 'add', a: 2, b: 3 },
          result: { result: 5 },
          metadata: undefined,
        },
      ]);
      expect(result.status).toEqual({ type: 'complete', reason: 'stop' });
    });

    it('should convert dynamic-tool parts with output-error state', () => {
      const message: MastraUIMessage = {
        id: 'msg-17',
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
          args: { query: 'SELECT *' },
          result: 'Connection timeout',
          isError: true,
          metadata: undefined,
        },
      ]);
      expect(result.status).toEqual({ type: 'incomplete', reason: 'error' });
    });

    it('should handle dynamic-tool parts without state', () => {
      const message: MastraUIMessage = {
        id: 'msg-18',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'test-tool',
            toolCallId: 'call-4',
            input: { param: 'value' },
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call-4',
        toolName: 'test-tool',
        argsText: '{"param":"value"}',
        args: { param: 'value' },
      });
    });

    it('should include metadata in tool-call parts', () => {
      const message: MastraUIMessage = {
        id: 'msg-19',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'fetch',
            toolCallId: 'call-5',
            state: 'input-available',
            input: { url: 'https://api.example.com' },
          },
        ],
        metadata: {
          mode: 'stream',
          requestId: 'req-123',
        } as any,
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        metadata: {
          mode: 'stream',
          requestId: 'req-123',
        },
      });
    });
  });

  describe('Typed tool parts (tool-{NAME} pattern)', () => {
    it('should convert tool-{NAME} parts with output', () => {
      const message: MastraUIMessage = {
        id: 'msg-20',
        role: 'assistant',
        parts: [
          {
            type: 'tool-weather',
            state: 'completed',
            toolCallId: 'call-6',
            toolName: 'weather',
            input: { location: 'New York' },
            output: { temperature: 72, condition: 'sunny' },
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'tool-call',
          toolCallId: 'call-6',
          toolName: 'weather',
          argsText: '{"location":"New York"}',
          args: { location: 'New York' },
          result: { temperature: 72, condition: 'sunny' },
          metadata: undefined,
        },
      ]);
    });

    it('should convert tool-{NAME} parts with error', () => {
      const message: MastraUIMessage = {
        id: 'msg-21',
        role: 'assistant',
        parts: [
          {
            type: 'tool-api',
            state: 'failed',
            toolCallId: 'call-7',
            toolName: 'api',
            input: { endpoint: '/data' },
            error: 'API rate limit exceeded',
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'tool-call',
          toolCallId: 'call-7',
          toolName: 'api',
          argsText: '{"endpoint":"/data"}',
          args: { endpoint: '/data' },
          result: 'API rate limit exceeded',
          isError: true,
          metadata: undefined,
        },
      ]);
    });

    it('should extract toolName from type when not explicitly provided', () => {
      const message: MastraUIMessage = {
        id: 'msg-22',
        role: 'assistant',
        parts: [
          {
            type: 'tool-calculator',
            state: 'completed',
            toolCallId: 'call-8',
            input: { expression: '2+2' },
            output: 4,
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        type: 'tool-call',
        toolName: 'calculator',
        toolCallId: 'call-8',
      });
    });

    it('should handle tool parts without toolCallId', () => {
      const message: MastraUIMessage = {
        id: 'msg-23',
        role: 'assistant',
        parts: [
          {
            type: 'tool-test',
            state: 'completed',
            input: { data: 'test' },
            output: 'result',
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: '',
        toolName: 'test',
      });
    });

    it('should handle tool parts without input', () => {
      const message: MastraUIMessage = {
        id: 'msg-24',
        role: 'assistant',
        parts: [
          {
            type: 'tool-random',
            state: 'completed',
            toolCallId: 'call-9',
            output: Math.random(),
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: 'call-9',
        toolName: 'random',
        argsText: '{}',
        args: {},
      });
    });

    it('should skip tool parts with state input-available', () => {
      const message: MastraUIMessage = {
        id: 'msg-25',
        role: 'assistant',
        parts: [
          {
            type: 'tool-pending',
            state: 'input-available',
            toolCallId: 'call-10',
            input: { waiting: true },
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      // Should return minimal text part for unhandled cases
      expect(result.content).toEqual([
        {
          type: 'text',
          text: '',
          metadata: undefined,
        },
      ]);
    });
  });

  describe('Unknown part types', () => {
    it('should handle unknown part types gracefully', () => {
      const message: MastraUIMessage = {
        id: 'msg-26',
        role: 'assistant',
        parts: [
          {
            type: 'unknown-type' as any,
            data: 'some data',
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'text',
          text: '',
          metadata: undefined,
        },
      ]);
    });

    it('should handle custom part types', () => {
      const message: MastraUIMessage = {
        id: 'msg-27',
        role: 'assistant',
        parts: [
          {
            type: 'custom-widget' as any,
            widgetId: 'widget-1',
            settings: { color: 'blue' },
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([
        {
          type: 'text',
          text: '',
          metadata: undefined,
        },
      ]);
    });
  });

  describe('Message status determination', () => {
    it('should set status to running for streaming text', () => {
      const message: MastraUIMessage = {
        id: 'msg-28',
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
        id: 'msg-29',
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

    it('should set status to requires-action for input-available tools', () => {
      const message: MastraUIMessage = {
        id: 'msg-30',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'pending-tool',
            toolCallId: 'call-11',
            state: 'input-available',
            input: {},
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toEqual({ type: 'requires-action', reason: 'tool-calls' });
    });

    it('should set status to incomplete for error tools', () => {
      const message: MastraUIMessage = {
        id: 'msg-31',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'failed-tool',
            toolCallId: 'call-12',
            state: 'output-error',
            input: {},
            errorText: 'Tool failed',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toEqual({ type: 'incomplete', reason: 'error' });
    });

    it('should set status to incomplete for typed tool with error', () => {
      const message: MastraUIMessage = {
        id: 'msg-32',
        role: 'assistant',
        parts: [
          {
            type: 'tool-broken',
            state: 'failed',
            toolCallId: 'call-13',
            input: {},
            error: 'Internal error',
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toEqual({ type: 'incomplete', reason: 'error' });
    });

    it('should set status to complete for done text', () => {
      const message: MastraUIMessage = {
        id: 'msg-33',
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
        id: 'msg-34',
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

    it('should not set status for system messages', () => {
      const message: MastraUIMessage = {
        id: 'msg-35',
        role: 'system',
        parts: [
          {
            type: 'text',
            text: 'System prompt',
            state: 'done',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toBeUndefined();
    });

    it('should not set status for empty content', () => {
      const message: MastraUIMessage = {
        id: 'msg-36',
        role: 'assistant',
        parts: [],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toBeUndefined();
    });

    it('should prioritize streaming status over tool status', () => {
      const message: MastraUIMessage = {
        id: 'msg-37',
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
            toolCallId: 'call-14',
            state: 'input-available',
            input: {},
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.status).toEqual({ type: 'running' });
    });

    it('should handle multiple tool states correctly', () => {
      const message: MastraUIMessage = {
        id: 'msg-38',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'tool1',
            toolCallId: 'call-15',
            state: 'output-available',
            input: {},
            output: 'result',
          },
          {
            type: 'dynamic-tool',
            toolName: 'tool2',
            toolCallId: 'call-16',
            state: 'output-error',
            input: {},
            errorText: 'Failed',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      // Error takes precedence
      expect(result.status).toEqual({ type: 'incomplete', reason: 'error' });
    });
  });

  describe('Complex message scenarios', () => {
    it('should handle mixed content types', () => {
      const message: MastraUIMessage = {
        id: 'msg-39',
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
          },
          {
            type: 'file',
            mediaType: 'application/pdf',
            url: 'data:application/pdf;base64,...',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toHaveLength(5);
      expect(result.content[0]).toMatchObject({ type: 'reasoning' });
      expect(result.content[1]).toMatchObject({ type: 'tool-call' });
      expect(result.content[2]).toMatchObject({ type: 'text' });
      expect(result.content[3]).toMatchObject({ type: 'source' });
      expect(result.content[4]).toMatchObject({ type: 'file' });
    });

    it('should handle message with all extended properties', () => {
      const createdAt = new Date('2024-01-15T10:30:00Z');
      const attachments = [{ id: 'attach-1', name: 'data.csv', type: 'text/csv' as const }];

      const message = {
        id: 'msg-40',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Analysis complete',
            state: 'done',
          },
          {
            type: 'dynamic-tool',
            toolName: 'data_analyzer',
            toolCallId: 'analyze-1',
            state: 'output-available',
            input: { file: 'data.csv' },
            output: { rows: 1000, columns: 5 },
          },
        ],
        createdAt,
        metadata: {
          mode: 'generate',
          requestId: 'req-456',
        },
        experimental_attachments: attachments,
      } as MastraUIMessage & {
        createdAt: Date;
        metadata: Record<string, unknown>;
        experimental_attachments: typeof attachments;
      };

      const result = toAssistantUIMessage(message);

      expect(result).toMatchObject({
        role: 'assistant',
        id: 'msg-40',
        createdAt,
        attachments,
        status: { type: 'complete', reason: 'stop' },
      });
      expect(result.content[0]).toMatchObject({
        metadata: { mode: 'generate', requestId: 'req-456' },
      });
      expect(result.content[1]).toMatchObject({
        metadata: { mode: 'generate', requestId: 'req-456' },
      });
    });

    it('should handle deeply nested tool outputs', () => {
      const message: MastraUIMessage = {
        id: 'msg-41',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'complex-tool',
            toolCallId: 'complex-1',
            state: 'output-available',
            input: {
              nested: {
                deeply: {
                  value: 'input',
                },
              },
            },
            output: {
              result: {
                nested: {
                  deeply: {
                    value: 'output',
                    array: [1, 2, 3],
                    object: { key: 'value' },
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
        args: {
          nested: {
            deeply: {
              value: 'input',
            },
          },
        },
        result: {
          result: {
            nested: {
              deeply: {
                value: 'output',
                array: [1, 2, 3],
                object: { key: 'value' },
              },
            },
          },
        },
      });
    });

    it('should handle empty parts array', () => {
      const message: MastraUIMessage = {
        id: 'msg-42',
        role: 'assistant',
        parts: [],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toEqual([]);
      expect(result.status).toBeUndefined();
    });

    it('should handle parts with undefined/null values', () => {
      const message: MastraUIMessage = {
        id: 'msg-43',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: '',
            state: 'done',
          },
          {
            type: 'source-url',
            sourceId: 'src-2',
            url: '',
            title: undefined as any,
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        type: 'text',
        text: '',
      });
      expect(result.content[1]).toMatchObject({
        type: 'source',
        url: '',
        title: undefined,
      });
    });
  });

  describe('Edge cases and special scenarios', () => {
    it('should handle messages with only metadata', () => {
      const message: MastraUIMessage = {
        id: 'msg-44',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Text with metadata',
          },
        ],
        metadata: {
          mode: 'network',
          from: 'AGENT',
          selectionReason: 'Best match',
        },
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        metadata: {
          mode: 'network',
          from: 'AGENT',
          selectionReason: 'Best match',
        },
      });
    });

    it('should handle tool with very large input/output', () => {
      const largeArray = new Array(1000).fill(0).map((_, i) => ({ index: i, value: `item-${i}` }));

      const message: MastraUIMessage = {
        id: 'msg-45',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'processor',
            toolCallId: 'proc-1',
            state: 'output-available',
            input: { data: largeArray },
            output: { processed: largeArray.length },
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      const toolCall = result.content[0] as any;
      expect(toolCall.args.data).toHaveLength(1000);
      expect(toolCall.result).toEqual({ processed: 1000 });
    });

    it('should handle special characters in text and tool args', () => {
      const message: MastraUIMessage = {
        id: 'msg-46',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Special chars: \n\t\r\b\f"\'\\',
            state: 'done',
          },
          {
            type: 'dynamic-tool',
            toolName: 'echo',
            toolCallId: 'echo-1',
            state: 'output-available',
            input: {
              text: 'Line 1\nLine 2\tTabbed',
              unicode: '😀🎉✨',
              escaped: '"quoted" and \'single\'',
            },
            output: 'Processed',
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content[0]).toMatchObject({
        text: 'Special chars: \n\t\r\b\f"\'\\',
      });
      expect(result.content[1]).toMatchObject({
        args: {
          text: 'Line 1\nLine 2\tTabbed',
          unicode: '😀🎉✨',
          escaped: '"quoted" and \'single\'',
        },
      });
    });

    it('should handle circular references in metadata gracefully', () => {
      const circularMetadata: any = { field: 'value' };
      circularMetadata.self = circularMetadata;

      const message: MastraUIMessage = {
        id: 'msg-47',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Message with circular metadata',
          },
        ],
        metadata: circularMetadata,
      };

      const result = toAssistantUIMessage(message);

      // Should not throw and should include the metadata
      expect(result.content[0]).toHaveProperty('metadata');
      expect((result.content[0] as any).metadata.field).toBe('value');
    });

    it('should preserve part order exactly', () => {
      const message: MastraUIMessage = {
        id: 'msg-48',
        role: 'assistant',
        parts: [
          { type: 'text', text: '1', state: 'done' },
          { type: 'reasoning', text: '2', state: 'done' },
          { type: 'text', text: '3', state: 'done' },
          { type: 'source-url', sourceId: '4', url: 'http://4', title: '4' },
          { type: 'text', text: '5', state: 'done' },
          { type: 'file', mediaType: 'text/plain', url: '6' },
          { type: 'text', text: '7', state: 'done' },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect(result.content).toHaveLength(7);
      expect(result.content[0]).toMatchObject({ type: 'text', text: '1' });
      expect(result.content[1]).toMatchObject({ type: 'reasoning', text: '2' });
      expect(result.content[2]).toMatchObject({ type: 'text', text: '3' });
      expect(result.content[3]).toMatchObject({ type: 'source' });
      expect(result.content[4]).toMatchObject({ type: 'text', text: '5' });
      expect(result.content[5]).toMatchObject({ type: 'file' });
      expect(result.content[6]).toMatchObject({ type: 'text', text: '7' });
    });

    it('should handle malformed tool parts gracefully', () => {
      const message: MastraUIMessage = {
        id: 'msg-49',
        role: 'assistant',
        parts: [
          {
            type: 'tool-malformed',
            // Missing expected properties
          } as any,
          {
            type: 'dynamic-tool',
            toolName: 'valid',
            toolCallId: undefined as any, // Invalid toolCallId
            state: 'input-available',
            input: undefined as any, // Invalid input
          } as any,
        ],
      };

      const result = toAssistantUIMessage(message);

      // Should handle gracefully without throwing
      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toMatchObject({
        type: 'tool-call',
        toolCallId: '',
        toolName: 'malformed',
        argsText: '{}',
        args: {},
      });
      expect(result.content[1]).toMatchObject({
        type: 'tool-call',
        toolCallId: undefined,
        toolName: 'valid',
        argsText: undefined,
        args: undefined,
      });
    });

    it('should handle extremely long strings', () => {
      const longString = 'a'.repeat(100000);

      const message: MastraUIMessage = {
        id: 'msg-50',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: longString,
            state: 'done',
          },
          {
            type: 'dynamic-tool',
            toolName: 'processor',
            toolCallId: 'long-1',
            state: 'output-available',
            input: { data: longString },
            output: { length: longString.length },
          },
        ],
      };

      const result = toAssistantUIMessage(message);

      expect((result.content[0] as any).text).toHaveLength(100000);
      expect((result.content[1] as any).args.data).toHaveLength(100000);
    });
  });
});
