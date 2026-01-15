import type * as AIV4 from '@internal/ai-sdk-v4';
import type * as AIV5 from '@internal/ai-sdk-v5';

import type { MastraDBMessage, UIMessageWithMetadata, MessageListInput } from '../index';

import { MessageList } from '../index';

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
 * import { resolveNetworkMessages } from '@mastra/core/agent';
 *
 * // Messages from database may contain raw network JSON
 * const storedMessages = await memory.recall({ threadId });
 * const displayableMessages = resolveNetworkMessages(storedMessages);
 * ```
 */
export function resolveNetworkMessages<T extends AIV5.UIMessage>(messages: T[]): T[] {
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
              ...(((message as Record<string, unknown>).metadata as Record<string, unknown>) || {}),
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
    const pendingToolApprovals = (message as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    if (pendingToolApprovals?.pendingToolApprovals && typeof pendingToolApprovals.pendingToolApprovals === 'object') {
      return {
        ...message,
        metadata: {
          ...pendingToolApprovals,
          mode: 'stream' as const,
          requireApprovalMetadata: pendingToolApprovals.pendingToolApprovals,
        },
      } as T;
    }

    // Handle suspendedTools conversion from DB format to stream format
    if (pendingToolApprovals?.suspendedTools && typeof pendingToolApprovals.suspendedTools === 'object') {
      return {
        ...message,
        metadata: {
          ...pendingToolApprovals,
          mode: 'stream' as const,
          suspendedTools: pendingToolApprovals.suspendedTools,
        },
      } as T;
    }

    // Return original message if no transformation needed
    return message;
  });
}

/**
 * Available output formats for message conversion.
 *
 * @remarks
 * - `Mastra.V2` - Current database storage format, compatible with AI SDK v4
 * - `AIV4.UI` - AI SDK v4 UIMessage format (for frontend components)
 * - `AIV4.Core` - AI SDK v4 CoreMessage format (for LLM API calls)
 * - `AIV5.UI` - AI SDK v5 UIMessage format (for frontend components)
 * - `AIV5.Model` - AI SDK v5 ModelMessage format (for LLM API calls)
 */
export type OutputFormat = 'Mastra.V2' | 'AIV4.UI' | 'AIV4.Core' | 'AIV5.UI' | 'AIV5.Model';

class MessageConverter {
  private messageList: MessageList;

  constructor(messages: MessageListInput) {
    this.messageList = new MessageList();
    // Use 'memory' source to preserve messages exactly as provided
    // without any transformations or combinations
    this.messageList.add(messages, 'memory');
  }

  /**
   * Convert messages to Mastra V2 format (current database format).
   * @param format - The format 'Mastra.V2'
   * @returns Array of messages in Mastra V2 format, used for database storage
   */
  to(format: 'Mastra.V2'): MastraDBMessage[];
  /**
   * Convert messages to AI SDK v4 UIMessage format.
   * @param format - The format 'AIV4.UI'
   * @returns Array of UIMessages for use with AI SDK v4 frontend components
   */
  to(format: 'AIV4.UI'): UIMessageWithMetadata[] | AIV4.UIMessage[];
  /**
   * Convert messages to AI SDK v4 CoreMessage format.
   * @param format - The format 'AIV4.Core'
   * @returns Array of CoreMessages for AI SDK v4 LLM API calls
   */
  to(format: 'AIV4.Core'): AIV4.CoreMessage[];
  /**
   * Convert messages to AI SDK v5 UIMessage format.
   * @param format - The format 'AIV5.UI'
   * @returns Array of UIMessages for use with AI SDK v5 frontend components
   */
  to(format: 'AIV5.UI'): AIV5.UIMessage[];
  /**
   * Convert messages to AI SDK v5 ModelMessage format.
   * @param format - The format 'AIV5.Model'
   * @returns Array of ModelMessages for AI SDK v5 LLM API calls
   */
  to(format: 'AIV5.Model'): AIV5.ModelMessage[];
  to(format: OutputFormat): unknown[] {
    switch (format) {
      // Old format keys (backward compatibility)
      case 'Mastra.V2':
        return this.messageList.get.all.db();
      case 'AIV4.UI':
        return this.messageList.get.all.aiV4.ui();
      case 'AIV4.Core':
        return this.messageList.get.all.aiV4.core();
      case 'AIV5.UI':
        return this.messageList.get.all.aiV5.ui();
      case 'AIV5.Model':
        return this.messageList.get.all.aiV5.model();
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }
}

/**
 * Convert messages from any supported format to another format.
 *
 * @param messages - Input messages in any supported format. Accepts:
 *   - AI SDK v4 formats: UIMessage, CoreMessage, Message
 *   - AI SDK v5 formats: UIMessage, ModelMessage
 *   - Mastra formats: MastraMessageV1 (input only), MastraDBMessage
 *   - Simple strings (will be converted to user messages)
 *   - Arrays of any of the above
 *
 * @returns A converter object with a `.to()` method to specify the output format
 *
 * @example
 * ```typescript
 * import { convertMessages } from '@mastra/core/agent';
 *
 * // Convert AI SDK v5 UI messages to v4 Core messages
 * const v4CoreMessages = convertMessages(v5UIMessages).to('AIV4.Core');
 *
 * // Convert database messages (Mastra V2) to AI SDK v5 UI messages for frontend
 * const v5UIMessages = convertMessages(dbMessages).to('AIV5.UI');
 *
 * // Convert any format to Mastra's V2 format for database storage
 * const mastraV2Messages = convertMessages(anyMessages).to('Mastra.V2');
 *
 * // Convert simple strings to formatted messages
 * const messages = convertMessages(['Hello', 'How are you?']).to('AIV5.UI');
 *
 * // Convert v4 UI messages to v5 Model messages for LLM calls
 * const modelMessages = convertMessages(v4UIMessages).to('AIV5.Model');
 * ```
 *
 * @remarks
 * This utility handles all message format conversions internally, including:
 * - Tool invocations and results
 * - File attachments
 * - Multi-part messages
 * - System messages
 * - Metadata preservation where possible
 */
export function convertMessages(messages: MessageListInput): MessageConverter {
  return new MessageConverter(messages);
}
