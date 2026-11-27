import { describe, expect, it } from 'vitest';
import { messageOfCall, messagesOfCall, toChatMessages } from './messages';

describe('toChatMessages', () => {
  it('replays an earlier turn the way it was first sent, so LangSmith shows it once', () => {
    const user = { role: 'user', content: [{ type: 'text', text: 'Weather in Paris and Rome?' }] };
    const toolCall = (toolCallId: string, city: string) => ({
      type: 'tool-call',
      toolCallId,
      toolName: 'getWeather',
      input: { city },
      providerOptions: { openai: { itemId: 'fc_1' } },
    });
    const toolResult = (toolCallId: string, value: unknown) => ({
      type: 'tool-result',
      toolCallId,
      toolName: 'getWeather',
      output: { type: 'json', value },
    });

    expect(
      toChatMessages([
        user,
        {
          role: 'assistant',
          content: [{ type: 'reasoning', text: 'thinking' }, toolCall('a', 'Paris'), toolCall('b', 'Rome')],
        },
        {
          role: 'tool',
          content: [
            // toModelOutput gave the model text, not the raw result.
            {
              ...toolResult('a', { highC: 24 }),
              providerOptions: { mastra: { modelOutput: { type: 'text', value: 'Paris: 24' } } },
            },
            toolResult('b', false),
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'thinking' },
            { type: 'text', text: 'Both are ' },
            { type: 'text', text: 'sunny.' },
          ],
        },
        // What span serialization leaves of a longer history.
        '[…12 more items]',
      ]),
    ).toEqual([
      user,
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'a', type: 'function', function: { name: 'getWeather', arguments: '{"city":"Paris"}' } },
          { id: 'b', type: 'function', function: { name: 'getWeather', arguments: '{"city":"Rome"}' } },
        ],
      },
      { role: 'tool', tool_call_id: 'a', name: 'getWeather', content: 'Paris: 24' },
      { role: 'tool', tool_call_id: 'b', name: 'getWeather', content: 'false' },
      { role: 'assistant', content: 'Both are sunny.' },
    ]);
  });
});

describe('messagesOfCall', () => {
  it('keeps the text of a call that also requested tools, and skips a result that never arrived', () => {
    const call = (toolCallId: string) => ({ toolCallId, toolName: 'getWeather', args: { city: toolCallId } });
    const messages = messagesOfCall({
      input: [{ role: 'user', content: 'Hi' }],
      calls: [{ stepId: '0', message: messageOfCall({ text: 'Let me check.', toolCalls: [call('a'), call('b')] })! }],
      toolResults: new Map([['b', 'city not found']]),
    }) as any[];

    expect(messages.map(({ role, content, tool_call_id }) => [role, content, tool_call_id])).toEqual([
      ['user', 'Hi', undefined],
      ['assistant', 'Let me check.', undefined],
      ['tool', 'city not found', 'b'],
    ]);
    expect(messages[1].tool_calls.map((toolCall: any) => toolCall.id)).toEqual(['a', 'b']);
  });

  it('accepts tool calls that a span processor redacted', () => {
    expect(messageOfCall({ text: 'Done.', toolCalls: '[REDACTED]' as any })).toEqual({
      role: 'assistant',
      content: 'Done.',
    });
  });
});
