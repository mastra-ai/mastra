import { MessageList } from '@mastra/core/agent/message-list';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { UIMessage } from 'ai';

// Type definitions for parsing network execution data
interface NetworkToolCallContent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface NetworkToolResultContent {
  type: string;
  toolCallId: string;
  toolName: string;
  result?: {
    result?: Record<string, unknown>;
  };
}

interface NetworkNestedMessage {
  role: string;
  id: string;
  createdAt: string;
  type: string;
  content?: string | (NetworkToolCallContent | NetworkToolResultContent)[];
}

interface NetworkFinalResult {
  result?: unknown;
  text?: string;
  messages?: NetworkNestedMessage[];
}

interface NetworkExecutionData {
  isNetwork: boolean;
  selectionReason?: string;
  primitiveType?: string;
  primitiveId?: string;
  input?: string;
  finalResult?: NetworkFinalResult;
  messages?: NetworkNestedMessage[];
}

interface NetworkChildMessage {
  type: 'tool' | 'text';
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  content?: string;
}

/**
 * Transforms network execution messages from raw JSON format to displayable UI parts.
 *
 * Agent Network stores routing metadata as JSON text in message content. This function
 * detects such messages and transforms them into proper `dynamic-tool` parts that can
 * be rendered in the UI.
 *
 * Also handles conversion of pendingToolApprovals and suspendedTools from DB format
 * to stream format for proper rendering.
 *
 * @param messages - Array of UI messages that may contain network execution data
 * @returns Transformed messages with network JSON converted to dynamic-tool parts
 *
 * @example
 * ```typescript
 * import { resolveNetworkMessages } from '@mastra/ai-sdk';
 *
 * // Messages from database may contain raw network JSON
 * const storedMessages = await memory.recall({ threadId });
 * const displayableMessages = resolveNetworkMessages(storedMessages);
 * ```
 */
export function resolveNetworkMessages<T extends UIMessage>(messages: T[]): T[] {
  const messagesLength = messages.length;
  return messages.map((message, index) => {
    // Check if message contains network execution data
    const networkPart = (message.parts || []).find(
      (part): part is { type: 'text'; text: string } =>
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string' &&
        part.text.includes('"isNetwork":true'),
    );

    if (networkPart && networkPart.type === 'text') {
      try {
        const json: NetworkExecutionData = JSON.parse(networkPart.text);

        if (json.isNetwork === true) {
          // Extract network execution data
          const selectionReason = json.selectionReason || '';
          const primitiveType = json.primitiveType || '';
          const primitiveId = json.primitiveId || '';
          const finalResult = json.finalResult;
          const nestedMessages = finalResult?.messages || [];

          // Build child messages from nested messages
          const childMessages: NetworkChildMessage[] = [];

          // Build a map of toolCallId -> toolResult for efficient lookup
          const toolResultMap = new Map<string, NetworkToolResultContent>();
          for (const msg of nestedMessages) {
            if (Array.isArray(msg.content)) {
              for (const part of msg.content) {
                if (typeof part === 'object' && part.type === 'tool-result') {
                  toolResultMap.set(part.toolCallId, part as NetworkToolResultContent);
                }
              }
            }
          }

          // Extract tool calls from messages and match them with their results
          for (const msg of nestedMessages) {
            if (msg.type === 'tool-call' && Array.isArray(msg.content)) {
              // Process each tool call in this message
              for (const part of msg.content) {
                if (typeof part === 'object' && part.type === 'tool-call') {
                  const toolCallContent = part as NetworkToolCallContent;
                  const toolResult = toolResultMap.get(toolCallContent.toolCallId);
                  const isWorkflow = Boolean(
                    toolResult?.result?.result &&
                    typeof toolResult.result.result === 'object' &&
                    toolResult.result.result !== null &&
                    'steps' in toolResult.result.result,
                  );

                  childMessages.push({
                    type: 'tool' as const,
                    toolCallId: toolCallContent.toolCallId,
                    toolName: toolCallContent.toolName,
                    args: toolCallContent.args,
                    toolOutput: isWorkflow
                      ? (toolResult?.result?.result as Record<string, unknown>)
                      : toolResult?.result,
                  });
                }
              }
            }
          }

          // Add the final text result if available
          if (finalResult && finalResult.text) {
            childMessages.push({
              type: 'text' as const,
              content: finalResult.text,
            });
          }

          // Build the result object
          const result =
            primitiveType === 'tool'
              ? finalResult?.result
              : {
                  childMessages: childMessages,
                  result: finalResult?.text || '',
                };

          // Return the transformed message with dynamic-tool part
          return {
            role: 'assistant' as const,
            parts: [
              {
                type: 'dynamic-tool',
                toolCallId: primitiveId,
                toolName: primitiveId,
                state: 'output-available',
                input: json.input,
                output: result,
              },
            ],
            id: message.id,
            metadata: {
              ...((message as Record<string, unknown>).metadata || {}),
              mode: 'network' as const,
              selectionReason: selectionReason,
              agentInput: json.input,
              hasMoreMessages: index < messagesLength - 1,
              from:
                primitiveType === 'agent'
                  ? ('AGENT' as const)
                  : primitiveType === 'tool'
                    ? ('TOOL' as const)
                    : ('WORKFLOW' as const),
            },
          } as T;
        }
      } catch {
        // If parsing fails, return the original message
        return message;
      }
    }

    // Handle pendingToolApprovals conversion from DB format to stream format
    const metadata = (message as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    if (metadata?.pendingToolApprovals && typeof metadata.pendingToolApprovals === 'object') {
      return {
        ...message,
        metadata: {
          ...metadata,
          mode: 'stream' as const,
          requireApprovalMetadata: metadata.pendingToolApprovals,
        },
      } as T;
    }

    // Handle suspendedTools conversion from DB format to stream format
    if (metadata?.suspendedTools && typeof metadata.suspendedTools === 'object') {
      return {
        ...message,
        metadata: {
          ...metadata,
          mode: 'stream' as const,
          suspendedTools: metadata.suspendedTools,
        },
      } as T;
    }

    // Return original message if no transformation needed
    return message;
  });
}

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
