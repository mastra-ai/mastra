import type * as AIV4 from '@internal/ai-sdk-v4';
import type * as AIV5 from 'ai-v5';
import { describe, it, expect } from 'vitest';
import type { MastraDBMessage } from '../index';
import { convertMessages } from './convert-messages';

describe('convertMessages', () => {
  describe('AIV5 UI to other formats', () => {
    const v5UIMessage: AIV5.UIMessage = {
      id: 'test-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello world' }],
    };

    it('converts AIV5 UI to AIV4 UI', () => {
      const result = convertMessages(v5UIMessage).to('AIV4.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello world');
    });

    it('converts AIV5 UI to AIV4 Core', () => {
      const result = convertMessages(v5UIMessage).to('AIV4.Core');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toEqual([{ type: 'text', text: 'Hello world' }]);
    });

    it('converts AIV5 UI to Mastra V2', () => {
      const result = convertMessages(v5UIMessage).to('Mastra.V2');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content.format).toBe(2);
      expect(result[0].content.parts).toHaveLength(1);
      expect(result[0].content.parts[0].type).toBe('text');
      expect(result[0].content.parts[0].text).toBe('Hello world');
    });
  });

  describe('AIV4 UI to other formats', () => {
    const v4UIMessage: AIV4.UIMessage = {
      id: 'test-2',
      role: 'assistant',
      content: 'Hi there!',
      parts: [{ type: 'text', text: 'Hi there!' }],
    };

    it('converts AIV4 UI to AIV5 UI', () => {
      const result = convertMessages(v4UIMessage).to('AIV5.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      // Check for text part - may have additional parts
      const textPart = result[0].parts.find(p => p.type === 'text');
      expect(textPart).toBeDefined();
      expect(textPart?.text).toBe('Hi there!');
    });

    it('converts AIV4 UI to AIV5 Model', () => {
      const result = convertMessages(v4UIMessage).to('AIV5.Model');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toEqual([{ type: 'text', text: 'Hi there!' }]);
    });

    it('converts AIV4 UI to Mastra V2', () => {
      const result = convertMessages(v4UIMessage).to('Mastra.V2');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content.format).toBe(2);
      // Check that parts are preserved
      expect(result[0].content.parts).toHaveLength(1);
      expect(result[0].content.parts[0].type).toBe('text');
      expect(result[0].content.parts[0].text).toBe('Hi there!');
    });
  });

  describe('Mastra V2 to other formats', () => {
    const mastraV2Message: MastraDBMessage = {
      id: 'test-3',
      role: 'user',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Test message' }],
        content: 'Test message',
      },
    };

    it('converts Mastra V2 to AIV4 UI', () => {
      const result = convertMessages(mastraV2Message).to('AIV4.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Test message');
    });

    it('converts Mastra V2 to AIV5 UI', () => {
      const result = convertMessages(mastraV2Message).to('AIV5.UI');
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].parts).toEqual([{ type: 'text', text: 'Test message' }]);
    });
  });

  describe('Multiple messages', () => {
    const messages: AIV4.UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        parts: [{ type: 'text', text: 'Hello' }],
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi! How can I help?',
        parts: [{ type: 'text', text: 'Hi! How can I help?' }],
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'What is the weather?',
        parts: [{ type: 'text', text: 'What is the weather?' }],
      },
    ];

    it('converts multiple AIV4 UI messages to AIV5 UI', () => {
      const result = convertMessages(messages).to('AIV5.UI');
      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('user');
      const textPart0 = result[0].parts.find(p => p.type === 'text');
      expect(textPart0?.text).toBe('Hello');

      expect(result[1].role).toBe('assistant');
      const textPart1 = result[1].parts.find(p => p.type === 'text');
      expect(textPart1?.text).toBe('Hi! How can I help?');

      expect(result[2].role).toBe('user');
      const textPart2 = result[2].parts.find(p => p.type === 'text');
      expect(textPart2?.text).toBe('What is the weather?');
    });

    it('converts multiple messages to Mastra V2', () => {
      const result = convertMessages(messages).to('Mastra.V2');
      expect(result).toHaveLength(3);
      // Check that parts are preserved for each message
      expect(result[0].content.parts[0].text).toBe('Hello');
      expect(result[1].content.parts[0].text).toBe('Hi! How can I help?');
      expect(result[2].content.parts[0].text).toBe('What is the weather?');
      result.forEach(msg => {
        expect(msg.content.format).toBe(2);
      });
    });
  });

  // Note: Tool message testing is simplified to avoid complex type issues
  // The actual conversion of tool parts is tested in the main MessageList tests

  describe('Error handling', () => {
    it('throws error for unsupported output format', () => {
      expect(() => {
        // @ts-expect-error - testing invalid format
        convertMessages({ role: 'user', content: 'test' }).to('INVALID');
      }).toThrow('Unsupported output format: INVALID');
    });
  });

  /**
   * Regression tests for GitHub Issue #10386
   * https://github.com/mastra-ai/mastra/issues/10386
   *
   * Problem: When users pass messages in OpenAI format (with `tool_calls` array
   * and `tool_call_id` properties), the convertMessages function drops the tool
   * information entirely.
   *
   * Note: AIV5.Model conversion may produce more messages than the input
   * because it splits tool calls and tool results into separate messages.
   * The key assertion is that tool information is PRESERVED, not that
   * message counts match exactly.
   */
  describe('OpenAI format tool messages (Issue #10386)', () => {
    /**
     * OpenAI format message types
     * These match the format users would have stored in their existing databases
     */
    interface OpenAIAssistantMessage {
      role: 'assistant';
      content: string;
      tool_calls?: {
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }[];
    }

    interface OpenAIToolMessage {
      role: 'tool';
      content: string;
      tool_call_id: string;
    }

    interface OpenAIUserMessage {
      role: 'user';
      content: string | { type: 'text'; text: string }[];
    }

    type OpenAIMessage = OpenAIAssistantMessage | OpenAIToolMessage | OpenAIUserMessage;

    it('should preserve tool_calls from assistant messages', () => {
      // This is the exact format from the issue reporter's example
      const openAIMessages: OpenAIMessage[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Tell me about xyz' }],
        },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_ZgjQ5HRiLUttzf4NFeTWYJd5',
              type: 'function',
              function: {
                name: 'wikiSearchTool',
                arguments: '{"query":"xyz"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          content: JSON.stringify([{ content: 'No content was found' }]),
          tool_call_id: 'call_ZgjQ5HRiLUttzf4NFeTWYJd5',
        },
      ];

      const result = convertMessages(openAIMessages as any).to('AIV5.Model');

      // Find the tool call with the expected toolName
      let toolCallPart: AIV5.ToolCallPart | undefined;
      for (const msg of result) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-call' && part.toolName === 'wikiSearchTool') {
              toolCallPart = part;
            }
          }
        }
      }

      expect(toolCallPart).toBeDefined();
      expect(toolCallPart?.toolCallId).toBe('call_ZgjQ5HRiLUttzf4NFeTWYJd5');
      expect(toolCallPart?.input).toEqual({ query: 'xyz' });

      // Find the tool result with the expected toolCallId
      let toolResultPart: AIV5.ToolResultPart | undefined;
      for (const msg of result) {
        if (msg.role === 'tool' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-result' && part.toolCallId === 'call_ZgjQ5HRiLUttzf4NFeTWYJd5') {
              toolResultPart = part;
            }
          }
        }
      }

      expect(toolResultPart).toBeDefined();
    });

    it('should handle multiple sequential tool calls in OpenAI format', () => {
      const openAIMessages: OpenAIMessage[] = [
        {
          role: 'user',
          content: 'Search for apples and oranges',
        },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'search',
                arguments: '{"query":"apples"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          content: 'Results for apples',
          tool_call_id: 'call_1',
        },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_2',
              type: 'function',
              function: {
                name: 'search',
                arguments: '{"query":"oranges"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          content: 'Results for oranges',
          tool_call_id: 'call_2',
        },
        {
          role: 'assistant',
          content: 'Here is what I found about apples and oranges...',
        },
      ];

      const result = convertMessages(openAIMessages as any).to('AIV5.Model');

      // Find all tool calls in the result
      const allToolCalls: AIV5.ToolCallPart[] = [];
      for (const msg of result) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-call') {
              allToolCalls.push(part as AIV5.ToolCallPart);
            }
          }
        }
      }

      // Should have both tool calls (may have duplicates from conversion)
      expect(allToolCalls.length).toBeGreaterThanOrEqual(2);
      expect(allToolCalls.some(tc => tc.toolCallId === 'call_1')).toBe(true);
      expect(allToolCalls.some(tc => tc.toolCallId === 'call_2')).toBe(true);

      // Find all tool results in the result
      const allToolResults: AIV5.ToolResultPart[] = [];
      for (const msg of result) {
        if (msg.role === 'tool' && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'tool-result') {
              allToolResults.push(part as AIV5.ToolResultPart);
            }
          }
        }
      }

      // Should have both tool results (may have duplicates from conversion)
      expect(allToolResults.length).toBeGreaterThanOrEqual(2);
      expect(allToolResults.some(tr => tr.toolCallId === 'call_1')).toBe(true);
      expect(allToolResults.some(tr => tr.toolCallId === 'call_2')).toBe(true);

      // Final assistant message should have text content
      const textMessages = result.filter(
        msg =>
          msg.role === 'assistant' &&
          Array.isArray(msg.content) &&
          msg.content.some(part => part.type === 'text' && part.text.includes('apples and oranges')),
      );
      expect(textMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('should roundtrip OpenAI format through Mastra.V2 storage', () => {
      const openAIMessages: OpenAIMessage[] = [
        {
          role: 'user',
          content: 'What is the weather?',
        },
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_weather',
              type: 'function',
              function: {
                name: 'getWeather',
                arguments: '{"location":"New York"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          content: '{"temp": 72, "condition": "sunny"}',
          tool_call_id: 'call_weather',
        },
      ];

      // First convert to Mastra.V2 (database storage format)
      const dbMessages = convertMessages(openAIMessages as any).to('Mastra.V2');

      // Verify tool invocation is stored in DB format
      expect(dbMessages.length).toBeGreaterThanOrEqual(2);

      // Find the message with tool invocation
      const dbMsgWithToolCall = dbMessages.find(
        msg =>
          msg.content.toolInvocations?.some(ti => ti.toolCallId === 'call_weather') ||
          msg.content.parts?.some(p => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === 'call_weather'),
      );
      expect(dbMsgWithToolCall).toBeDefined();

      // Then convert back to AIV5.Model (for sending to LLM)
      const modelMessages = convertMessages(dbMessages).to('AIV5.Model');

      // Find the tool call in model messages
      let foundToolCall: AIV5.ToolCallPart | undefined;
      for (const msg of modelMessages) {
        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          const tc = msg.content.find(part => part.type === 'tool-call') as AIV5.ToolCallPart | undefined;
          if (tc?.toolCallId === 'call_weather') {
            foundToolCall = tc;
            break;
          }
        }
      }

      expect(foundToolCall).toBeDefined();
      expect(foundToolCall?.toolCallId).toBe('call_weather');
      expect(foundToolCall?.toolName).toBe('getWeather');
      expect(foundToolCall?.input).toEqual({ location: 'New York' });

      // Find the tool result in model messages
      let foundToolResult: AIV5.ToolResultPart | undefined;
      for (const msg of modelMessages) {
        if (msg.role === 'tool' && Array.isArray(msg.content)) {
          const tr = msg.content.find(part => part.type === 'tool-result') as AIV5.ToolResultPart | undefined;
          if (tr?.toolCallId === 'call_weather') {
            foundToolResult = tr;
            break;
          }
        }
      }

      expect(foundToolResult).toBeDefined();
      expect(foundToolResult?.toolCallId).toBe('call_weather');
    });
  });
});
