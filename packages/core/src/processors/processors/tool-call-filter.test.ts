import { describe, it, expect } from 'vitest';

import { MessageList } from '../../agent/message-list';
import type { MastraDBMessage } from '../../memory/types';
import { toolCallFilterProvider } from '../../processor-provider/providers';

import { ToolCallFilter } from './tool-call-filter';

describe('ToolCallFilter', () => {
  const mockAbort = ((reason?: string) => {
    throw new Error(reason || 'Aborted');
  }) as (reason?: string) => never;

  const createProcessInputStepArgs = (messageList: MessageList, steps: any[] = []) =>
    ({
      messages: messageList.get.all.db(),
      messageList,
      stepNumber: steps.length,
      steps,
      systemMessages: [],
      state: {},
      model: {
        modelId: 'test-model',
        provider: 'test',
        specificationVersion: 'v2',
      },
      abort: mockAbort,
      retryCount: 0,
    }) as any;

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

    it('should preserve compact model output while excluding raw tool results when enabled', async () => {
      const filter = new ToolCallFilter({ preserveModelOutput: true });

      const rawResult = {
        rows: Array.from({ length: 20 }, (_, index) => ({ id: index, value: `raw-${index}` })),
        diagnostics: { retainedOnlyForApp: true },
      };
      const modelOutput = { type: 'text', value: 'Weather summary: sunny, 72F' };

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
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
                  result: rawResult,
                },
                providerMetadata: {
                  mastra: {
                    modelOutput,
                  },
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

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(1);

      const parts = resultMessages[0]!.content.parts;
      expect(parts).toHaveLength(1);
      expect(parts[0]).toMatchObject({
        type: 'text',
        text: 'weather result:\nWeather summary: sunny, 72F',
      });
      expect(JSON.stringify(resultMessages)).not.toContain('retainedOnlyForApp');
      expect(JSON.stringify(resultMessages)).not.toContain('location');

      const filteredList = new MessageList();
      filteredList.add(resultMessages, 'memory');
      const prompt = await filteredList.get.all.aiV5.llmPrompt();
      expect(JSON.stringify(prompt)).toContain('Weather summary: sunny, 72F');
      expect(JSON.stringify(prompt)).not.toContain('retainedOnlyForApp');
    });

    it('should still remove model output tool results by default', async () => {
      const filter = new ToolCallFilter();

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
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
                  result: { raw: true },
                },
                providerMetadata: {
                  mastra: {
                    modelOutput: { type: 'text', value: 'compact' },
                  },
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

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(0);
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

    it('should preserve top-level text content when all tool parts are filtered', async () => {
      const filter = new ToolCallFilter();
      const messages: MastraDBMessage[] = [
        {
          id: 'assistant-with-text-fallback',
          role: 'assistant',
          content: {
            format: 2,
            content: 'I found three relevant papers.',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'search_papers',
                  args: { query: 'attention mechanisms' },
                  result: { papers: ['paper-1', 'paper-2', 'paper-3'] },
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

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(1);

      const resultContent = resultMessages[0]!.content;
      if (typeof resultContent === 'string') {
        throw new Error('Expected format 2 content');
      }
      expect(resultContent.content).toBe('I found three relevant papers.');
      expect(resultContent.parts).toEqual([]);
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

    it('should preserve model output only for excluded tools when enabled', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather'], preserveModelOutput: true });

      const weatherModelOutput = { type: 'text', value: 'Weather summary: sunny' };
      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            content: '',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-weather',
                  toolName: 'weather',
                  args: { location: 'NYC' },
                  result: { rawWeather: true },
                },
                providerMetadata: {
                  mastra: {
                    modelOutput: weatherModelOutput,
                  },
                },
              },
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-calculator',
                  toolName: 'calculator',
                  args: { expression: '2+2' },
                  result: { value: 4 },
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

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      const parts = resultMessages[0]!.content.parts;
      const textParts = parts.filter((part: any) => part.type === 'text');
      const toolParts = parts.filter((part: any) => part.type === 'tool-invocation');

      expect(textParts).toHaveLength(1);
      expect(textParts[0]).toMatchObject({ text: 'weather result:\nWeather summary: sunny' });
      expect(toolParts).toHaveLength(1);
      expect((toolParts[0] as any).toolInvocation.result).toEqual({ value: 4 });
      expect(JSON.stringify(resultMessages)).not.toContain('rawWeather');
    });

    it('should expose step filtering and model output options through the processor provider config', async () => {
      const parsedConfig = toolCallFilterProvider.configSchema.parse({
        filterAfterToolSteps: 0,
        preserveModelOutput: true,
      });
      const processor = toolCallFilterProvider.createProcessor(parsedConfig);

      expect(processor).toBeInstanceOf(ToolCallFilter);
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

    it('should preserve top-level text content when all excluded tool parts are filtered', async () => {
      const filter = new ToolCallFilter({ exclude: ['search_papers'] });
      const messages: MastraDBMessage[] = [
        {
          id: 'assistant-with-text-fallback',
          role: 'assistant',
          content: {
            format: 2,
            content: 'I found three relevant papers.',
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'call-1',
                  toolName: 'search_papers',
                  args: { query: 'attention mechanisms' },
                  result: { papers: ['paper-1', 'paper-2', 'paper-3'] },
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

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(1);

      const resultContent = resultMessages[0]!.content;
      if (typeof resultContent === 'string') {
        throw new Error('Expected format 2 content');
      }
      expect(resultContent.content).toBe('I found three relevant papers.');
      expect(resultContent.parts).toEqual([]);
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

    it('should exclude AI SDK v5 and v6 tool UI parts by tool name', async () => {
      const filter = new ToolCallFilter({ exclude: ['weather', 'dynamicWeather'] });

      const messages = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-weather',
                toolCallId: 'call-1',
                state: 'output-available',
                input: { city: 'Paris' },
                output: 'Rain',
              },
              {
                type: 'dynamic-tool',
                toolCallId: 'call-2',
                toolName: 'dynamicWeather',
                state: 'output-available',
                input: { city: 'Berlin' },
                output: 'Cloudy',
              },
              {
                type: 'tool-calculator',
                toolCallId: 'call-3',
                state: 'output-available',
                input: { expression: '2+2' },
                output: '4',
              },
              { type: 'text' as const, text: 'Calculator said 4.' },
            ],
          },
          createdAt: new Date(),
        },
      ] as unknown as MastraDBMessage[];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInput({
        messages,
        messageList,
        abort: mockAbort,
      });

      const resultMessages = Array.isArray(result) ? result : result.get.all.db();
      expect(resultMessages).toHaveLength(1);
      expect(resultMessages[0]!.content.parts.map((part: any) => part.type)).toEqual(['tool-calculator', 'text']);
    });
  });

  describe('processInputStep', () => {
    it('should filter all previous tool calls when filterAfterToolSteps is 0', async () => {
      const filter = new ToolCallFilter({ filterAfterToolSteps: 0 });
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text' as const, text: 'Use a tool.' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'old-call',
                  toolName: 'search',
                  args: { q: 'old' },
                  result: 'OLD_TOOL_RESULT',
                },
              },
              { type: 'text' as const, text: 'Tool completed.' },
            ],
          },
          createdAt: new Date(),
        },
      ] as unknown as MastraDBMessage[];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(createProcessInputStepArgs(messageList));

      expect(result.modelContextMessages).toHaveLength(2);
      expect(JSON.stringify(result.modelContextMessages)).not.toContain('OLD_TOOL_RESULT');
      expect(JSON.stringify(result.modelContextMessages)).toContain('Tool completed.');
    });

    it('should run at each step and preserve the latest step tool result by default', async () => {
      const filter = new ToolCallFilter();

      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text' as const, text: 'Research and summarize.' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'old-call',
                  toolName: 'search',
                  args: { q: 'old' },
                  result: 'OLD_TOOL_RESULT',
                },
              },
              { type: 'step-start' as const },
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'latest-call',
                  toolName: 'search',
                  args: { q: 'latest' },
                  result: 'LATEST_TOOL_RESULT',
                },
              },
            ],
          },
          createdAt: new Date(),
        },
      ] as unknown as MastraDBMessage[];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(
        createProcessInputStepArgs(messageList, [
          {
            toolCalls: [{ toolCallId: 'latest-call', toolName: 'search' }],
            toolResults: [{ toolCallId: 'latest-call', toolName: 'search', result: 'LATEST_TOOL_RESULT' }],
          },
        ]),
      );

      const contextMessages = result.modelContextMessages!;
      expect(contextMessages).toHaveLength(2);
      const assistantParts = contextMessages[1]!.content.parts;
      expect(JSON.stringify(assistantParts)).not.toContain('OLD_TOOL_RESULT');
      expect(JSON.stringify(assistantParts)).toContain('LATEST_TOOL_RESULT');
      expect(assistantParts.map((part: any) => part.type)).toEqual(['tool-invocation']);
      expect(JSON.stringify(messageList.get.all.db())).toContain('OLD_TOOL_RESULT');
    });

    it('should remove the latest step tool result when preserveLatestStep is false', async () => {
      const filter = new ToolCallFilter({ preserveLatestStep: false });
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text' as const, text: 'Use a tool.' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'latest-call',
                  toolName: 'lookup',
                  args: {},
                  result: 'LATEST_TOOL_RESULT',
                },
              },
            ],
          },
          createdAt: new Date(),
        },
      ] as unknown as MastraDBMessage[];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(
        createProcessInputStepArgs(messageList, [
          {
            toolResults: [{ toolCallId: 'latest-call', toolName: 'lookup', result: 'LATEST_TOOL_RESULT' }],
          },
        ]),
      );

      expect(result.modelContextMessages).toHaveLength(1);
      expect(result.modelContextMessages![0]!.id).toBe('msg-1');
      expect(JSON.stringify(messageList.get.all.db())).toContain('LATEST_TOOL_RESULT');
    });

    it('should not preserve all tool history when steps exist without step-start markers', async () => {
      const filter = new ToolCallFilter();
      const messages = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'old-call',
                  toolName: 'search',
                  args: {},
                  result: 'OLD_TOOL_RESULT',
                },
              },
              {
                type: 'tool-invocation' as const,
                toolInvocation: {
                  state: 'result' as const,
                  toolCallId: 'latest-call',
                  toolName: 'search',
                  args: {},
                  result: 'LATEST_TOOL_RESULT',
                },
              },
            ],
          },
          createdAt: new Date(),
        },
      ] as unknown as MastraDBMessage[];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(
        createProcessInputStepArgs(messageList, [
          {
            toolResults: [{ toolCallId: 'latest-call', toolName: 'search', result: 'LATEST_TOOL_RESULT' }],
          },
        ]),
      );

      expect(JSON.stringify(result.modelContextMessages)).not.toContain('OLD_TOOL_RESULT');
      expect(JSON.stringify(result.modelContextMessages)).toContain('LATEST_TOOL_RESULT');
      expect(JSON.stringify(messageList.get.all.db())).toContain('OLD_TOOL_RESULT');
    });

    it('should handle AI SDK tool-call and tool-result parts in step messages', async () => {
      const filter = new ToolCallFilter({ exclude: ['lookup'] });
      const messages = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'lookup', args: { id: 1 } },
              { type: 'tool-result' as const, toolCallId: 'call-1', toolName: 'lookup', result: 'SECRET_RESULT' },
              { type: 'tool-call' as const, toolCallId: 'call-2', toolName: 'calculator', args: { expression: '2+2' } },
              { type: 'tool-result' as const, toolCallId: 'call-2', toolName: 'calculator', result: '4' },
            ],
          },
          createdAt: new Date(),
        },
      ] as unknown as MastraDBMessage[];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(createProcessInputStepArgs(messageList));
      expect(result.modelContextMessages).toHaveLength(1);
      expect(JSON.stringify(result.modelContextMessages)).not.toContain('SECRET_RESULT');
      expect(result.modelContextMessages![0]!.content.parts.map((part: any) => part.toolName)).toEqual([
        'calculator',
        'calculator',
      ]);
      expect(JSON.stringify(messageList.get.all.db())).toContain('SECRET_RESULT');
    });

    it('should filter legacy toolInvocations even when parts have no tool parts', async () => {
      const filter = new ToolCallFilter({ exclude: ['lookup'] });
      const messages = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            content: 'Tool summary',
            parts: [{ type: 'text' as const, text: 'Tool summary' }],
            toolInvocations: [
              { toolCallId: 'call-1', toolName: 'lookup', result: 'SECRET_RESULT' },
              { toolCallId: 'call-2', toolName: 'calculator', result: '4' },
            ],
          },
          createdAt: new Date(),
        },
      ] as unknown as MastraDBMessage[];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(createProcessInputStepArgs(messageList));
      expect(result.modelContextMessages).toHaveLength(1);
      expect(JSON.stringify(result.modelContextMessages)).not.toContain('SECRET_RESULT');
      expect((result.modelContextMessages![0]!.content as any).toolInvocations).toEqual([
        { toolCallId: 'call-2', toolName: 'calculator', result: '4' },
      ]);
      expect(JSON.stringify(messageList.get.all.db())).toContain('SECRET_RESULT');
    });

    it('should preserve latest legacy toolInvocations from step-start fallback', async () => {
      const filter = new ToolCallFilter();
      const messages = [
        {
          id: 'old-step',
          role: 'assistant',
          content: {
            format: 2,
            parts: [{ type: 'step-start' }],
            toolInvocations: [{ toolCallId: 'call-old', toolName: 'lookup', result: 'OLD_RESULT' }],
          },
          createdAt: new Date(),
        },
        {
          id: 'latest-step',
          role: 'assistant',
          content: {
            format: 2,
            parts: [{ type: 'step-start' }],
            toolInvocations: [{ toolCallId: 'call-latest', toolName: 'lookup', result: 'LATEST_RESULT' }],
          },
          createdAt: new Date(),
        },
      ] as unknown as MastraDBMessage[];

      const messageList = new MessageList();

      const result = await filter.processInputStep({
        ...createProcessInputStepArgs(messageList),
        messages,
      });
      expect(JSON.stringify(result.modelContextMessages)).toContain('LATEST_RESULT');
      expect(JSON.stringify(result.modelContextMessages)).not.toContain('OLD_RESULT');
    });

    it('should not infer generic raw tool-call and tool-result type suffixes as tool names', async () => {
      const filter = new ToolCallFilter({ exclude: ['result'] });
      const messages = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              { type: 'tool-call' as const, toolCallId: 'call-1', args: { id: 1 } },
              { type: 'tool-result' as const, toolCallId: 'call-1', result: 'RESULT_WITHOUT_TOOL_NAME' },
            ],
          },
          createdAt: new Date(),
        },
      ] as unknown as MastraDBMessage[];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await filter.processInputStep(createProcessInputStepArgs(messageList));
      expect(result.modelContextMessages).toBeUndefined();
      expect(JSON.stringify(messageList.get.all.db())).toContain('RESULT_WITHOUT_TOOL_NAME');
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
