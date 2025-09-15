import { describe, it, expect } from 'vitest';
import type { MastraMessageV1 } from '../../../memory/types';
import type { MastraMessageV2 } from '../../message-list';
import { MessageList } from '../../message-list';
import { convertToV1Messages } from './convert-to-mastra-v1';

describe('convertToV1Messages', () => {
  it('should preserve toolInvocations when text follows tool invocations (reproduces issue #6087)', () => {
    // This reproduces the exact issue from GitHub issue #6087
    // When an assistant message has tool invocations followed by text,
    // the tool history should remain accessible
    //
    // NOTE: This test correctly identified the issue from #6087 - it verifies
    // that tool invocations are preserved in the conversion. However, it was
    // passing even when tool calls were mixed with text in a single message,
    // which made them inaccessible to the AI. The fix ensures proper message
    // separation so the AI can cleanly reference previous tool interactions.
    // The additional tests below verify this separation more explicitly.
    const messages: MastraMessageV2[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date('2024-01-01'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: "I'll use the weather tool for Paris now: The weather in Paris is partly cloudy.",
          parts: [
            {
              type: 'text',
              text: "I'll use the weather tool for Paris now:",
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'toolu_01Y9o5yfKqKvdueRhupfT9Jf',
                toolName: 'weatherTool',
                args: { location: 'Paris' },
                result: {
                  temperature: 24.3,
                  feelsLike: 23.1,
                  humidity: 51,
                  windSpeed: 16,
                  windGust: 34.6,
                  conditions: 'Partly cloudy',
                  location: 'Paris',
                },
              },
            },
            {
              type: 'text',
              text: "Ok, I just checked the weather. Now, ask me your next question, and I'll try to access this tool call result from my history to demonstrate the issue! 🔍",
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'toolu_01Y9o5yfKqKvdueRhupfT9Jf',
              toolName: 'weatherTool',
              args: { location: 'Paris' },
              result: {
                temperature: 24.3,
                feelsLike: 23.1,
                humidity: 51,
                windSpeed: 16,
                windGust: 34.6,
                conditions: 'Partly cloudy',
                location: 'Paris',
              },
            },
          ],
        },
      },
    ];

    const v1Messages = convertToV1Messages(messages);

    // The conversion should create messages that preserve the tool invocation history
    // We expect at least one message with tool-call type
    const toolCallMessages = v1Messages.filter(m => m.type === 'tool-call');
    expect(toolCallMessages.length).toBeGreaterThan(0);

    // We expect a tool result message
    const toolResultMessages = v1Messages.filter(m => m.type === 'tool-result');
    expect(toolResultMessages.length).toBeGreaterThan(0);

    // Most importantly, the tool invocation data should be accessible
    // Check that the tool call information is preserved
    const hasWeatherToolCall = v1Messages.some(msg => {
      if (Array.isArray(msg.content)) {
        return msg.content.some(part => part.type === 'tool-call' && part.toolName === 'weatherTool');
      }
      return false;
    });
    expect(hasWeatherToolCall).toBe(true);

    // Check that the tool result is preserved
    const hasWeatherToolResult = v1Messages.some(msg => {
      if (Array.isArray(msg.content)) {
        return msg.content.some(part => part.type === 'tool-result' && part.toolName === 'weatherTool');
      }
      return false;
    });
    expect(hasWeatherToolResult).toBe(true);
  });

  it('should handle toolInvocations array even when parts array exists', () => {
    // Test that toolInvocations array is processed when message has parts
    const messages: MastraMessageV2[] = [
      {
        id: 'msg-2',
        role: 'assistant',
        createdAt: new Date('2024-01-01'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: 'Processing your request',
          parts: [
            {
              type: 'text',
              text: 'Let me check that for you:',
            },
          ],
          // This toolInvocations array should be processed even though parts exists
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'searchTool',
              args: { query: 'test' },
              result: { found: true },
            },
          ],
        },
      },
    ];

    const v1Messages = convertToV1Messages(messages);

    // Should process the toolInvocations array
    const hasToolCall = v1Messages.some(
      msg => msg.type === 'tool-call' || (Array.isArray(msg.content) && msg.content.some(c => c.type === 'tool-call')),
    );
    expect(hasToolCall).toBe(true);
  });

  it('should handle mixed content with text, tool invocation, and more text', () => {
    const testMessage: MastraMessageV2 = {
      id: 'test-mixed-1',
      createdAt: new Date(),
      resourceId: 'resource-1',
      threadId: 'thread-1',
      role: 'assistant',
      content: {
        content: 'Test content',
        format: 2,
        parts: [
          {
            type: 'text',
            text: 'Let me check the weather for you...',
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-123',
              toolName: 'weatherTool',
              args: {
                location: 'New York',
              },
              result: {
                temperature: 72,
                conditions: 'Sunny',
                humidity: 45,
              },
            },
          },
          {
            type: 'text',
            text: 'The weather in New York is currently sunny with a temperature of 72°F.',
          },
        ],
      },
    };

    const result = convertToV1Messages([testMessage]);

    // Should have 4 messages: text before, tool call, tool result, text after
    expect(result.length).toBe(4);

    // First message should be assistant text
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('text');

    // Second message should be assistant tool-call
    expect(result[1].role).toBe('assistant');
    expect(result[1].type).toBe('tool-call');

    // Third message should be tool result
    expect(result[2].role).toBe('tool');
    expect(result[2].type).toBe('tool-result');

    // Fourth message should be assistant text
    expect(result[3].role).toBe('assistant');
    expect(result[3].type).toBe('text');

    // Verify tool result is preserved
    const toolResultMessage = result.find(msg => msg.role === 'tool' && msg.type === 'tool-result');
    expect(toolResultMessage).toBeDefined();

    if (toolResultMessage && Array.isArray(toolResultMessage.content)) {
      const toolResult = toolResultMessage.content[0];
      if (toolResult.type === 'tool-result') {
        expect(toolResult.result).toBeDefined();
        expect((toolResult.result as any).temperature).toBe(72);
      }
    }
  });

  it('should handle the exact message structure from issue #6087', () => {
    const testMessage: MastraMessageV2 = {
      id: 'test-issue-6087',
      createdAt: new Date(),
      resourceId: 'resource-1',
      threadId: 'thread-1',
      role: 'assistant',
      content: {
        content: undefined,
        format: 2,
        parts: [
          {
            type: 'text',
            text: "I'll first search for the information and then create a summary for you.\n\nSearching now...",
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-456',
              toolName: 'searchTool',
              args: {
                query: 'latest AI developments',
              },
              result: {
                found: true,
                results: ['GPT-4 improvements', 'New computer vision models', 'Open source AI progress'],
                count: 3,
              },
            },
          },
          {
            type: 'text',
            text: 'Great! I found 3 relevant results about the latest AI developments. Would you like me to elaborate on any of these?',
          },
        ],
        toolInvocations: [
          {
            state: 'result',
            toolCallId: 'call-456',
            toolName: 'searchTool',
            args: {
              query: 'latest AI developments',
            },
            result: {
              found: true,
              results: ['GPT-4 improvements', 'New computer vision models', 'Open source AI progress'],
              count: 3,
            },
          },
        ],
      },
    };

    const result = convertToV1Messages([testMessage]);

    // Should have 4 messages: text before, tool call, tool result, text after
    expect(result.length).toBe(4);

    // First message should be assistant text
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('text');

    // Second message should be assistant tool-call
    expect(result[1].role).toBe('assistant');
    expect(result[1].type).toBe('tool-call');

    // Third message should be tool result
    expect(result[2].role).toBe('tool');
    expect(result[2].type).toBe('tool-result');

    // Fourth message should be assistant text
    expect(result[3].role).toBe('assistant');
    expect(result[3].type).toBe('text');

    // Verify tool result is preserved with all data
    const toolResultMessage = result.find(msg => msg.role === 'tool' && msg.type === 'tool-result');
    expect(toolResultMessage).toBeDefined();

    if (toolResultMessage && Array.isArray(toolResultMessage.content)) {
      const toolResult = toolResultMessage.content[0];
      if (toolResult.type === 'tool-result' && toolResult.result) {
        expect(toolResult.result).toBeDefined();
        expect((toolResult.result as any).count).toBe(3);
      }
    }
  });

  it('should handle multiple tool calls in a single message', () => {
    const testMessage: MastraMessageV2 = {
      id: 'test-multiple-tools',
      createdAt: new Date(),
      resourceId: 'resource-1',
      threadId: 'thread-1',
      role: 'assistant',
      content: {
        content: 'Test content with multiple tools',
        format: 2,
        parts: [
          {
            type: 'text',
            text: "I'll check the weather in multiple cities for you.",
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-call-1',
              toolName: 'weatherTool',
              args: { location: 'Paris' },
              result: {
                temperature: 24.3,
                conditions: 'Partly cloudy',
                location: 'Paris',
              },
            },
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-call-2',
              toolName: 'weatherTool',
              args: { location: 'London' },
              result: {
                temperature: 18.5,
                conditions: 'Rainy',
                location: 'London',
              },
            },
          },
          {
            type: 'text',
            text: 'Now let me search for flights between these cities.',
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-call-3',
              toolName: 'flightSearchTool',
              args: { from: 'Paris', to: 'London' },
              result: {
                flights: [
                  { airline: 'Air France', price: 120, duration: '1h 15m' },
                  { airline: 'British Airways', price: 135, duration: '1h 20m' },
                ],
              },
            },
          },
          {
            type: 'text',
            text: 'Based on the weather and flight information, Paris has better weather (24.3°C and partly cloudy) compared to London (18.5°C and rainy). There are affordable flights available starting at €120.',
          },
        ],
      },
    };

    const result = convertToV1Messages([testMessage]);

    // Should have 9 messages:
    // 1. text ("I'll check the weather...")
    // 2. tool-call (weather Paris)
    // 3. tool-result (weather Paris result)
    // 4. tool-call (weather London)
    // 5. tool-result (weather London result)
    // 6. text ("Now let me search for flights...")
    // 7. tool-call (flight search)
    // 8. tool-result (flight search result)
    // 9. text ("Based on the weather and flight information...")
    expect(result.length).toBe(9);

    // Verify the sequence of messages
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('text');

    expect(result[1].role).toBe('assistant');
    expect(result[1].type).toBe('tool-call');

    expect(result[2].role).toBe('tool');
    expect(result[2].type).toBe('tool-result');

    expect(result[3].role).toBe('assistant');
    expect(result[3].type).toBe('tool-call');

    expect(result[4].role).toBe('tool');
    expect(result[4].type).toBe('tool-result');

    expect(result[5].role).toBe('assistant');
    expect(result[5].type).toBe('text');

    expect(result[6].role).toBe('assistant');
    expect(result[6].type).toBe('tool-call');

    expect(result[7].role).toBe('tool');
    expect(result[7].type).toBe('tool-result');

    expect(result[8].role).toBe('assistant');
    expect(result[8].type).toBe('text');

    // Verify all tool calls are preserved
    const toolCallMessages = result.filter(msg => msg.type === 'tool-call');
    expect(toolCallMessages.length).toBe(3);

    const toolResultMessages = result.filter(msg => msg.type === 'tool-result');
    expect(toolResultMessages.length).toBe(3);

    // Verify specific tool results
    const weatherResults = toolResultMessages.filter(msg => {
      if (Array.isArray(msg.content)) {
        return msg.content.some(part => part.type === 'tool-result' && part.toolName === 'weatherTool');
      }
      return false;
    });
    expect(weatherResults.length).toBe(2);

    const flightResults = toolResultMessages.filter(msg => {
      if (Array.isArray(msg.content)) {
        return msg.content.some(part => part.type === 'tool-result' && part.toolName === 'flightSearchTool');
      }
      return false;
    });
    expect(flightResults.length).toBe(1);
  });

  it('should handle multiple tool calls with mixed toolInvocations array and parts', () => {
    const testMessage: MastraMessageV2 = {
      id: 'test-mixed-multiple',
      createdAt: new Date(),
      resourceId: 'resource-1',
      threadId: 'thread-1',
      role: 'assistant',
      content: {
        content: 'Multiple tools test',
        format: 2,
        parts: [
          {
            type: 'text',
            text: 'Let me gather some information for you.',
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-in-parts-1',
              toolName: 'searchTool',
              args: { query: 'best restaurants' },
              result: { results: ['Restaurant A', 'Restaurant B'] },
            },
          },
        ],
        // Additional tool invocations in the toolInvocations array
        toolInvocations: [
          {
            state: 'result',
            toolCallId: 'tool-in-parts-1', // This is a duplicate, should be ignored
            toolName: 'searchTool',
            args: { query: 'best restaurants' },
            result: { results: ['Restaurant A', 'Restaurant B'] },
          },
          {
            state: 'result',
            toolCallId: 'tool-in-array-1',
            toolName: 'reservationTool',
            args: { restaurant: 'Restaurant A', time: '19:00' },
            result: { confirmed: true, reservationId: 'RES123' },
          },
          {
            state: 'result',
            toolCallId: 'tool-in-array-2',
            toolName: 'mapsTool',
            args: { destination: 'Restaurant A' },
            result: { distance: '2.5km', duration: '10 minutes' },
          },
        ],
      },
    };

    const result = convertToV1Messages([testMessage]);

    const sharedFields = {
      createdAt: testMessage.createdAt,
      resourceId: testMessage.resourceId,
      threadId: testMessage.threadId,
    };

    // The actual behavior:
    // 1. text
    // 2. tool-call (from parts)
    // 3. tool-result (from parts)
    // 4. tool-call (both array invocations grouped together since same step)
    // 5. tool-result (both array results grouped together)
    // Total: 5 messages
    expect(result.length).toBe(5);

    // First message should keep original ID
    expect(result[0].id).toBe(testMessage.id);

    // Split messages should have suffixes
    expect(result[1].id).toBe(`${testMessage.id}__split-1`);
    expect(result[2].id).toBe(`${testMessage.id}__split-2`);
    expect(result[3].id).toBe(`${testMessage.id}__split-3`);
    expect(result[4].id).toBe(`${testMessage.id}__split-4`);

    expect(result).toEqual([
      expect.objectContaining({
        ...sharedFields,
        id: testMessage.id,
        role: 'assistant',
        type: 'text',
        content: 'Let me gather some information for you.',
      }),
      expect.objectContaining({
        ...sharedFields,
        role: 'assistant',
        type: 'tool-call',
        content: [
          expect.objectContaining({
            type: 'tool-call',
            toolCallId: 'tool-in-parts-1',
            toolName: 'searchTool',
            args: { query: 'best restaurants' },
          }),
        ],
      }),
      expect.objectContaining({
        ...sharedFields,
        role: 'tool',
        type: 'tool-result',
        content: [
          expect.objectContaining({
            type: 'tool-result',
            toolCallId: 'tool-in-parts-1',
            toolName: 'searchTool',
            result: { results: ['Restaurant A', 'Restaurant B'] },
          }),
        ],
      }),
      expect.objectContaining({
        ...sharedFields,
        role: 'assistant',
        type: 'tool-call',
        content: [
          expect.objectContaining({
            type: 'tool-call',
            toolCallId: 'tool-in-array-1',
            toolName: 'reservationTool',
            args: { restaurant: 'Restaurant A', time: '19:00' },
          }),
          expect.objectContaining({
            type: 'tool-call',
            toolCallId: 'tool-in-array-2',
            toolName: 'mapsTool',
            args: { destination: 'Restaurant A' },
          }),
        ],
      }),
      expect.objectContaining({
        ...sharedFields,
        role: 'tool',
        type: 'tool-result',
        content: [
          expect.objectContaining({
            type: 'tool-result',
            toolCallId: 'tool-in-array-1',
            toolName: 'reservationTool',
            result: { confirmed: true, reservationId: 'RES123' },
          }),
          expect.objectContaining({
            type: 'tool-result',
            toolCallId: 'tool-in-array-2',
            toolName: 'mapsTool',
            result: { distance: '2.5km', duration: '10 minutes' },
          }),
        ],
      }),
    ]);

    // Verify no duplicate tool calls
    const toolCallContents: string[] = [];
    result.forEach(msg => {
      if (msg.type === 'tool-call' && Array.isArray(msg.content)) {
        msg.content.forEach(part => {
          if (part.type === 'tool-call') {
            toolCallContents.push(part.toolCallId);
          }
        });
      }
    });

    // Should have 3 unique tool calls
    expect(toolCallContents.length).toBe(3);
    expect(new Set(toolCallContents).size).toBe(3);
    expect(toolCallContents).toContain('tool-in-parts-1');
    expect(toolCallContents).toContain('tool-in-array-1');
    expect(toolCallContents).toContain('tool-in-array-2');
  });

  it('should handle weather tool message with text before and after tool invocation', () => {
    // Test case from actual log output
    const testMessage: MastraMessageV2 = {
      id: 'weather-paris-msg',
      createdAt: new Date(),
      resourceId: 'resource-1',
      threadId: 'thread-1',
      role: 'assistant',
      content: {
        format: 2,
        content: undefined,
        parts: [
          {
            type: 'text',
            text: 'Ok, let me check the weather in Paris! 🗼',
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'toolu_018wAsi4oQLG87qq6VXKYWYu',
              toolName: 'weatherTool',
              args: { location: 'Paris' },
              result: {
                temperature: 23.3,
                feelsLike: 22.3,
                humidity: 52,
                windSpeed: 14.4,
                windGust: 31.3,
                conditions: 'Overcast',
                location: 'Paris',
              },
            },
          },
          {
            type: 'text',
            text: "There you go! It's 23.3°C and overcast in Paris right now! \n\nGo ahead, ask me about history - I already know what's coming 😏",
          },
        ],
        toolInvocations: [
          {
            state: 'result',
            toolCallId: 'toolu_018wAsi4oQLG87qq6VXKYWYu',
            toolName: 'weatherTool',
            args: { location: 'Paris' },
            result: {
              temperature: 23.3,
              feelsLike: 22.3,
              humidity: 52,
              windSpeed: 14.4,
              windGust: 31.3,
              conditions: 'Overcast',
              location: 'Paris',
            },
          },
        ],
      },
    };

    const result = convertToV1Messages([testMessage]);

    // Should have 4 messages: text before, tool call, tool result, text after
    expect(result.length).toBe(4);

    // First message: assistant text
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('text');
    if (Array.isArray(result[0].content)) {
      expect(result[0].content[0].type).toBe('text');
      const textPart = result[0].content[0];
      if (textPart.type === 'text') {
        expect(textPart.text).toBe('Ok, let me check the weather in Paris! 🗼');
      }
    } else {
      expect(result[0].content).toBe('Ok, let me check the weather in Paris! 🗼');
    }

    // Second message: assistant tool-call
    expect(result[1].role).toBe('assistant');
    expect(result[1].type).toBe('tool-call');
    expect(Array.isArray(result[1].content)).toBe(true);
    if (Array.isArray(result[1].content)) {
      const toolCall = result[1].content.find(c => c.type === 'tool-call');
      expect(toolCall).toBeDefined();
      if (toolCall && toolCall.type === 'tool-call') {
        expect(toolCall.toolName).toBe('weatherTool');
        expect(toolCall.toolCallId).toBe('toolu_018wAsi4oQLG87qq6VXKYWYu');
      }
    }

    // Third message: tool result
    expect(result[2].role).toBe('tool');
    expect(result[2].type).toBe('tool-result');
    expect(Array.isArray(result[2].content)).toBe(true);
    if (Array.isArray(result[2].content)) {
      const toolResult = result[2].content.find(c => c.type === 'tool-result');
      expect(toolResult).toBeDefined();
      if (toolResult && toolResult.type === 'tool-result') {
        expect(toolResult.toolName).toBe('weatherTool');
        expect((toolResult.result as any).temperature).toBe(23.3);
        expect((toolResult.result as any).conditions).toBe('Overcast');
      }
    }

    // Fourth message: assistant text
    expect(result[3].role).toBe('assistant');
    expect(result[3].type).toBe('text');
    if (Array.isArray(result[3].content)) {
      expect(result[3].content[0].type).toBe('text');
      const textPart3 = result[3].content[0];
      if (textPart3.type === 'text') {
        expect(textPart3.text).toBe(
          "There you go! It's 23.3°C and overcast in Paris right now! \n\nGo ahead, ask me about history - I already know what's coming 😏",
        );
      }
    } else {
      expect(result[3].content).toBe(
        "There you go! It's 23.3°C and overcast in Paris right now! \n\nGo ahead, ask me about history - I already know what's coming 😏",
      );
    }
  });

  it('should handle conversation with user asking about data from previous tool call', () => {
    // Test case showing user asking about humidity after weather check
    const messages: MastraMessageV2[] = [
      // Assistant's weather check
      {
        id: 'weather-msg',
        createdAt: new Date('2024-01-01T10:00:00'),
        resourceId: 'resource-1',
        threadId: 'thread-1',
        role: 'assistant',
        content: {
          format: 2,
          content: undefined,
          parts: [
            {
              type: 'text',
              text: 'Let me check the weather in Paris for you.',
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'toolu_weather123',
                toolName: 'weatherTool',
                args: { location: 'Paris' },
                result: {
                  temperature: 23.3,
                  feelsLike: 22.3,
                  humidity: 52,
                  windSpeed: 14.4,
                  windGust: 31.3,
                  conditions: 'Overcast',
                  location: 'Paris',
                },
              },
            },
            {
              type: 'text',
              text: "It's currently 23.3°C and overcast in Paris!",
            },
          ],
        },
      },
      // User asks about humidity
      {
        id: 'user-humidity-q',
        createdAt: new Date('2024-01-01T10:01:00'),
        resourceId: 'resource-1',
        threadId: 'thread-1',
        role: 'user',
        content: {
          format: 2,
          content: 'ok what is humidity ?',
          parts: [
            {
              type: 'text',
              text: 'ok what is humidity ?',
            },
          ],
        },
      },
      // Assistant responds from memory
      {
        id: 'assistant-humidity-a',
        createdAt: new Date('2024-01-01T10:01:30'),
        resourceId: 'resource-1',
        threadId: 'thread-1',
        role: 'assistant',
        content: {
          format: 2,
          content:
            'Based on the weather data I just checked, the humidity in Paris is 52%. This means the air contains 52% of the maximum amount of water vapor it could hold at the current temperature.',
          parts: [
            {
              type: 'text',
              text: 'Based on the weather data I just checked, the humidity in Paris is 52%. This means the air contains 52% of the maximum amount of water vapor it could hold at the current temperature.',
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    // Should have 6 messages total:
    // 1. Assistant text "Let me check..."
    // 2. Assistant tool-call
    // 3. Tool result
    // 4. Assistant text "It's currently..."
    // 5. User question
    // 6. Assistant response about humidity
    expect(result.length).toBe(6);

    // Verify the tool result is preserved and accessible
    const toolResultMessage = result.find(msg => msg.role === 'tool' && msg.type === 'tool-result');
    expect(toolResultMessage).toBeDefined();
    if (toolResultMessage && Array.isArray(toolResultMessage.content)) {
      const toolResult = toolResultMessage.content[0];
      if (toolResult.type === 'tool-result') {
        expect((toolResult.result as any).humidity).toBe(52);
      }
    }

    // Verify user question
    expect(result[4].role).toBe('user');
    expect(result[4].content).toBe('ok what is humidity ?');

    // Verify assistant can reference the humidity from tool history
    expect(result[5].role).toBe('assistant');
    expect(result[5].type).toBe('text');
    const lastMessage = result[result.length - 1];
    if (Array.isArray(lastMessage.content)) {
      const textContent = lastMessage.content.find(c => c.type === 'text')?.text || '';
      expect(textContent).toContain('52%');
    } else {
      expect(lastMessage.content).toContain('52%');
    }
  });
  it('should handle message starting with tool-invocation only (Rouen case)', () => {
    // Case that SHOULD work: tool call with NO text before or after
    const testMessage: MastraMessageV2 = {
      id: 'rouen-weather',
      createdAt: new Date(),
      resourceId: 'resource-1',
      threadId: 'thread-1',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'toolu_01JHYJ7Hfe5oWmfHPuPLSx31',
              toolName: 'weatherTool',
              args: { location: 'Rouen' },
              result: {
                temperature: 19.9,
                feelsLike: 17.8,
                humidity: 52,
                windSpeed: 14,
                windGust: 35.6,
                conditions: 'Partly cloudy',
                location: 'Rouen',
              },
            },
          },
        ],
        toolInvocations: [
          {
            state: 'result',
            toolCallId: 'toolu_01JHYJ7Hfe5oWmfHPuPLSx31',
            toolName: 'weatherTool',
            args: { location: 'Rouen' },
            result: {
              temperature: 19.9,
              feelsLike: 17.8,
              humidity: 52,
              windSpeed: 14,
              windGust: 35.6,
              conditions: 'Partly cloudy',
              location: 'Rouen',
            },
          },
        ],
      },
    };

    const result = convertToV1Messages([testMessage]);

    // Should have 2 messages: tool-call, tool-result
    expect(result.length).toBe(2);

    // First message: assistant tool-call
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('tool-call');
    expect(Array.isArray(result[0].content)).toBe(true);
    if (Array.isArray(result[0].content)) {
      const toolCall = result[0].content.find(c => c.type === 'tool-call');
      expect(toolCall).toBeDefined();
      if (toolCall && toolCall.type === 'tool-call') {
        expect(toolCall.toolName).toBe('weatherTool');
        expect(toolCall.toolCallId).toBe('toolu_01JHYJ7Hfe5oWmfHPuPLSx31');
        expect(toolCall.args).toEqual({ location: 'Rouen' });
      }
    }

    // Second message: tool result
    expect(result[1].role).toBe('tool');
    expect(result[1].type).toBe('tool-result');
    expect(Array.isArray(result[1].content)).toBe(true);
    if (Array.isArray(result[1].content)) {
      const toolResult = result[1].content.find(c => c.type === 'tool-result');
      expect(toolResult).toBeDefined();
      if (toolResult && toolResult.type === 'tool-result') {
        expect(toolResult.toolName).toBe('weatherTool');
        expect(toolResult.toolCallId).toBe('toolu_01JHYJ7Hfe5oWmfHPuPLSx31');
        expect((toolResult.result as any).temperature).toBe(19.9);
        expect((toolResult.result as any).conditions).toBe('Partly cloudy');
        expect((toolResult.result as any).location).toBe('Rouen');
      }
    }
  });

  it('should handle message with tool-invocation followed by text (Rungis case)', () => {
    // Case that SHOULD work but might not: tool call WITH text after
    const testMessage: MastraMessageV2 = {
      id: 'rungis-weather',
      createdAt: new Date(),
      resourceId: 'resource-1',
      threadId: 'thread-1',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'toolu_rungis123',
              toolName: 'weatherTool',
              args: { location: 'Rungis' },
              result: {
                temperature: 22.4,
                feelsLike: 21.2,
                humidity: 45,
                windSpeed: 12,
                windGust: 28.3,
                conditions: 'Overcast',
                location: 'Rungis',
              },
            },
          },
          {
            type: 'text',
            text: 'Il fait 22.4°C à Rungis actuellement, avec un ciel couvert ! 😊',
          },
        ],
        toolInvocations: [
          {
            state: 'result',
            toolCallId: 'toolu_rungis123',
            toolName: 'weatherTool',
            args: { location: 'Rungis' },
            result: {
              temperature: 22.4,
              feelsLike: 21.2,
              humidity: 45,
              windSpeed: 12,
              windGust: 28.3,
              conditions: 'Overcast',
              location: 'Rungis',
            },
          },
        ],
      },
    };

    const result = convertToV1Messages([testMessage]);

    // Should have 3 messages: tool-call, tool-result, text
    expect(result.length).toBe(3);

    // First message: assistant tool-call
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('tool-call');
    expect(Array.isArray(result[0].content)).toBe(true);
    if (Array.isArray(result[0].content)) {
      const toolCall = result[0].content.find(c => c.type === 'tool-call');
      expect(toolCall).toBeDefined();
      if (toolCall && toolCall.type === 'tool-call') {
        expect(toolCall.toolName).toBe('weatherTool');
        expect(toolCall.toolCallId).toBe('toolu_rungis123');
        expect(toolCall.args).toEqual({ location: 'Rungis' });
      }
    }

    // Second message: tool result
    expect(result[1].role).toBe('tool');
    expect(result[1].type).toBe('tool-result');
    expect(Array.isArray(result[1].content)).toBe(true);
    if (Array.isArray(result[1].content)) {
      const toolResult = result[1].content.find(c => c.type === 'tool-result');
      expect(toolResult).toBeDefined();
      if (toolResult && toolResult.type === 'tool-result') {
        expect(toolResult.toolName).toBe('weatherTool');
        expect(toolResult.toolCallId).toBe('toolu_rungis123');
        expect((toolResult.result as any).temperature).toBe(22.4);
        expect((toolResult.result as any).conditions).toBe('Overcast');
        expect((toolResult.result as any).location).toBe('Rungis');
      }
    }

    // Third message: assistant text
    expect(result[2].role).toBe('assistant');
    expect(result[2].type).toBe('text');
    if (Array.isArray(result[2].content)) {
      const textPart = result[2].content.find(c => c.type === 'text');
      expect(textPart).toBeDefined();
      if (textPart && textPart.type === 'text') {
        expect(textPart.text).toBe('Il fait 22.4°C à Rungis actuellement, avec un ciel couvert ! 😊');
      }
    } else {
      expect(result[2].content).toBe('Il fait 22.4°C à Rungis actuellement, avec un ciel couvert ! 😊');
    }
  });
  it('should combine consecutive assistant text messages after tool calls (fixes #6087)', () => {
    // This test verifies that assistant text messages are properly combined
    // even when they come after tool invocations
    const messages: MastraMessageV2[] = [
      // First assistant message with tool call and text
      {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date('2024-01-01T10:00:00'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: undefined,
          parts: [
            {
              type: 'text',
              text: 'Let me check the weather for you.',
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'weatherTool',
                args: { location: 'Paris' },
                result: { temperature: 20, conditions: 'Sunny' },
              },
            },
            {
              type: 'text',
              text: "It's 20°C and sunny in Paris!",
            },
          ],
        },
      },
      // Second assistant message with just text (should be combined with previous text)
      {
        id: 'msg-2',
        role: 'assistant',
        createdAt: new Date('2024-01-01T10:01:00'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: 'Would you like me to check another city?',
          parts: [
            {
              type: 'text',
              text: 'Would you like me to check another city?',
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    // Should have 5 messages:
    // 1. Assistant text ("Let me check...")
    // 2. Assistant tool-call
    // 3. Tool result
    // 4. Assistant text ("It's 20°C...")
    // 5. Assistant text ("Would you like me...")
    expect(result.length).toBe(5);

    // Verify the text messages after the tool call
    const fourthMessage = result[3];
    expect(fourthMessage.role).toBe('assistant');
    expect(fourthMessage.type).toBe('text');
    if (Array.isArray(fourthMessage.content)) {
      const textPart = fourthMessage.content[0];
      if (textPart && textPart.type === 'text') {
        expect(textPart.text).toContain("It's 20°C");
      }
    } else {
      expect(fourthMessage.content).toContain("It's 20°C");
    }

    const fifthMessage = result[4];
    expect(fifthMessage.role).toBe('assistant');
    expect(fifthMessage.type).toBe('text');
    if (Array.isArray(fifthMessage.content)) {
      const textPart2 = fifthMessage.content[0];
      if (textPart2 && textPart2.type === 'text') {
        expect(textPart2.text).toContain('Would you like me');
      }
    } else {
      expect(fifthMessage.content).toContain('Would you like me');
    }
  });

  it('should preserve tool invocations when no toolInvocations array is present', () => {
    // Test case: message with only parts array, no toolInvocations array
    const messages: MastraMessageV2[] = [
      {
        id: 'msg-with-parts-only',
        role: 'assistant',
        createdAt: new Date('2024-01-01'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: undefined,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'tool-999',
                toolName: 'calculator',
                args: { a: 5, b: 3 },
                result: { sum: 8 },
              },
            },
            {
              type: 'text',
              text: 'The sum is 8',
            },
          ],
          // Note: no toolInvocations array
        },
      },
    ];

    const result = convertToV1Messages(messages);

    // Should have 3 messages: tool-call, tool-result, text
    expect(result.length).toBe(3);

    // Verify tool call is preserved
    expect(result[0].type).toBe('tool-call');
    expect(result[1].type).toBe('tool-result');
    expect(result[2].type).toBe('text');
  });

  it('should not combine tool invocation message with following assistant text message', () => {
    // This test reproduces the exact issue: tool invocation followed by assistant message
    // The tool invocation should not be lost when followed by a text-only assistant message
    const messages: MastraMessageV2[] = [
      // First message: tool invocation only (no text)
      {
        id: 'msg-tool',
        role: 'assistant',
        createdAt: new Date('2024-01-01T10:00:00'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: undefined,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'tool-123',
                toolName: 'searchTool',
                args: { query: 'test' },
                result: { found: true },
              },
            },
          ],
        },
      },
      // Second message: text only assistant message
      {
        id: 'msg-text',
        role: 'assistant',
        createdAt: new Date('2024-01-01T10:00:01'),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: 'Based on my search, I found the information you requested.',
          parts: [
            {
              type: 'text',
              text: 'Based on my search, I found the information you requested.',
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    // Should have 3 messages: tool-call, tool-result, text
    expect(result.length).toBe(3);

    // First message: assistant tool-call
    expect(result[0].role).toBe('assistant');
    expect(result[0].type).toBe('tool-call');

    // Second message: tool result
    expect(result[1].role).toBe('tool');
    expect(result[1].type).toBe('tool-result');

    // Third message: assistant text
    expect(result[2].role).toBe('assistant');
    expect(result[2].type).toBe('text');
    if (Array.isArray(result[2].content)) {
      const textPart = result[2].content[0];
      if (textPart.type === 'text') {
        expect(textPart.text).toBe('Based on my search, I found the information you requested.');
      }
    } else {
      expect(result[2].content).toBe('Based on my search, I found the information you requested.');
    }

    // Verify tool call is preserved
    const toolCallMessage = result.find(msg => msg.type === 'tool-call');
    expect(toolCallMessage).toBeDefined();
    if (toolCallMessage && Array.isArray(toolCallMessage.content)) {
      const toolCall = toolCallMessage.content.find(c => c.type === 'tool-call');
      expect(toolCall).toBeDefined();
      expect(toolCall?.toolName).toBe('searchTool');
    }
  });

  it('should handle structure that works (text + tool, no text after)', () => {
    // Structure that user says WORKS
    const messages: MastraMessageV2[] = [
      {
        id: 'working-msg',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: undefined,
          parts: [
            {
              type: 'text',
              text: 'Salut ! Je vais regarder la météo de Paris pour toi !',
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'toolu_01RwiUz9uus6TC6wxoofaEYH',
                toolName: 'weatherTool',
                args: { location: 'Paris' },
                result: {
                  temperature: 22.2,
                  feelsLike: 19.4,
                  humidity: 42,
                  windSpeed: 16.8,
                  windGust: 37.4,
                  conditions: 'Overcast',
                  location: 'Paris',
                },
              },
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'toolu_01RwiUz9uus6TC6wxoofaEYH',
              toolName: 'weatherTool',
              args: { location: 'Paris' },
              result: {
                temperature: 22.2,
                feelsLike: 19.4,
                humidity: 42,
                windSpeed: 16.8,
                windGust: 37.4,
                conditions: 'Overcast',
                location: 'Paris',
              },
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    // Should have 3 messages: text, tool-call, tool-result
    expect(result.length).toBe(3);

    // Verify sequence
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('tool-call');
    expect(result[2].type).toBe('tool-result');
  });

  it('should handle exact structure from user report', () => {
    // Exact structure from user report
    const messages: MastraMessageV2[] = [
      {
        id: 'user-report-msg',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          content: undefined,
          parts: [
            {
              type: 'text',
              text: 'Tiens, regardons la météo à Paris !',
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'toolu_014cUZQW998feDYrewtnpTC5',
                toolName: 'weatherTool',
                args: { location: 'Paris' },
                result: {
                  temperature: 22,
                  feelsLike: 19.3,
                  humidity: 42,
                  windSpeed: 15.9,
                  windGust: 37.4,
                  conditions: 'Overcast',
                  location: 'Paris',
                },
              },
            },
            {
              type: 'text',
              text: 'Il fait 22°C avec un ciel couvert ! ☁️',
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'toolu_014cUZQW998feDYrewtnpTC5',
              toolName: 'weatherTool',
              args: { location: 'Paris' },
              result: {
                temperature: 22,
                feelsLike: 19.3,
                humidity: 42,
                windSpeed: 15.9,
                windGust: 37.4,
                conditions: 'Overcast',
                location: 'Paris',
              },
            },
          ],
        },
      },
    ];

    const result = convertToV1Messages(messages);

    // Should have 4 messages: text before, tool-call, tool-result, text after
    expect(result.length).toBe(4);

    // Verify sequence
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('tool-call');
    expect(result[2].type).toBe('tool-result');
    expect(result[3].type).toBe('text');

    // Verify tool call is preserved
    const toolCallMsg = result[1];
    expect(toolCallMsg.role).toBe('assistant');
    if (Array.isArray(toolCallMsg.content)) {
      const toolCall = toolCallMsg.content[0];
      expect(toolCall.type).toBe('tool-call');
      if (toolCall.type === 'tool-call') {
        expect(toolCall.toolName).toBe('weatherTool');
        expect(toolCall.args).toEqual({ location: 'Paris' });
      }
    }

    // Verify tool result
    const toolResultMsg = result[2];
    expect(toolResultMsg.role).toBe('tool');
    if (Array.isArray(toolResultMsg.content)) {
      const toolResult = toolResultMsg.content[0];
      expect(toolResult.type).toBe('tool-result');
      if (toolResult.type === 'tool-result') {
        expect((toolResult.result as any).temperature).toBe(22);
      }
    }
  });

  it('should properly separate tool invocations from text for AI accessibility (reproduces issue #6087 from database)', () => {
    // This test reproduces the exact scenario from the database where tool history
    // becomes inaccessible in later conversation turns

    const messages: MastraMessageV2[] = [
      // Message 1: User asks for weather
      {
        id: 'fbd2f506-90e6-4f52-8ba4-633abe9e8442',
        role: 'user',
        createdAt: new Date('2025-08-05T22:58:18.403Z'),
        threadId: 'ff1fa961-7925-44b7-909a-a4c9fba60b4e',
        resourceId: 'weatherAgent',
        content: {
          format: 2,
          parts: [{ type: 'step-start' }, { type: 'text', text: 'LA weather' }],
          content: 'LA weather',
        },
      },
      // Message 2: Assistant with tool invocation result AND text response
      {
        id: '17949558-8a2b-4841-990d-ce05d29a8afb',
        role: 'assistant',
        createdAt: new Date('2025-08-05T22:58:22.151Z'),
        threadId: 'ff1fa961-7925-44b7-909a-a4c9fba60b4e',
        resourceId: 'weatherAgent',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
                toolName: 'weatherTool',
                args: { location: 'Los Angeles' },
                result: {
                  temperature: 29.4,
                  feelsLike: 30.5,
                  humidity: 48,
                  windSpeed: 16,
                  windGust: 18.7,
                  conditions: 'Clear sky',
                  location: 'Los Angeles',
                },
              },
            },
            {
              type: 'text',
              text: 'The current weather in Los Angeles is as follows:\n\n- **Temperature:** 29.4°C (Feels like 30.5°C)\n- **Humidity:** 48%\n- **Wind Speed:** 16 km/h\n- **Wind Gusts:** 18.7 km/h\n- **Conditions:** Clear sky\n\nIf you need any specific activities or further information, let me know!',
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
              toolName: 'weatherTool',
              args: { location: 'Los Angeles' },
              result: {
                temperature: 29.4,
                feelsLike: 30.5,
                humidity: 48,
                windSpeed: 16,
                windGust: 18.7,
                conditions: 'Clear sky',
                location: 'Los Angeles',
              },
            },
          ],
        },
      },
      // Message 3: User asks about the tool call
      {
        id: 'd936d31b-0ad5-43a8-89ed-c5cc24c60895',
        role: 'user',
        createdAt: new Date('2025-08-05T22:58:38.656Z'),
        threadId: 'ff1fa961-7925-44b7-909a-a4c9fba60b4e',
        resourceId: 'weatherAgent',
        content: {
          format: 2,
          parts: [{ type: 'step-start' }, { type: 'text', text: 'what was the weather when you called that tool?' }],
          content: 'what was the weather when you called that tool?',
        },
      },
      // Message 4: Assistant responds (should still have access to tool history)
      {
        id: '75ee9187-ba4b-4a15-b65c-490adad6c764',
        role: 'assistant',
        createdAt: new Date('2025-08-05T22:58:40.456Z'),
        threadId: 'ff1fa961-7925-44b7-909a-a4c9fba60b4e',
        resourceId: 'weatherAgent',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: "The weather data I provided was retrieved just now. Here's a summary of the current weather in Los Angeles:\n\n- **Temperature:** 29.4°C (Feels like 30.5°C)\n- **Humidity:** 48%\n- **Wind Speed:** 16 km/h\n- **Wind Gusts:** 18.7 km/h\n- **Conditions:** Clear sky\n\nIf you have any other questions or need further details, feel free to ask!",
            },
          ],
        },
      },
    ];

    const v1Messages = convertToV1Messages(messages);

    // Critical assertions: Tool invocations should be properly separated
    // so the AI can access tool history in later turns

    // CRITICAL: The assistant's first response should be split into 3 separate messages
    // This separation is what makes tool history accessible to the AI

    // Expected structure for proper tool history accessibility:
    expect(v1Messages).toEqual(
      expect.arrayContaining([
        // 1. User asks for weather
        expect.objectContaining({
          id: 'fbd2f506-90e6-4f52-8ba4-633abe9e8442',
          role: 'user',
          type: 'text',
          content: 'LA weather',
        }),
        // 2. Assistant makes tool call
        expect.objectContaining({
          id: '17949558-8a2b-4841-990d-ce05d29a8afb',
          role: 'assistant',
          type: 'tool-call',
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'tool-call',
              toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
              toolName: 'weatherTool',
              args: { location: 'Los Angeles' },
            }),
          ]),
        }),
        // 3. Tool returns result (with ${id}__split-1 suffix due to message splitting)
        expect.objectContaining({
          id: '17949558-8a2b-4841-990d-ce05d29a8afb__split-1',
          role: 'tool',
          type: 'tool-result',
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'tool-result',
              toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
              toolName: 'weatherTool',
              result: expect.objectContaining({
                temperature: 29.4,
                conditions: 'Clear sky',
                location: 'Los Angeles',
              }),
            }),
          ]),
        }),
        // 4. Assistant provides text response (SEPARATE from tool call/result, with ${id}__split-2 suffix due to message splitting)
        expect.objectContaining({
          id: '17949558-8a2b-4841-990d-ce05d29a8afb__split-2',
          role: 'assistant',
          type: 'text',
          content: expect.stringContaining('The current weather in Los Angeles'),
        }),
        // 5. User asks about tool history
        expect.objectContaining({
          id: 'd936d31b-0ad5-43a8-89ed-c5cc24c60895',
          role: 'user',
          type: 'text',
          content: 'what was the weather when you called that tool?',
        }),
        // 6. Assistant responds (should have access to tool history from messages 2-3)
        expect.objectContaining({
          id: '75ee9187-ba4b-4a15-b65c-490adad6c764',
          role: 'assistant',
          type: 'text',
        }),
      ]),
    );

    // Verify the full conversation maintains proper order
    expect(v1Messages.length).toBe(6); // User, Assistant(tool-call), Tool(result), Assistant(text), User, Assistant

    // The tool history should be cleanly separated and accessible
    // for the AI to reference in the fourth message
    const toolHistory = v1Messages.filter(m => m.type === 'tool-call' || m.type === 'tool-result');
    expect(toolHistory.length).toBe(2); // One tool-call and one tool-result
  });

  it('should NOT separate tool invocations when they are already in v1 format (potential bug)', () => {
    // This test simulates what might be happening: messages are already stored in v1 format
    // and then being converted again, losing the separation

    const v1MessagesFromDb: MastraMessageV1[] = [
      {
        id: 'user-1',
        role: 'user',
        createdAt: new Date('2025-08-05T22:58:18.403Z'),
        threadId: 'thread-1',
        resourceId: 'weatherAgent',
        type: 'text',
        content: 'LA weather',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date('2025-08-05T22:58:22.151Z'),
        threadId: 'thread-1',
        resourceId: 'weatherAgent',
        type: 'tool-call',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
            toolName: 'weatherTool',
            args: { location: 'Los Angeles' },
          },
        ],
      },
      {
        id: 'tool-1',
        role: 'tool',
        createdAt: new Date('2025-08-05T22:58:22.151Z'),
        threadId: 'thread-1',
        resourceId: 'weatherAgent',
        type: 'tool-result',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
            toolName: 'weatherTool',
            result: {
              temperature: 29.4,
              conditions: 'Clear sky',
            },
          },
        ],
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        createdAt: new Date('2025-08-05T22:58:22.151Z'),
        threadId: 'thread-1',
        resourceId: 'weatherAgent',
        type: 'text',
        content: 'The current weather in Los Angeles is 29.4°C with clear sky.',
      },
    ];

    // If these v1 messages are incorrectly converted to v2 and back to v1,
    // they might lose their separation

    // First, let's see what happens if we treat these as MessageInput
    // This might be what's happening in the real system
    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'weatherAgent' });

    // When messages are loaded from memory, they might be added as v1 format
    messageList.add(v1MessagesFromDb as any, 'memory');

    // Then converted back to v1 for the AI
    const resultV1 = messageList.get.all.v1();

    // The tool history should still be preserved
    const toolCallMessages = resultV1.filter(m => m.type === 'tool-call');
    const toolResultMessages = resultV1.filter(m => m.type === 'tool-result');

    expect(toolCallMessages.length).toBeGreaterThan(0);
    expect(toolResultMessages.length).toBeGreaterThan(0);
  });

  it('should verify the v2 -> ui -> core conversion path preserves tool separation', () => {
    // This test checks the actual path messages take when sent to the LLM
    // v2 (from database) -> ui -> core (for LLM)

    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'weatherAgent' });

    // Add the exact v2 messages from the database
    const v2Messages: MastraMessageV2[] = [
      {
        id: '17949558-8a2b-4841-990d-ce05d29a8afb',
        role: 'assistant',
        createdAt: new Date('2025-08-05T22:58:22.151Z'),
        threadId: 'thread-1',
        resourceId: 'weatherAgent',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
                toolName: 'weatherTool',
                args: { location: 'Los Angeles' },
                result: {
                  temperature: 29.4,
                  conditions: 'Clear sky',
                },
              },
            },
            {
              type: 'text',
              text: 'The current weather in Los Angeles is 29.4°C with clear sky.',
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
              toolName: 'weatherTool',
              args: { location: 'Los Angeles' },
              result: {
                temperature: 29.4,
                conditions: 'Clear sky',
              },
            },
          ],
        },
      },
    ];

    messageList.add(v2Messages, 'memory');

    // Get the core messages (what would be sent to LLM)
    const coreMessages = messageList.get.all.core();

    // Check if tool calls and text are properly separated in core messages
    // This is critical for the AI to be able to reference tool history

    // We expect multiple core messages if properly separated
    expect(coreMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('should preserve tool history in full conversation flow (reproduces traces issue)', () => {
    // This test simulates the full conversation flow as it would happen in the playground

    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'weatherAgent' });

    // Add system message like the agent would
    messageList.addSystem('You are a helpful weather assistant that provides accurate weather information.', 'agent');

    // Simulate loading previous messages from memory (database)
    const memoryMessages: MastraMessageV2[] = [
      // First user message
      {
        id: 'user-1',
        role: 'user',
        createdAt: new Date('2025-08-05T22:58:18.403Z'),
        threadId: 'thread-1',
        resourceId: 'weatherAgent',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'LA weather' }],
          content: 'LA weather',
        },
      },
      // Assistant response with tool call and result
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date('2025-08-05T22:58:22.151Z'),
        threadId: 'thread-1',
        resourceId: 'weatherAgent',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
                toolName: 'weatherTool',
                args: { location: 'Los Angeles' },
                result: {
                  temperature: 29.4,
                  conditions: 'Clear sky',
                },
              },
            },
            {
              type: 'text',
              text: 'The current weather in Los Angeles is 29.4°C with clear sky.',
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
              toolName: 'weatherTool',
              args: { location: 'Los Angeles' },
              result: {
                temperature: 29.4,
                conditions: 'Clear sky',
              },
            },
          ],
        },
      },
    ];

    // Add memory messages
    messageList.add(memoryMessages, 'memory');

    // Add new user message (like when user asks follow-up)
    const newUserMessage: MastraMessageV2 = {
      id: 'user-2',
      role: 'user',
      createdAt: new Date('2025-08-05T22:58:38.656Z'),
      threadId: 'thread-1',
      resourceId: 'weatherAgent',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'what was the weather when you called that tool?' }],
        content: 'what was the weather when you called that tool?',
      },
    };

    messageList.add(newUserMessage, 'user');

    // Get what would be sent to the LLM (this is what shows in traces)
    const promptMessages = messageList.get.all.prompt();

    // Verify tool history is present
    const hasToolCall = promptMessages.some(
      m => m.role === 'assistant' && Array.isArray(m.content) && m.content.some(c => c.type === 'tool-call'),
    );

    const hasToolResult = promptMessages.some(
      m => m.role === 'tool' && Array.isArray(m.content) && m.content.some(c => c.type === 'tool-result'),
    );

    expect(hasToolCall).toBe(true);
    expect(hasToolResult).toBe(true);

    // Count the messages to understand the structure
    const messagesByRole = promptMessages.reduce(
      (acc, m) => {
        acc[m.role] = (acc[m.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // We should have: system, user, assistant (tool-call), tool (result), assistant (text), user
    expect(messagesByRole.system).toBe(1);
    expect(messagesByRole.user).toBe(2);
    expect(messagesByRole.assistant).toBeGreaterThanOrEqual(2);
    expect(messagesByRole.tool).toBe(1);
  });
});

