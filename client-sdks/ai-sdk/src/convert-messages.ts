import { MessageList } from '@mastra/core/agent/message-list';
import type { MessageListInput } from '@mastra/core/agent/message-list';

/**
 * Converts messages to AI SDK V5 UI format
 */
export function toAISdkV5Messages(messages: MessageListInput) {
  return new MessageList().add(messages, `memory`).get.all.aiV5.ui();
}

/**
 * Converts messages to AI SDK V4 UI format
 */
export function toAISdkV4Messages(messages: MessageListInput) {
  return new MessageList().add(messages, `memory`).get.all.aiV4.ui();
}
