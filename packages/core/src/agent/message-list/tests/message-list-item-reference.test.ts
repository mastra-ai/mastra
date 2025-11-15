import { describe, it, expect } from 'vitest';
import { MessageList } from '../index';

describe('MessageList item reference plumbing', () => {
  it('should preserve providerOptions.openai.itemId through each conversion step', async () => {
    const list = new MessageList();

    list.addSystem('You are a helpful assistant');

    // Add user message
    list.add({ role: 'user', content: 'What is the weather?' }, 'input');

    // Add assistant message with tool-call that has providerOptions
    list.add(
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'get_weather',
            args: { location: 'London' },
            providerOptions: {
              openai: {
                itemId: 'fc_test_item_id',
              },
            },
          },
        ],
      },
      'response',
    );

    const responseMessages = list.get.response.aiV5.model();

    // Verify that the assistant message was returned
    const assistantMessage = responseMessages.find((msg: any) => msg.role === 'assistant');
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage?.role).toBe('assistant');

    // Verify that the tool-call content is present
    expect(Array.isArray(assistantMessage?.content)).toBe(true);
    const toolCallPart = (assistantMessage?.content as any[])?.[0];
    expect(toolCallPart).toBeDefined();
    expect(toolCallPart?.type).toBe('tool-call');

    // Verify that providerOptions.openai.itemId is preserved
    expect(toolCallPart?.providerOptions).toBeDefined();
    expect(toolCallPart?.providerOptions?.openai).toBeDefined();
    expect(toolCallPart?.providerOptions?.openai?.itemId).toBe('fc_test_item_id');

    // Also verify the other tool-call properties are intact
    expect(toolCallPart?.toolCallId).toBe('call-1');
    expect(toolCallPart?.toolName).toBe('get_weather');
    expect(toolCallPart?.input).toEqual({ location: 'London' });
  });
});
