import { describe, it, expect } from 'vitest';

import { MessageList } from '../../agent/message-list';
import type { MastraDBMessage } from '../../memory/types';
import type { ProcessInputStepArgs } from '../index';

import { ToolCallFilter } from './tool-call-filter';

function mockStepArgs(messageList: MessageList): ProcessInputStepArgs {
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
    it('should filter tool calls at each agentic loop step', async () => {
      const filter = new ToolCallFilter();

      const baseTime = Date.now();
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Get the weather and then book a flight',
            parts: [{ type: 'text' as const, text: 'Get the weather and then book a flight' }],
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
          createdAt: new Date(baseTime + 1),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(mockStepArgs(messageList));

      expect(result.messages).toBeDefined();
      const filteredMessages = result.messages!;
      expect(filteredMessages).toHaveLength(2);
      expect(filteredMessages[0]!.id).toBe('msg-1');

      // Tool invocations should be stripped, text kept
      const assistantMsg = filteredMessages[1]!;
      if (typeof assistantMsg.content !== 'string') {
        const hasToolInvocation = assistantMsg.content.parts.some((p: any) => p.type === 'tool-invocation');
        expect(hasToolInvocation).toBe(false);
        const textParts = assistantMsg.content.parts.filter((p: any) => p.type === 'text');
        expect(textParts.length).toBeGreaterThan(0);
      }
    });

    it('should filter specific tools per step', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather'] });

      const baseTime = Date.now();
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Do tasks',
            parts: [{ type: 'text' as const, text: 'Do tasks' }],
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
          createdAt: new Date(baseTime + 1),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(mockStepArgs(messageList));

      expect(result.messages).toBeDefined();
      const filteredMessages = result.messages!;
      expect(filteredMessages).toHaveLength(2);

      // Weather tool calls should be removed, book-flight kept
      const assistantMsg = filteredMessages[1]!;
      if (typeof assistantMsg.content !== 'string') {
        const toolParts = assistantMsg.content.parts.filter((p: any) => p.type === 'tool-invocation');
        expect(toolParts.length).toBe(2); // Only book-flight call + result
        expect(toolParts.every((p: any) => p.toolInvocation.toolName === 'book-flight')).toBe(true);
      }
    });

    it('should return all messages when exclude list is empty', async () => {
      const filter = new ToolCallFilter({ exclude: [] });

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
    it('should filter older tool calls while preserving the most recent step', async () => {
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
          content: [{ type: 'text', text: 'Check weather in NYC then book a flight there' }],
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
                    // Step 0: LLM calls the weather tool
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
                    // Step 1: LLM calls the booking tool
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
                          id: 'call-booking-1',
                          toolCallId: 'call-booking-1',
                          toolName: 'booking',
                          input: '{ "destination": "NYC" }',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                        },
                      ]),
                    };
                  case 2:
                    // Step 2: LLM responds with text
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'resp-2',
                          modelId: 'mock-model-id',
                          timestamp: new Date(2000),
                        },
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'Weather checked and flight booked!' },
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
        inputProcessors: [new ToolCallFilter()],
        tools: {
          weather: {
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }: { city: string }) => `Sunny, 72°F in ${city}`,
          },
          booking: {
            inputSchema: z.object({ destination: z.string() }),
            execute: async ({ destination }: { destination: string }) => `Flight booked to ${destination}`,
          },
        },
        messageList,
        stopWhen: stepCountIs(4),
        _internal: {
          now: mockValues(0, 100, 200, 500, 600, 700, 1000, 1100, 1200),
          generateId: mockId({ prefix: 'id' }),
        },
        agentId: 'test-agent',
      });

      await result.consumeStream();

      // Should have had 3 LLM calls
      expect(stepInputs).toHaveLength(3);

      // Step 0 prompt: should contain only the user message
      const step0Prompt = stepInputs[0] as any[];
      const step0UserMsg = step0Prompt.find((m: any) => m.role === 'user');
      expect(step0UserMsg).toBeDefined();
      expect(step0UserMsg.content.some((p: any) => p.type === 'text' && p.text.includes('NYC'))).toBe(true);

      // Step 1 prompt: should still have step 0's tool results (only 1 step-start,
      // so processInputStep preserves the most recent step's results)
      const step1Prompt = stepInputs[1] as any[];
      const step1ToolMsgs = step1Prompt.filter((m: any) => m.role === 'tool');
      expect(step1ToolMsgs.length).toBeGreaterThan(0);

      // Step 2 prompt: with 2+ step-starts, older tool calls (weather) should
      // be filtered while the most recent step's tool results (booking) are preserved
      const step2Prompt = stepInputs[2] as any[];

      // User text message should still be present
      const step2UserMsg = step2Prompt.find((m: any) => m.role === 'user');
      expect(step2UserMsg).toBeDefined();
      expect(step2UserMsg.content.some((p: any) => p.type === 'text' && p.text.includes('NYC'))).toBe(true);

      // Step 0's weather tool calls should be filtered
      const weatherToolMsgs = step2Prompt.filter(
        (m: any) =>
          m.role === 'tool' && m.content?.some((p: any) => p.type === 'tool-result' && p.toolName === 'weather'),
      );
      expect(weatherToolMsgs).toHaveLength(0);

      // Step 1's booking tool results should still be present (most recent step)
      const bookingToolMsgs = step2Prompt.filter(
        (m: any) =>
          m.role === 'tool' && m.content?.some((p: any) => p.type === 'tool-result' && p.toolName === 'booking'),
      );
      expect(bookingToolMsgs.length).toBeGreaterThan(0);
    });
  });
});
