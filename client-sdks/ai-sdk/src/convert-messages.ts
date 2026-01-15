import { MessageList, resolveNetworkMessages } from '@mastra/core/agent/message-list';
import type { MessageListInput } from '@mastra/core/agent/message-list';

/**
 * Converts messages from various input formats to AI SDK V5 UI message format.
 *
 * This function accepts messages in multiple formats (strings, AI SDK V4/V5 messages, Mastra DB messages, etc.) and normalizes them to the AI SDK V5 UIMessage format, which is suitable for use with AI SDK V5 UI components like `useChat()`.
 *
 * @param messages - Messages to convert. Accepts:
 *   - `string` - A single text message (treated as user role)
 *   - `string[]` - Multiple text messages
 *   - `MessageInput` - A single message object in any supported format:
 *     - AI SDK V5 UIMessage or ModelMessage
 *     - AI SDK V4 UIMessage or CoreMessage
 *     - MastraDBMessage (internal storage format)
 *     - MastraMessageV1 (legacy format)
 *   - `MessageInput[]` - Array of message objects
 *
 * @returns An array of AI SDK V5 UIMessage objects with:
 *   - `id` - Unique message identifier
 *   - `role` - 'user' | 'assistant' | 'system'
 *   - `parts` - Array of UI parts (text, tool results, files, reasoning, etc.)
 *   - `metadata` - Optional metadata including createdAt, threadId, resourceId
 *
 * @example
 * ```typescript
 * import { toAISdkV5Messages } from '@mastra/ai-sdk';
 *
 * // Convert simple text messages
 * const messages = toAISdkV5Messages(['Hello', 'How can I help?']);
 *
 * // Convert AI SDK V4 messages to V5 format
 * const v4Messages = [
 *   { id: '1', role: 'user', content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] },
 *   { id: '2', role: 'assistant', content: 'Hi!', parts: [{ type: 'text', text: 'Hi!' }] }
 * ];
 * const v5Messages = toAISdkV5Messages(v4Messages);
 *
 * // Use with useChat or similar AI SDK V5 hooks
 * const { messages: chatMessages } = useChat({
 *   initialMessages: toAISdkV5Messages(storedMessages)
 * });
 * ```
 */
export function toAISdkV5Messages(messages: MessageListInput) {
  const converted = new MessageList().add(messages, `memory`).get.all.aiV5.ui();
  // Transform network messages from raw JSON to displayable dynamic-tool parts
  return resolveNetworkMessages(converted);
}

/**
 * Converts messages from various input formats to AI SDK V4 UI message format.
 *
 * This function accepts messages in multiple formats (strings, AI SDK V4/V5 messages, Mastra DB messages, etc.) and normalizes them to the AI SDK V4 UIMessage format, which is suitable for use with AI SDK V4 UI components.
 *
 * @param messages - Messages to convert. Accepts:
 *   - `string` - A single text message (treated as user role)
 *   - `string[]` - Multiple text messages
 *   - `MessageInput` - A single message object in any supported format:
 *     - AI SDK V5 UIMessage or ModelMessage
 *     - AI SDK V4 UIMessage or CoreMessage
 *     - MastraDBMessage (internal storage format)
 *     - MastraMessageV1 (legacy format)
 *   - `MessageInput[]` - Array of message objects
 *
 * @returns An array of AI SDK V4 UIMessage objects with:
 *   - `id` - Unique message identifier
 *   - `role` - 'user' | 'assistant' | 'system'
 *   - `content` - Text content of the message
 *   - `parts` - Array of UI parts (text, tool-invocation, file, reasoning, etc.)
 *   - `createdAt` - Message creation timestamp
 *   - `toolInvocations` - Optional array of tool invocations (for assistant messages)
 *   - `experimental_attachments` - Optional file attachments
 *   - `metadata` - Optional custom metadata
 *
 * @example
 * ```typescript
 * import { toAISdkV4Messages } from '@mastra/ai-sdk';
 *
 * // Convert simple text messages
 * const messages = toAISdkV4Messages(['Hello', 'How can I help?']);
 *
 * // Convert AI SDK V5 messages to V4 format for legacy compatibility
 * const v5Messages = [
 *   { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
 *   { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] }
 * ];
 * const v4Messages = toAISdkV4Messages(v5Messages);
 *
 * // Use with AI SDK V4 useChat hook
 * const { messages: chatMessages } = useChat({
 *   initialMessages: toAISdkV4Messages(storedMessages)
 * });
 * ```
 */
export function toAISdkV4Messages(messages: MessageListInput) {
  return new MessageList().add(messages, `memory`).get.all.aiV4.ui();
}
