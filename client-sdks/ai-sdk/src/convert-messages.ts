import { MessageList } from '@mastra/core/agent/message-list';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { UIMessage } from '@mastra/core/ai';

function isSystemReminderUIMessage(message: {
  role?: string;
  parts?: Array<{ type?: string; text?: string }>;
  content?: unknown;
  metadata?: Record<string, unknown>;
}) {
  // Check metadata first — processors stamp systemReminder or legacy dynamicAgentsMdReminder
  if (message.metadata?.systemReminder || message.metadata?.dynamicAgentsMdReminder) {
    return true;
  }

  if (message.role !== 'user') {
    return false;
  }

  // Fall back to text inspection for backward compatibility
  if (Array.isArray(message.parts)) {
    return message.parts.some(
      part => part.type === 'text' && typeof part.text === 'string' && part.text.includes('<system-reminder'),
    );
  }

  return typeof message.content === 'string' && message.content.includes('<system-reminder');
}

function filterSystemReminderUIMessages<
  T extends { role?: string; parts?: Array<{ type?: string; text?: string }>; content?: unknown },
>(messages: T[]): T[] {
  return messages.filter(message => !isSystemReminderUIMessage(message));
}

/**
 * Converts messages from any supported input format (strings, AI SDK v7 messages, Mastra DB messages)
 * to AI SDK v7 UI messages, suitable for `useChat()`. System-reminder messages are filtered out.
 *
 * @example
 * ```typescript
 * import { toAISdkMessages } from '@mastra/ai-sdk/ui';
 *
 * const messages = toAISdkMessages(storedMessages);
 * ```
 */
export function toAISdkMessages(messages: MessageListInput): UIMessage[] {
  const list = new MessageList().add(messages, `memory`);
  return filterSystemReminderUIMessages(list.get.all.aiSdk.ui()) as UIMessage[];
}
