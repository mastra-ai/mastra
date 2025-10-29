import { MessageList } from '@mastra/core/agent/message-list';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';

/**
 * Converts Mastra V2 messages to AI SDK V5 UI format
 */
export function toAISdkV5Messages(messages: MastraDBMessage[]) {
  return new MessageList().add(messages, `memory`).get.all.aiV5.ui();
}

/**
 * Converts Mastra V2 messages to AI SDK V4 UI format
 */
export function toAISdkV4Messages(messages: MastraDBMessage[]) {
  return new MessageList().add(messages, `memory`).get.all.aiV4.ui();
}
