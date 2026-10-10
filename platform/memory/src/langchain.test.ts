import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { describe, expect, it } from 'vitest';

import type { PlatformMemoryClient } from './client';
import { PlatformChatMessageHistory } from './langchain';

function fakeClient() {
  const calls: unknown[][] = [];
  const client = {
    getContext: async () => ({
      system: '<observations>Ada lives in Kyoto.</observations>',
      continuation: '<system-reminder>continue</system-reminder>',
      messages: [
        { id: '1', role: 'user', content: 'I like tea', createdAt: '' },
        { id: '2', role: 'assistant', content: 'Noted.', createdAt: '' },
      ],
      observedAt: null,
    }),
    saveMessages: async (...args: unknown[]) => {
      calls.push(['save', ...args]);
      return { messages: [] };
    },
    deleteThread: async (...args: unknown[]) => {
      calls.push(['delete', ...args]);
    },
  } as unknown as PlatformMemoryClient;
  return { client, calls };
}

describe('PlatformChatMessageHistory', () => {
  it('returns observations as a system message followed by the unobserved tail', async () => {
    const { client } = fakeClient();
    const messages = await new PlatformChatMessageHistory({ client, threadId: 't1' }).getMessages();
    expect(messages.map(m => [m.getType(), m.text])).toEqual([
      ['system', '<observations>Ada lives in Kyoto.</observations>'],
      ['human', '<system-reminder>continue</system-reminder>'],
      ['human', 'I like tea'],
      ['ai', 'Noted.'],
    ]);
  });

  it('saves human and AI messages in one request and skips system messages', async () => {
    const { client, calls } = fakeClient();
    const history = new PlatformChatMessageHistory({ client, threadId: 't1', resourceId: 'u1' });
    await history.addMessages([
      new SystemMessage('sys'),
      new HumanMessage('Where do I live?'),
      new ToolMessage({ content: 'x', tool_call_id: 'c1' }),
      new AIMessage('Kyoto.'),
    ]);
    await history.addMessages([new SystemMessage('only system')]);
    await history.clear();

    expect(calls).toEqual([
      [
        'save',
        't1',
        {
          resourceId: 'u1',
          messages: [
            { role: 'user', content: 'Where do I live?', parts: [{ type: 'text', text: 'Where do I live?' }] },
            { role: 'assistant', content: 'Kyoto.', parts: [{ type: 'text', text: 'Kyoto.' }] },
          ],
        },
      ],
      ['delete', 't1'],
    ]);
  });

  it('saves tool calls with their results, reasoning, and files', async () => {
    const { client, calls } = fakeClient();
    await new PlatformChatMessageHistory({ client, threadId: 't1' }).addMessages([
      new HumanMessage({
        contentBlocks: [
          { type: 'text', text: 'Weather here?' },
          { type: 'image', data: 'AQID', mimeType: 'image/png' },
        ],
      }),
      new AIMessage({
        content: [{ type: 'reasoning', reasoning: 'Look it up.' }],
        tool_calls: [{ id: 'c1', name: 'weather', args: { city: 'Kyoto' } }],
      }),
      new ToolMessage({ content: 'sunny', tool_call_id: 'c1' }),
      new AIMessage('Sunny.'),
    ]);

    expect((calls[0]![2] as { messages: unknown[] }).messages).toEqual([
      {
        role: 'user',
        content: 'Weather here?',
        parts: [
          { type: 'text', text: 'Weather here?' },
          { type: 'file', data: 'AQID', mimeType: 'image/png' },
        ],
      },
      {
        role: 'assistant',
        parts: [
          { type: 'reasoning', reasoning: 'Look it up.', details: [{ type: 'text', text: 'Look it up.' }] },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId: 'c1', toolName: 'weather', args: { city: 'Kyoto' }, result: 'sunny' },
          },
        ],
      },
      { role: 'assistant', content: 'Sunny.', parts: [{ type: 'text', text: 'Sunny.' }] },
    ]);
  });

  it('replays recalled tool calls with their results', async () => {
    const client = {
      getContext: async () => ({
        system: null,
        messages: [
          {
            id: '1',
            role: 'assistant',
            content: 'Sunny.',
            createdAt: '',
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: { state: 'result', toolCallId: 'c1', toolName: 'weather', args: { city: 'Kyoto' }, result: 'sunny' },
              },
              { type: 'text', text: 'Sunny.' },
            ],
          },
        ],
        observedAt: null,
      }),
    } as unknown as PlatformMemoryClient;
    const [ai, tool] = await new PlatformChatMessageHistory({ client, threadId: 't1' }).getMessages();

    expect(ai).toBeInstanceOf(AIMessage);
    expect((ai as AIMessage).text).toBe('Sunny.');
    expect((ai as AIMessage).tool_calls).toEqual([
      expect.objectContaining({ id: 'c1', name: 'weather', args: { city: 'Kyoto' } }),
    ]);
    expect(tool).toBeInstanceOf(ToolMessage);
    expect((tool as ToolMessage).tool_call_id).toBe('c1');
    expect((tool as ToolMessage).content).toBe('sunny');
  });
});
