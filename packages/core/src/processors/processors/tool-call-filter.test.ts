import { describe, it, expect } from 'vitest';

import type { MastraMessageV2 } from '../../agent/message-list';

import { ToolCallFilter } from './tool-call-filter';

describe('ToolCallFilter', () => {
  const mockAbort = ((reason?: string) => {
    throw new Error(reason || 'Aborted');
  }) as (reason?: string) => never;

  describe('exclude all tool calls (default)', () => {
    it('should exclude all tool calls and tool results', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is the weather?',
            parts: [],
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
            ],
          },
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: {
            format: 2,
            content: 'The weather is sunny and 72°F',
            parts: [],
          },
          createdAt: new Date(),
        },
      ];

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('msg-1');
      expect(result[1]!.id).toBe('msg-4');
    });

    it('should handle messages without tool calls', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello',
            parts: [],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Hi there!',
            parts: [],
          },
          createdAt: new Date(),
        },
      ];

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      expect(result).toHaveLength(2);
      expect(result).toEqual(messages);
    });

    it('should handle empty messages array', async () => {
      const filter = new ToolCallFilter();

      const result = await filter.processInput({
        messages: [],
        abort: mockAbort,
      });

      expect(result).toHaveLength(0);
    });

    it('should exclude multiple tool calls in sequence', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is 2+2 and the weather?',
            parts: [],
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
                  toolName: 'calculator',
                  args: { expression: '2+2' },
                },
              },
            ],
          },
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
        {
          id: 'msg-6',
          role: 'assistant',
          content: {
            format: 2,
            content: '2+2 is 4 and the weather is sunny',
            parts: [],
          },
          createdAt: new Date(),
        },
      ];

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('msg-1');
      expect(result[1]!.id).toBe('msg-6');
    });
  });

  describe('exclude specific tool calls', () => {
    it('should exclude only specified tool calls', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather'] });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is 2+2 and the weather?',
            parts: [],
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
                  toolName: 'calculator',
                  args: { expression: '2+2' },
                },
              },
            ],
          },
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
        {
          id: 'msg-6',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Final answer',
            parts: [],
          },
          createdAt: new Date(),
        },
      ];

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      // Should keep: user message, calculator call, calculator result, final assistant message
      expect(result).toHaveLength(4);
      expect(result[0]!.id).toBe('msg-1');
      expect(result[1]!.id).toBe('msg-2');
      expect(result[2]!.id).toBe('msg-3');
      expect(result[3]!.id).toBe('msg-6');
    });

    it('should exclude multiple specified tools', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather', 'search'] });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Calculate, search, and check weather',
            parts: [],
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
                  toolName: 'calculator',
                  args: {},
                },
              },
            ],
          },
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
      ];

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      // Should keep: user message, calculator call, calculator result
      expect(result).toHaveLength(3);
      expect(result[0]!.id).toBe('msg-1');
      expect(result[1]!.id).toBe('msg-2');
      expect(result[2]!.id).toBe('msg-3');
    });

    it('should handle empty exclude array (keep all messages)', async () => {
      const filter = new ToolCallFilter({ exclude: [] });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is the weather?',
            parts: [],
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
          createdAt: new Date(),
        },
      ];

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      expect(result).toHaveLength(3);
      expect(result).toEqual(messages);
    });

    it('should handle tool calls that are not in exclude list', async () => {
      const filter = new ToolCallFilter({ exclude: ['nonexistent'] });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'What is the weather?',
            parts: [],
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
          createdAt: new Date(),
        },
      ];

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      // Should keep all messages since 'weather' is not in exclude list
      expect(result).toHaveLength(3);
      expect(result).toEqual(messages);
    });
  });

  describe('edge cases', () => {
    it('should handle assistant messages without tool_calls property', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello',
            parts: [],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Hi there!',
            parts: [],
          },
          createdAt: new Date(),
          // No tool_calls property
        },
      ];

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      expect(result).toHaveLength(2);
      expect(result).toEqual(messages);
    });

    it('should handle assistant messages with empty tool_calls array', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello',
            parts: [],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Hi there!',
            parts: [],
          },
          createdAt: new Date(),
        },
      ];

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      expect(result).toHaveLength(2);
      expect(result).toEqual(messages);
    });

    it('should handle tool messages without toolCallId', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather'] });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            content: 'Hello',
            parts: [],
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

      const result = await filter.processInput({
        messages,
        abort: mockAbort,
      });

      // Should keep both messages since we can't match the tool result to an excluded call
      expect(result).toHaveLength(2);
    });
  });
});
