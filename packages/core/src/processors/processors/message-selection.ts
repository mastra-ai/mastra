import type { MastraDBMessage } from '../../agent/message-list';

export interface LastMessageOnlyOption {
  /**
   * Whether to run LLM-based checks only on the most recent message instead of the full message list.
   * Default: false.
   */
  lastMessageOnly?: boolean;
}

export function selectMessagesToCheck(messages: MastraDBMessage[], lastMessageOnly = false): MastraDBMessage[] {
  if (!lastMessageOnly || messages.length <= 1) {
    return messages;
  }

  const lastMessage = messages.at(-1);
  return lastMessage ? [lastMessage] : messages;
}
