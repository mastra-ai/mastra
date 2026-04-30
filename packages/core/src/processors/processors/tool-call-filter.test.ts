import { describe, it, expect } from 'vitest';

import { MessageList } from '../../agent/message-list';
import type { MastraDBMessage } from '../../memory/types';
import type { ProcessInputStepArgs } from '../index';

import { ToolCallFilter } from './tool-call-filter';

function mockStepArgs(messageList: MessageList, overrides: Partial<ProcessInputStepArgs> = {}): ProcessInputStepArgs {
  return {
    messages: messageList.get.all.db(),
    messageList,
    abort: ((reason?: string) => {
      throw new Error(reason || 'Aborted');
    }) as (reason?: string) => never,
    stepNumber: 1,
    steps: [],
    systemMessages: [],
    state: {},
    model: 'test-model' as any,
    retryCount: 0,
    ...overrides,
  };
}

describe('ToolCallFilter', () => {
  const mockAbort = ((reason?: string) => {
    throw new Error(reason || 'Aborted');
  }) as (reason?: string) => never;

  describe('exclude all tool calls (default)', () => {
    it('should exclude all tool calls and tool results', async () => {
      const filter = new ToolCallFilter();

      const baseTime = Date.now();
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is the weather?',
            parts: [{ type: 'text' as const, text: 'What is the weather?' }],
          },
          createdAt: new Date(baseTime),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: { location: 'NYC' },
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 1),
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: {},
                  result: 'Sunny, 72°F',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 2),
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: {
            format: 2,
            content: 'The weather is sunny and 72°F',
            parts: [{ type: 'text' as const, text: 'The weather is sunny and 72°F' }],
          },
          createdAt: new Date(baseTime + 3),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();

      // After consolidation, msg-2, msg-3, and msg-4 are merged into a single message with id 'msg-2'
      // The filter should remove tool-invocation parts, leaving only text parts
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0]!.id).toBe('msg-1');
      expect(resultMessages[1]!.id).toBe('msg-2');

      // Verify tool-invocation parts were removed
      const assistantMsg = resultMessages[1]!;
      if (typeof assistantMsg.content !== 'string') {
        const hasToolInvocation = assistantMsg.content.parts.some((p: any) => p.type === 'tool-invocation');
        expect(hasToolInvocation).toBe(false);
      }
    });

    it('should handle messages without tool calls', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello',
            parts: [{ type: 'text' as const, text: 'Hello' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Hi there!',
            parts: [{ type: 'text' as const, text: 'Hi there!' }],
          },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0]!.id).toBe('msg-1');
      expect(resultMessages[1]!.id).toBe('msg-2');
    });

    it('should handle empty messages array', async () => {
      const filter = new ToolCallFilter();

      const messageList = new MessageList();

      const result = await filter.processInput({
        messages: [],
        messageList,
        abort: mockAbort,
      });

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(0);
    });

    it('should exclude multiple tool calls in sequence', async () => {
      const filter = new ToolCallFilter();

      const baseTime = Date.now();
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is 2+2 and the weather?',
            parts: [{ type: 'text' as const, text: 'What is 2+2 and the weather?' }],
          },
          createdAt: new Date(baseTime),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-1',
                  toolName: 'calculator',
                  args: { expression: '2+2' },
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 1),
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'calculator',
                  args: {},
                  result: '4',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 2),
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-2',
                  toolName: 'weather',
                  args: { location: 'NYC' },
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 3),
        },
        {
          id: 'msg-5',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-2',
                  toolName: 'weather',
                  args: {},
                  result: 'Sunny',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 4),
        },
        {
          id: 'msg-6',
          role: 'assistant',
          content: {
            format: 2,
            content: '2+2 is 4 and the weather is sunny',
            parts: [{ type: 'text' as const, text: '2+2 is 4 and the weather is sunny' }],
          },
          createdAt: new Date(baseTime + 5),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();

      // After consolidation, msg-2 through msg-6 are merged into a single message with id 'msg-2'
      // The filter should remove tool-invocation parts, leaving only text parts
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0]!.id).toBe('msg-1');
      expect(resultMessages[1]!.id).toBe('msg-2');

      // Verify tool-invocation parts were removed
      const assistantMsg = resultMessages[1]!;
      if (typeof assistantMsg.content !== 'string') {
        const hasToolInvocation = assistantMsg.content.parts.some((p: any) => p.type === 'tool-invocation');
        expect(hasToolInvocation).toBe(false);
      }
    });
  });

  describe('exclude specific tool calls', () => {
    it('should exclude only specified tool calls', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather'] });

      const baseTime = Date.now();
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is 2+2 and the weather?',
            parts: [{ type: 'text' as const, text: 'What is 2+2 and the weather?' }],
          },
          createdAt: new Date(baseTime),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-1',
                  toolName: 'calculator',
                  args: { expression: '2+2' },
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 1),
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'calculator',
                  args: {},
                  result: '4',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 2),
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-2',
                  toolName: 'weather',
                  args: { location: 'NYC' },
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 3),
        },
        {
          id: 'msg-5',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-2',
                  toolName: 'weather',
                  args: {},
                  result: 'Sunny',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 4),
        },
        {
          id: 'msg-6',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Final answer',
            parts: [{ type: 'text' as const, text: 'Final answer' }],
          },
          createdAt: new Date(baseTime + 5),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      // After consolidation, msg-2 through msg-6 are merged into a single message with id 'msg-2'
      // The filter should remove only 'weather' tool invocations, keeping 'calculator' tool invocations and text
      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0]!.id).toBe('msg-1');
      expect(resultMessages[1]!.id).toBe('msg-2');

      // Verify weather tool invocations were removed but calculator tool invocations remain
      const assistantMsg = resultMessages[1]!;
      if (typeof assistantMsg.content !== 'string') {
        const toolInvocations = assistantMsg.content.parts.filter((p: any) => p.type === 'tool-invocation');
        const weatherInvocations = toolInvocations.filter((p: any) => p.toolInvocation.toolName === 'weather');
        const calculatorInvocations = toolInvocations.filter((p: any) => p.toolInvocation.toolName === 'calculator');
        expect(weatherInvocations).toHaveLength(0);
        expect(calculatorInvocations.length).toBeGreaterThan(0);
      }
    });

    it('should exclude multiple specified tools', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather', 'search'] });

      const baseTime = Date.now();
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Calculate, search, and check weather',
            parts: [{ type: 'text' as const, text: 'Calculate, search, and check weather' }],
          },
          createdAt: new Date(baseTime),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-1',
                  toolName: 'calculator',
                  args: {},
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 1),
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'calculator',
                  args: {},
                  result: '42',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 2),
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-2',
                  toolName: 'search',
                  args: {},
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 3),
        },
        {
          id: 'msg-5',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-2',
                  toolName: 'search',
                  args: {},
                  result: 'Results',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 4),
        },
        {
          id: 'msg-6',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-3',
                  toolName: 'weather',
                  args: {},
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 5),
        },
        {
          id: 'msg-7',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-3',
                  toolName: 'weather',
                  args: {},
                  result: 'Sunny',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 6),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      // After consolidation, msg-2 through msg-7 are merged into a single message with id 'msg-2'
      // The filter should remove 'weather' and 'search' tool invocations, keeping only 'calculator' tool invocations
      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0]!.id).toBe('msg-1');
      expect(resultMessages[1]!.id).toBe('msg-2');

      // Verify weather and search tool invocations were removed but calculator tool invocations remain
      const assistantMsg = resultMessages[1]!;
      if (typeof assistantMsg.content !== 'string') {
        const toolInvocations = assistantMsg.content.parts.filter((p: any) => p.type === 'tool-invocation');
        const weatherInvocations = toolInvocations.filter((p: any) => p.toolInvocation.toolName === 'weather');
        const searchInvocations = toolInvocations.filter((p: any) => p.toolInvocation.toolName === 'search');
        const calculatorInvocations = toolInvocations.filter((p: any) => p.toolInvocation.toolName === 'calculator');
        expect(weatherInvocations).toHaveLength(0);
        expect(searchInvocations).toHaveLength(0);
        expect(calculatorInvocations.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty exclude array (keep all messages)', async () => {
      const filter = new ToolCallFilter({ exclude: [] });

      const baseTime = Date.now();
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is the weather?',
            parts: [{ type: 'text' as const, text: 'What is the weather?' }],
          },
          createdAt: new Date(baseTime),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: {},
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 1),
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: {},
                  result: 'Sunny',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 2),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      // When exclude is empty, all original messages are returned (no filtering)
      // After consolidation, msg-2 and msg-3 are merged into a single message with id 'msg-2'
      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0]!.id).toBe('msg-1');
      expect(resultMessages[1]!.id).toBe('msg-2');
    });

    it('should handle tool calls that are not in exclude list', async () => {
      const filter = new ToolCallFilter({ exclude: ['nonexistent'] });

      const baseTime = Date.now();
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is the weather?',
            parts: [{ type: 'text' as const, text: 'What is the weather?' }],
          },
          createdAt: new Date(baseTime),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: {},
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 1),
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: {},
                  result: 'Sunny',
                },
              },
            ],
          },
          createdAt: new Date(baseTime + 2),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      // Should keep all messages since 'weather' is not in exclude list
      // After consolidation, msg-2 and msg-3 are merged into a single message with id 'msg-2'
      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(2);

      // Messages are sorted by createdAt
      expect(resultMessages[0]!.id).toBe('msg-1');

      expect(resultMessages[1]!.id).toBe('msg-2');
      expect(resultMessages[1]!.content.parts[0]!.type).toBe('tool-invocation');
    });
  });

  describe('edge cases', () => {
    it('should handle assistant messages without tool_calls property', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello',
            parts: [{ type: 'text' as const, text: 'Hello' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Hi there!',
            parts: [{ type: 'text' as const, text: 'Hi there!' }],
          },
          createdAt: new Date(),
          // No tool_calls property
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0]!.id).toBe('msg-1');
      expect(resultMessages[1]!.id).toBe('msg-2');
    });

    it('should handle assistant messages with empty tool_calls array', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello',
            parts: [{ type: 'text' as const, text: 'Hello' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Hi there!',
            parts: [{ type: 'text' as const, text: 'Hi there!' }],
          },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0]!.id).toBe('msg-1');
      expect(resultMessages[1]!.id).toBe('msg-2');
    });

    it('should handle tool result-only messages (no matching call)', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather'] });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello',
            parts: [{ type: 'text' as const, text: 'Hello' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolName: 'weather',
                  toolCallId: 'call-1',
                  args: {},
                  result: 'Sunny',
                },
              },
            ],
          },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      // Should filter out the tool result since it matches the excluded tool name
      // even though there's no matching call (implementation excludes by tool name)
      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(1);
      expect(resultMessages[0]!.id).toBe('msg-1');
    });
  });

  describe('processInputStep (per-step filtering)', () => {
    it('should not filter tool calls by default', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Get the weather and then book a flight',
            parts: [{ type: 'text' as const, text: 'Get the weather and then book a flight' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: { location: 'NYC' },
                },
              },
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: { location: 'NYC' },
                  result: 'Sunny, 72°F',
                },
              },
            ],
          },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(mockStepArgs(messageList));

      expect(result.messages).toBeUndefined();
    });

    it('should filter tool calls from tool steps older than filterAfterToolSteps', async () => {
      const filter = new ToolCallFilter({ filterAfterToolSteps: 1 });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-user',
          role: 'user',
          content: {
            format: 2,
            content: 'Do tasks',
            parts: [{ type: 'text' as const, text: 'Do tasks' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-old',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-old',
                  toolName: 'weather',
                  args: {},
                  result: 'Old weather result',
                },
              },
            ],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-recent',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-recent',
                  toolName: 'weather',
                  args: {},
                  result: 'Recent weather result',
                },
              },
            ],
          },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      const state = {};
      messageList.add(messages[0]!, 'input');
      messageList.add(messages[1]!, 'response');

      await filter.processInputStep(mockStepArgs(messageList, { stepNumber: 1, state }));

      messageList.add(messages[2]!, 'response');

      const result = await filter.processInputStep(mockStepArgs(messageList, { stepNumber: 2, state }));

      expect(result.messages).toBeDefined();
      const toolParts = result.messages!.flatMap(message =>
        typeof message.content === 'string'
          ? []
          : message.content.parts.filter((part: any) => part.type === 'tool-invocation'),
      );
      expect(toolParts.some((part: any) => part.toolInvocation.toolCallId === 'call-old')).toBe(false);
      expect(toolParts.some((part: any) => part.toolInvocation.toolCallId === 'call-recent')).toBe(true);
    });

    it('should filter all previous step tool calls when filterAfterToolSteps is 0', async () => {
      const filter = new ToolCallFilter({ filterAfterToolSteps: 0 });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Get the weather and then book a flight',
            parts: [{ type: 'text' as const, text: 'Get the weather and then book a flight' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: { location: 'NYC' },
                },
              },
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: { location: 'NYC' },
                  result: 'Sunny, 72°F',
                },
              },
              { type: 'text' as const, text: 'The weather is sunny. Now booking a flight...' },
            ],
          },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(mockStepArgs(messageList));

      expect(result.messages).toBeDefined();
      const filteredMessages = result.messages!;
      expect(filteredMessages).toHaveLength(2);
      expect(filteredMessages[0]!.id).toBe('msg-1');

      const assistantMsg = filteredMessages[1]!;
      if (typeof assistantMsg.content !== 'string') {
        const hasToolInvocation = assistantMsg.content.parts.some((p: any) => p.type === 'tool-invocation');
        expect(hasToolInvocation).toBe(false);
        const textParts = assistantMsg.content.parts.filter((p: any) => p.type === 'text');
        expect(textParts.length).toBeGreaterThan(0);
      }
    });

    it('should filter specific tools per step when enabled', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather'], filterAfterToolSteps: 0 });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Do tasks',
            parts: [{ type: 'text' as const, text: 'Do tasks' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-weather',
                  toolName: 'weather',
                  args: { location: 'NYC' },
                },
              },
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-weather',
                  toolName: 'weather',
                  args: {},
                  result: 'Sunny',
                },
              },
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-booking',
                  toolName: 'book-flight',
                  args: { destination: 'LAX' },
                },
              },
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-booking',
                  toolName: 'book-flight',
                  args: {},
                  result: 'Booked',
                },
              },
            ],
          },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(mockStepArgs(messageList));

      expect(result.messages).toBeDefined();
      const filteredMessages = result.messages!;
      expect(filteredMessages).toHaveLength(2);

      const assistantMsg = filteredMessages[1]!;
      if (typeof assistantMsg.content !== 'string') {
        const toolParts = assistantMsg.content.parts.filter((p: any) => p.type === 'tool-invocation');
        expect(toolParts.length).toBe(2);
        expect(toolParts.every((p: any) => p.toolInvocation.toolName === 'book-flight')).toBe(true);
      }
    });

    it('should return all messages when exclude list is empty and step filtering is enabled', async () => {
      const filter = new ToolCallFilter({ exclude: [], filterAfterToolSteps: 0 });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello',
            parts: [{ type: 'text' as const, text: 'Hello' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'call' as const,
                  toolCallId: 'call-1',
                  toolName: 'weather',
                  args: {},
                },
              },
            ],
          },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(mockStepArgs(messageList));

      expect(result.messages).toBeDefined();
      expect(result.messages!).toHaveLength(2);
    });
  });

  describe('integration: multi-step agent loop with ToolCallFilter', () => {
    it('should filter tool calls older than filterAfterToolSteps in a real agent loop while preserving recent tool results and text', async () => {
      const { loop } = await import('../../loop/loop');
      const { stepCountIs } = await import('@internal/ai-sdk-v5');
      const { convertArrayToReadableStream, mockValues, mockId } = await import('@internal/ai-sdk-v5/test');
      const { MastraLanguageModelV2Mock } = await import('../../loop/test-utils/MastraLanguageModelV2Mock');
      const { z } = await import('zod/v4');

      const stepInputs: any[] = [];
      let responseCount = 0;

      const messageList = new MessageList();
      messageList.add(
        {
          id: 'msg-user',
          role: 'user',
          content: [{ type: 'text', text: 'What is the weather in NYC?' }],
        },
        'input',
      );

      const result = await loop({
        methodType: 'stream',
        runId: 'test-toolcallfilter-integration',
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MastraLanguageModelV2Mock({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                stepInputs.push(prompt);

                switch (responseCount++) {
                  case 0:
                    // Step 1: LLM calls the weather tool
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'resp-0',
                          modelId: 'mock-model-id',
                          timestamp: new Date(0),
                        },
                        {
                          type: 'tool-call',
                          id: 'call-weather-1',
                          toolCallId: 'call-weather-1',
                          toolName: 'weather',
                          input: '{ "city": "NYC" }',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                        },
                      ]),
                    };
                  case 1:
                    // Step 2: LLM calls another tool; step 1 tool data should still be available.
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'resp-1',
                          modelId: 'mock-model-id',
                          timestamp: new Date(1000),
                        },
                        {
                          type: 'tool-call',
                          id: 'call-weather-2',
                          toolCallId: 'call-weather-2',
                          toolName: 'weather',
                          input: '{ "city": "Brooklyn" }',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
                        },
                      ]),
                    };
                  case 2:
                    // Step 3: LLM responds with text; step 1 tool data is old enough to filter.
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'resp-2',
                          modelId: 'mock-model-id',
                          timestamp: new Date(2000),
                        },
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'The weather in NYC is sunny.' },
                        { type: 'text-end', id: 'text-1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
                        },
                      ]),
                    };
                  default:
                    throw new Error(`Unexpected response count: ${responseCount}`);
                }
              },
            }),
          },
        ],
        inputProcessors: [new ToolCallFilter({ filterAfterToolSteps: 1 })],
        tools: {
          weather: {
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }: { city: string }) => `Sunny, 72°F in ${city}`,
          },
        },
        messageList,
        stopWhen: stepCountIs(4),
        _internal: {
          now: mockValues(0, 100, 500, 600, 1000),
          generateId: mockId({ prefix: 'id' }),
        },
        agentId: 'test-agent',
      });

      await result.consumeStream();

      expect(stepInputs).toHaveLength(3);

      const step1Prompt = stepInputs[0] as any[];
      const step1UserMsg = step1Prompt.find((m: any) => m.role === 'user');
      expect(step1UserMsg).toBeDefined();
      expect(step1UserMsg.content.some((p: any) => p.type === 'text' && p.text.includes('NYC'))).toBe(true);

      const step2Prompt = stepInputs[1] as any[];
      const step2UserMsg = step2Prompt.find((m: any) => m.role === 'user');
      expect(step2UserMsg).toBeDefined();
      expect(step2UserMsg.content.some((p: any) => p.type === 'text' && p.text.includes('NYC'))).toBe(true);
      expect(
        step2Prompt.some(
          (msg: any) =>
            msg.role === 'assistant' &&
            msg.content?.some((p: any) => p.type === 'tool-call' && p.toolCallId === 'call-weather-1'),
        ),
      ).toBe(true);
      expect(
        step2Prompt.some(
          (msg: any) =>
            msg.role === 'tool' &&
            msg.content?.some((p: any) => p.type === 'tool-result' && p.toolCallId === 'call-weather-1'),
        ),
      ).toBe(true);

      const step3Prompt = stepInputs[2] as any[];
      const step3UserMsg = step3Prompt.find((m: any) => m.role === 'user');
      expect(step3UserMsg).toBeDefined();
      expect(step3UserMsg.content.some((p: any) => p.type === 'text' && p.text.includes('NYC'))).toBe(true);
      expect(
        step3Prompt.some((msg: any) =>
          msg.content?.some((p: any) => p.toolCallId === 'call-weather-1' || p.toolCallId === 'call-weather-2'),
        ),
      ).toBe(true);
      expect(step3Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-1'))).toBe(
        false,
      );
      expect(step3Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-2'))).toBe(
        true,
      );
    });

    it('should preserve the last two tool-call steps with filterAfterToolSteps 2', async () => {
      const { loop } = await import('../../loop/loop');
      const { stepCountIs } = await import('@internal/ai-sdk-v5');
      const { convertArrayToReadableStream, mockValues, mockId } = await import('@internal/ai-sdk-v5/test');
      const { MastraLanguageModelV2Mock } = await import('../../loop/test-utils/MastraLanguageModelV2Mock');
      const { z } = await import('zod/v4');

      const stepInputs: any[] = [];
      let responseCount = 0;

      const messageList = new MessageList();
      messageList.add(
        {
          id: 'msg-user-filter-after-two',
          role: 'user',
          content: [{ type: 'text', text: 'Check weather in NYC, Brooklyn, and Queens.' }],
        },
        'input',
      );

      const result = await loop({
        methodType: 'stream',
        runId: 'test-toolcallfilter-after-two-integration',
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MastraLanguageModelV2Mock({
              doStream: async ({ prompt }: { prompt: unknown }) => {
                stepInputs.push(prompt);
                const currentResponse = responseCount++;
                const toolCallId = `call-weather-${currentResponse + 1}`;
                const cities = ['NYC', 'Brooklyn', 'Queens'];

                if (currentResponse < 3) {
                  return {
                    stream: convertArrayToReadableStream([
                      {
                        type: 'response-metadata',
                        id: `resp-${currentResponse}`,
                        modelId: 'mock-model-id',
                        timestamp: new Date(currentResponse * 1000),
                      },
                      {
                        type: 'tool-call',
                        id: toolCallId,
                        toolCallId,
                        toolName: 'weather',
                        input: `{ "city": "${cities[currentResponse]}" }`,
                      },
                      {
                        type: 'finish',
                        finishReason: 'tool-calls',
                        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                      },
                    ]),
                  };
                }

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'resp-3',
                      modelId: 'mock-model-id',
                      timestamp: new Date(3000),
                    },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Done checking weather.' },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 },
                    },
                  ]),
                };
              },
            }),
          },
        ],
        inputProcessors: [new ToolCallFilter({ filterAfterToolSteps: 2 })],
        tools: {
          weather: {
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }: { city: string }) => `Sunny in ${city}`,
          },
        },
        messageList,
        stopWhen: stepCountIs(5),
        _internal: {
          now: mockValues(0, 100, 500, 600, 1000, 1100, 1500, 1600, 2000, 2100),
          generateId: mockId({ prefix: 'id' }),
        },
        agentId: 'test-agent',
      });

      await result.consumeStream();

      expect(stepInputs).toHaveLength(4);

      const step3Prompt = stepInputs[2] as any[];
      expect(step3Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-1'))).toBe(
        true,
      );
      expect(step3Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-2'))).toBe(
        true,
      );

      const step4Prompt = stepInputs[3] as any[];
      expect(step4Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-1'))).toBe(
        false,
      );
      expect(step4Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-2'))).toBe(
        true,
      );
      expect(step4Prompt.some((msg: any) => msg.content?.some((p: any) => p.toolCallId === 'call-weather-3'))).toBe(
        true,
      );
    });
  });
});
