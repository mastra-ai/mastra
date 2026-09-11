import type { ListMemoryThreadMessagesResponse } from '@mastra/client-js';

export const attachmentMessages = (texts: string[]): ListMemoryThreadMessagesResponse => ({
  messages: [
    {
      id: 'attachment-turn',
      role: 'user',
      createdAt: new Date('2026-09-10T12:00:00Z'),
      threadId: 'thread-1',
      resourceId: 'agent-1',
      content: { format: 2, parts: texts.map(text => ({ type: 'text', text })) },
    },
  ],
});
