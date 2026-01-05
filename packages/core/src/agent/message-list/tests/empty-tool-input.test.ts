import { describe, it, expect } from 'vitest';
import { MessageList } from '../index';

/**
 * Test for GitHub issue #11376: Anthropic models fail with error
 * "messages.17.content.2.tool_use.input: Field required" when a tool call
 * in a previous step had an empty object as input.
 *
 * The issue occurs because when reconstructing tool-result messages for
 * subsequent LLM calls, the `input` field is hardcoded to `{}` (line 752 in index.ts)
 * instead of being properly reconstructed from the original tool call.
 */
describe('MessageList - Anthropic empty tool input issue (#11376)', () => {
  it('should properly reconstruct tool call input args in tool-result messages (empty object case)', () => {
    const messageList = new MessageList();

    // Simulate a conversation flow where:
    // 1. User asks a question
    // 2. Agent makes a tool call with empty object {} (all params optional)
    // 3. Tool executes and returns result
    // 4. The messages need to be sent back to Anthropic for next turn

    // Step 1: User message
    messageList.add({ role: 'user', content: 'Please use the test tool' }, 'input');

    // Step 2: Assistant makes a tool call with empty object (all params optional)
    messageList.add(
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'test-tool',
            args: {}, // Empty object because all parameters are optional
          },
        ],
      },
      'response',
    );

    // Step 3: Tool result comes back
    messageList.add(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'test-tool',
            result: { success: true },
          },
        ],
      },
      'response',
    );

    // Step 4: Convert messages to AIV5 model format (what gets sent to LLM)
    const modelMessages = messageList.get.all.aiV5.model();

    // Find the tool-result message (should be role 'tool')
    const toolResultMsg = modelMessages.find(msg => msg.role === 'tool');

    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg?.content).toBeInstanceOf(Array);

    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
      const toolResultPart = toolResultMsg.content.find((part: any) => part.type === 'tool-result');

      expect(toolResultPart).toBeDefined();

      // THIS IS THE CRITICAL ASSERTION:
      // The input field should match the original tool call args (empty object in this case)
      // This is important because Anthropic's API requires the input field to be present
      // and match the original tool call

      // Note: The type might be StaticToolResult which has an input field
      // or it might be ToolResultPart which doesn't have input in the type definition
      // but should have it populated when converting to model messages
      if (toolResultPart) {
        // @ts-expect-error - input field exists on StaticToolResult but not in base ToolResultPart type
        expect(toolResultPart.input).toEqual({});
      }
    }
  });

  it('should properly reconstruct tool call input args with actual parameters', () => {
    const messageList = new MessageList();

    // User message
    messageList.add({ role: 'user', content: 'Use the tool with param' }, 'input');

    // Tool call with actual parameters
    messageList.add(
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'test-tool',
            args: { optionalParam: 'test-value' },
          },
        ],
      },
      'response',
    );

    // Tool result
    messageList.add(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-2',
            toolName: 'test-tool',
            result: { success: true },
          },
        ],
      },
      'response',
    );

    // Convert to AIV5 model format
    const modelMessages = messageList.get.all.aiV5.model();

    const toolResultMsg = modelMessages.find(msg => msg.role === 'tool');

    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg?.content).toBeInstanceOf(Array);

    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
      const toolResultPart = toolResultMsg.content.find((part: any) => part.type === 'tool-result');

      expect(toolResultPart).toBeDefined();

      // The input should match the original tool call args
      if (toolResultPart) {
        // @ts-expect-error - input field exists on StaticToolResult but not in base ToolResultPart type
        expect(toolResultPart.input).toEqual({ optionalParam: 'test-value' });
      }
    }
  });

  it('should handle multiple tool calls with different args', () => {
    const messageList = new MessageList();

    // Turn 1: User message
    messageList.add({ role: 'user', content: 'First request' }, 'input');

    // Turn 1: Tool call with specific args
    messageList.add(
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'tool-a',
            args: { param1: 'value1' },
          },
        ],
      },
      'response',
    );

    // Turn 1: Tool result
    messageList.add(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'tool-a',
            result: 'result-1',
          },
        ],
      },
      'response',
    );

    // Turn 2: User message
    messageList.add({ role: 'user', content: 'Second request' }, 'input');

    // Turn 2: Tool call with empty args
    messageList.add(
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-2',
            toolName: 'tool-b',
            args: {}, // Empty object
          },
        ],
      },
      'response',
    );

    // Turn 2: Tool result
    messageList.add(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-2',
            toolName: 'tool-b',
            result: 'result-2',
          },
        ],
      },
      'response',
    );

    // Convert to AIV5 model format
    const modelMessages = messageList.get.all.aiV5.model();

    // Find all tool-result messages
    const toolResultMessages = modelMessages.filter(msg => msg.role === 'tool');

    expect(toolResultMessages).toHaveLength(2);
    expect(toolResultMessages[0]?.content).toBeInstanceOf(Array);
    expect(toolResultMessages[1]?.content).toBeInstanceOf(Array);

    // Check first tool result (with param)
    const firstResultMsg = toolResultMessages[0];
    if (firstResultMsg && Array.isArray(firstResultMsg.content)) {
      const toolResultPart = firstResultMsg.content.find((part: any) => part.type === 'tool-result');
      expect(toolResultPart).toBeDefined();

      if (toolResultPart) {
        // @ts-expect-error - input field exists on StaticToolResult
        expect(toolResultPart.input).toEqual({ param1: 'value1' });
        expect(toolResultPart.toolName).toBe('tool-a');
      }
    }

    // Check second tool result (with empty object)
    const secondResultMsg = toolResultMessages[1];
    if (secondResultMsg && Array.isArray(secondResultMsg.content)) {
      const toolResultPart = secondResultMsg.content.find((part: any) => part.type === 'tool-result');
      expect(toolResultPart).toBeDefined();

      // This is the critical assertion - empty object should be preserved
      if (toolResultPart) {
        // @ts-expect-error - input field exists on StaticToolResult
        expect(toolResultPart.input).toEqual({});
        expect(toolResultPart.toolName).toBe('tool-b');
      }
    }
  });
});
