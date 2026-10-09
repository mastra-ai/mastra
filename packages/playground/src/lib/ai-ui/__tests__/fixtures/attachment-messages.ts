import type { ListMemoryThreadMessagesResponse } from '@mastra/client-js';
import { MessageList } from '@mastra/core/agent/message-list';
import type { MessageListInput } from '@mastra/core/agent/message-list';

export const attachmentMessages = (messages: MessageListInput): ListMemoryThreadMessagesResponse => ({
  messages: new MessageList({ threadId: 'thread-1', resourceId: 'agent-1' }).add(messages, 'input').get.all.db(),
  uiMessages: null,
});
