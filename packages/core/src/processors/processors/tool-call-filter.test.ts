import { describe, it, expect } from 'vitest';

import { MessageList } from '../../agent/message-list';
import type { MastraDBMessage } from '../../memory/types';

import { ToolCallFilter } from './tool-call-filter';

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
});
