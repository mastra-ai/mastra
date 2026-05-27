import { describe, it, expect } from 'vitest';
import { MessageList } from '../index';

/**
 * Test for GitHub issue #12405: Tool call args lost when tool invocation
 * split across messages (client tools)
 *
 * When using client tools, the tool invocation can be split across two messages:
 * 1. First message: state='call' with actual tool call args
 * 2. Second message: state='result' with empty args
 *
 * The issue occurs because findToolCallArgs was returning the first match
 * even if args were empty, causing Anthropic models to fail with error about
 * missing input field in tool-result parts.
 */
describe('MessageList - Split tool call args across messages (#12405)', () => {
  it('should recover tool call args when split across call and result messages', () => {
    const messageList = new MessageList();

    // Simulate a client tool invocation split across messages:
    // 1. Assistant makes tool call with actual args (state='call')
    // 2. Client executes tool and sends result (state='result' with empty args)
    // 3. When reloading from memory, tool-result should have original args

    // Step 1: User message
    messageList.add({ role: 'user', content: 'Get the weather for San Francisco' }, 'input');

    // Step 2: Assistant makes tool call with actual args
    messageList.add(
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            args: { city: 'San Francisco', units: 'celsius' },
          },
        ],
      },
      'response',
    );

    // Step 3: Client tool result comes back (empty args in storage)
    messageList.add(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            result: { temperature: 18, condition: 'sunny' },
          },
        ],
      },
      'response',
    );

    // Step 4: Convert messages to AIV5 model format
    const modelMessages = messageList.get.all.aiV5.model();

    // Find the tool-result message
    const toolResultMsg = modelMessages.find(msg => msg.role === 'tool');

    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg?.content).toBeInstanceOf(Array);

    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
      const toolResultPart = toolResultMsg.content.find((part: any) => part.type === 'tool-result');

      expect(toolResultPart).toBeDefined();

      // THIS IS THE CRITICAL ASSERTION for issue #12405:
      // The input field should contain the ORIGINAL tool call args
      // even though the result message in storage has empty args
      if (toolResultPart) {
        // @ts-expect-error - input field exists on StaticToolResult but not in base ToolResultPart type
        expect(toolResultPart.input).toEqual({ city: 'San Francisco', units: 'celsius' });
      }
    }
  });

  it('should handle multiple tool calls with split args correctly', () => {
    const messageList = new MessageList();

    // Turn 1: User message
    messageList.add({ role: 'user', content: 'Check weather and time' }, 'input');

    // Turn 1: Two tool calls with different args
    messageList.add(
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            args: { city: 'New York' },
          },
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'getCurrentTime',
            args: { timezone: 'UTC' },
          },
        ],
      },
      'response',
    );

    // Turn 1: Tool results (with empty args in storage)
    messageList.add(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            result: { temperature: 10 },
          },
          {
            type: 'tool-result',
            toolCallId: 'call-2',
            toolName: 'getCurrentTime',
            result: { time: '14:30' },
          },
        ],
      },
      'response',
    );

    // Convert to AIV5 model format
    const modelMessages = messageList.get.all.aiV5.model();

    // Find tool-result messages
    const toolResultMessages = modelMessages.filter(msg => msg.role === 'tool');

    expect(toolResultMessages).toHaveLength(1);

    const toolResultMsg = toolResultMessages[0];
    expect(toolResultMsg?.content).toBeInstanceOf(Array);

    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
      const toolResultParts = toolResultMsg.content.filter((part: any) => part.type === 'tool-result');

      expect(toolResultParts).toHaveLength(2);

      // Verify first tool result has correct input
      const firstResult = toolResultParts.find((part: any) => part.toolCallId === 'call-1');
      expect(firstResult).toBeDefined();
      if (firstResult) {
        // @ts-expect-error - input field exists on StaticToolResult
        expect(firstResult.input).toEqual({ city: 'New York' });
      }

      // Verify second tool result has correct input
      const secondResult = toolResultParts.find((part: any) => part.toolCallId === 'call-2');
      expect(secondResult).toBeDefined();
      if (secondResult) {
        // @ts-expect-error - input field exists on StaticToolResult
        expect(secondResult.input).toEqual({ timezone: 'UTC' });
      }
    }
  });

  it('should prioritize tool call message with args over result message with empty args', () => {
    const messageList = new MessageList();

    // This test specifically verifies that findToolCallArgs continues searching
    // when it encounters a match with empty args, instead of returning immediately

    // Step 1: Assistant tool call with args
    messageList.add(
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-search',
            toolName: 'search',
            args: { query: 'mastra framework', limit: 10 },
          },
        ],
      },
      'response',
    );

    // Step 2: Tool result (would have empty args in database when using client tools)
    messageList.add(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-search',
            toolName: 'search',
            result: { results: [] },
          },
        ],
      },
      'response',
    );

    // Convert and verify
    const modelMessages = messageList.get.all.aiV5.model();
    const toolResultMsg = modelMessages.find(msg => msg.role === 'tool');

    expect(toolResultMsg).toBeDefined();

    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
      const toolResultPart = toolResultMsg.content.find((part: any) => part.type === 'tool-result');

      if (toolResultPart) {
        // @ts-expect-error - input field exists on StaticToolResult
        expect(toolResultPart.input).toEqual({ query: 'mastra framework', limit: 10 });
      }
    }
  });
});
