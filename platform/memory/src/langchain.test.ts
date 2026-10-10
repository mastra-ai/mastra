import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { describe, expect, it } from 'vitest';

import type { PlatformMemoryClient } from './client';
import { PlatformChatMessageHistory } from './langchain';

function fakeClient() {
  const calls: unknown[][] = [];
  const client = {
    getContext: async () => ({
      system: '<observations>Ada lives in Kyoto.</observations>',
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
      ['human', 'I like tea'],
      ['ai', 'Noted.'],
    ]);
  });

  it('saves human and AI text in one request and skips other messages', async () => {
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
            { role: 'user', content: 'Where do I live?' },
            { role: 'assistant', content: 'Kyoto.' },
          ],
        },
      ],
      ['delete', 't1'],
    ]);
  });
});