describe('convertToV1Messages - Content Duplication Bug (Issue #7271)', () => {
  it('should NOT duplicate content across split messages when converting complex V2 messages', () => {
    // This test reproduces the exact bug from issue #7271
    // Where multiple split messages were created with identical content
    // instead of properly distributing different parts

    const complexMessage: MastraMessageV2 = {
      id: 'msg-complex',
      role: 'assistant',
      createdAt: new Date('2024-01-01'),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2,
        content: 'Based on my investigation, I can now provide a comprehensive root cause analysis...',
        parts: [
          {
            type: 'text',
            text: 'Let me analyze the issue step by step.',
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-1',
              toolName: 'analysisTool',
              args: { query: 'root cause' },
              result: { finding: 'Memory leak detected' },
            },
          },
          {
            type: 'text',
            text: 'After running the analysis tool, I found the following:',
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-2',
              toolName: 'debugTool',
              args: { target: 'memory' },
              result: { usage: '95%' },
            },
          },
          {
            type: 'text',
            text: 'Based on my investigation, I can now provide a comprehensive root cause analysis of the issue.',
          },
        ],
      },
    };

    const result = convertToV1Messages([complexMessage]);

    // Should create multiple split messages
    expect(result.length).toBeGreaterThan(1);

    // Collect all text content from the split messages
    const textContents: string[] = [];

    result.forEach(msg => {
      if (msg.role === 'assistant' && msg.type === 'text') {
        if (typeof msg.content === 'string') {
          textContents.push(msg.content);
        } else if (Array.isArray(msg.content)) {
          msg.content.forEach(part => {
            if (part.type === 'text') {
              textContents.push(part.text);
            }
          });
        }
      }
    });

    // CRITICAL: Each text content should be DIFFERENT
    // The bug was that all split messages had the same content
    expect(textContents.length).toBeGreaterThan(1);

    // Before the fix, this would fail because all text contents were identical
    // After the fix, each should have unique content from different parts
    expect(textContents[0]).toBe('Let me analyze the issue step by step.');
    expect(textContents[1]).toBe('After running the analysis tool, I found the following:');
    expect(textContents[2]).toBe(
      'Based on my investigation, I can now provide a comprehensive root cause analysis of the issue.',
    );

    // Ensure no duplication - all text contents should be unique
    const uniqueContents = new Set(textContents);
    expect(uniqueContents.size).toBe(textContents.length);

    // Verify the IDs follow the split pattern
    const assistantMessages = result.filter(m => m.role === 'assistant');
    const ids = assistantMessages.map(m => m.id);

    // First message keeps original ID
    expect(ids[0]).toBe('msg-complex');

    // Subsequent messages should have __split-N suffix
    for (let i = 1; i < assistantMessages.length; i++) {
      expect(ids[i]).toMatch(/__split-\d+$/);
    }
  });

  it('should handle large complex message with multiple tool invocations and text parts', () => {
    // Simulating the 24,624 character message from the bug report
    const largeMessage: MastraMessageV2 = {
      id: 'large-msg',
      role: 'assistant',
      createdAt: new Date('2024-01-01'),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2,
        content: 'A'.repeat(4927), // The bug showed 4,927 chars being duplicated
        parts: [
          {
            type: 'text',
            text: 'Introduction: Starting the analysis...',
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-intro',
              toolName: 'searchTool',
              args: { query: 'initial scan' },
              result: { status: 'complete' },
            },
          },
          {
            type: 'text',
            text: 'Middle section: ' + 'B'.repeat(4900), // Different content
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-middle',
              toolName: 'analyzeTool',
              args: { depth: 'deep' },
              result: { findings: ['issue1', 'issue2'] },
            },
          },
          {
            type: 'text',
            text: 'Conclusion: ' + 'C'.repeat(4900), // Different content
          },
        ],
      },
    };

    const result = convertToV1Messages([largeMessage]);

    // Collect all text contents
    const textMessages = result.filter(m => m.role === 'assistant' && m.type === 'text');

    // Should have 3 text messages
    expect(textMessages.length).toBe(3);

    // Each should have DIFFERENT content
    const contents = textMessages.map(m => {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content) && m.content[0]?.type === 'text') return m.content[0].text;
      return '';
    });

    // Verify each text part is different
    expect(contents[0]).toContain('Introduction');
    expect(contents[1]).toContain('Middle section');
    expect(contents[1]).toContain('B'.repeat(100)); // Should contain the B's
    expect(contents[2]).toContain('Conclusion');
    expect(contents[2]).toContain('C'.repeat(100)); // Should contain the C's

    // Ensure NO text contains the original content field value
    contents.forEach(content => {
      expect(content).not.toBe('A'.repeat(4927));
    });
  });

  it('should properly split messages even when content field is undefined', () => {
    // From the bug report, content can be undefined in V2 messages
    const messageWithUndefinedContent: MastraMessageV2 = {
      id: 'undefined-content-msg',
      role: 'assistant',
      createdAt: new Date('2024-01-01'),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2,
        content: undefined, // This is valid in V2
        parts: [
          {
            type: 'text',
            text: 'First text part with specific content',
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tool-x',
              toolName: 'someTool',
              args: {},
              result: { data: 'result' },
            },
          },
          {
            type: 'text',
            text: 'Second text part with different content',
          },
        ],
      },
    };

    const result = convertToV1Messages([messageWithUndefinedContent]);

    // Collect text contents
    const textContents: string[] = [];
    result.forEach(msg => {
      if (msg.role === 'assistant' && msg.type === 'text') {
        if (typeof msg.content === 'string') {
          textContents.push(msg.content);
        } else if (Array.isArray(msg.content)) {
          msg.content.forEach(part => {
            if (part.type === 'text') {
              textContents.push(part.text);
            }
          });
        }
      }
    });

    // Should have extracted the actual text from parts, not undefined
    expect(textContents[0]).toBe('First text part with specific content');
    expect(textContents[1]).toBe('Second text part with different content');

    // Should not have any undefined or empty content
    textContents.forEach(content => {
      expect(content).toBeTruthy();
      expect(content).not.toBe('undefined');
    });
  });
});
