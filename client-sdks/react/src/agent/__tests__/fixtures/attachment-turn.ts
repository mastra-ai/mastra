import type { ListMemoryThreadMessagesResponse } from '@mastra/client-js';
import { MessageList } from '@mastra/core/agent/message-list';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { CoreUserMessage } from '@mastra/core/llm';

export const attachmentTurn: CoreUserMessage[] = [
  {
    role: 'user',
    content: [
      {
        type: 'file',
        data: 'data:audio/mpeg;base64,SUQz',
        mimeType: 'audio/mpeg',
        filename: 'Voice of the Customer.mp3',
      },
    ],
  },
  {
    role: 'user',
    content: [{ type: 'image', image: 'https://files.example.com/diagram.png', mimeType: 'image/png' }],
  },
  {
    role: 'user',
    content: [
      {
        type: 'file',
        data: 'data:application/pdf;base64,JVBERi0xLjQ=',
        mimeType: 'application/pdf',
        filename: 'proposal.pdf',
      },
    ],
  },
  {
    role: 'user',
    content: [
      {
        type: 'file',
        data: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEs=',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'budget.xlsx',
      },
    ],
  },
  { role: 'user', content: '<attachment name="notes.txt">Review the proposal.</attachment>' },
];

/** Use the same input conversion as memory, preserving the request's message boundaries. */
export const persistAttachmentTurn = (messages: MessageListInput): ListMemoryThreadMessagesResponse => ({
  messages: new MessageList({ threadId: 'thread-1', resourceId: 'agent-1' }).add(messages, 'input').get.all.db(),
  uiMessages: null,
});
