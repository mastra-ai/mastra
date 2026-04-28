import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import { getLegacyContent, stripLegacyMessageFields } from '../../agent/message-list';
import type { RequestContext } from '../../request-context';

import type { Processor } from '../index';

/**
 * Type definition for tool invocation parts in MastraDBMessage format 2
 */
type V2ToolInvocationPart = {
  type: 'tool-invocation';
  toolInvocation: {
    toolName: string;
    toolCallId: string;
    args: unknown;
    result?: unknown;
    state: 'call' | 'result';
  };
};

/**
 * Filters out tool calls and results from messages.
 * By default (with no arguments), excludes all tool calls and their results.
 * Can be configured to exclude only specific tools by name.
 */
export class ToolCallFilter implements Processor {
  readonly id = 'tool-call-filter';
  name = 'ToolCallFilter';
  private exclude: string[] | 'all';

  /**
   * Create a filter for tool calls and results.
   * @param options Configuration options
   * @param options.exclude List of specific tool names to exclude. If not provided, all tool calls are excluded.
   */
  constructor(options: { exclude?: string[] } = {}) {
    // If no options or exclude is provided, exclude all tools
    if (!options || !options.exclude) {
      this.exclude = 'all'; // Exclude all tools
    } else {
      // Exclude specific tools
      this.exclude = Array.isArray(options.exclude) ? options.exclude : [];
    }
  }

  async processInput(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    requestContext?: RequestContext;
  }): Promise<MessageList | MastraDBMessage[]> {
    const { messageList } = args;
    // Use messages from messageList to respect consolidation
    const messages = messageList.get.all.db();

    // Helper to check if a message has tool invocations
    const hasToolInvocations = (message: MastraDBMessage): boolean => {
      if (typeof message.content === 'string') return false;
      if (!message.content?.parts) return false;
      return message.content.parts.some(part => part.type === 'tool-invocation');
    };

    // Helper to get tool invocations from a message
    const getToolInvocations = (message: MastraDBMessage) => {
      if (typeof message.content === 'string') return [];
      if (!message.content?.parts) return [];
      return message.content.parts.filter((part: any) => part.type === 'tool-invocation');
    };

    // Case 1: Exclude all tool calls and tool results
    if (this.exclude === 'all') {
      const result = messages
        .map(message => {
          // Skip messages with tool invocations - they'll be filtered by sanitizeAIV4UIMessages
          if (!hasToolInvocations(message)) {
            return message;
          }

          // For messages with tool invocations, strip the tool invocation parts
          // but keep other content (like text)
          if (typeof message.content === 'string') {
            return message;
          }

          if (!message.content?.parts) {
            return message;
          }

          // Filter out tool invocation parts
          const nonToolParts = message.content.parts.filter((part: any) => part.type !== 'tool-invocation');

          // If no parts remain after filtering, remove the message
          if (nonToolParts.length === 0) {
            return null;
          }

          return stripLegacyMessageFields({
            ...message,
            content: {
              ...message.content,
              parts: nonToolParts,
            },
          });
        })
        .filter((message): message is MastraDBMessage => message !== null);
      return result;
    }

    // Case 2: Exclude specific tools by name
    if (this.exclude.length > 0) {
      // Track excluded tool call IDs to also filter their results
      const excludedToolCallIds = new Set<string>();

      // First pass: identify excluded tool call IDs
      for (const message of messages) {
        const toolInvocations = getToolInvocations(message);
        for (const part of toolInvocations) {
          const invocationPart = part as unknown as V2ToolInvocationPart;
          const invocation = invocationPart.toolInvocation;

          // Track tool call IDs from both calls and results for excluded tools
          // This handles cases where only results exist (e.g., in test data)
          if (this.exclude.includes(invocation.toolName)) {
            excludedToolCallIds.add(invocation.toolCallId);
          }
        }
      }

      // Second pass: filter out excluded tool invocation parts
      const filteredMessages = messages
        .map(message => {
          if (!hasToolInvocations(message)) {
            return message;
          }

          if (typeof message.content === 'string') {
            return message;
          }

          if (!message.content?.parts) {
            return message;
          }

          // Filter out excluded tool invocation parts
          const filteredParts = message.content.parts.filter((part: any) => {
            if (part.type !== 'tool-invocation') {
              return true; // Keep non-tool parts
            }

            const invocationPart = part as unknown as V2ToolInvocationPart;
            const invocation = invocationPart.toolInvocation;

            // Exclude if it's a call for an excluded tool
            if (invocation.state === 'call' && this.exclude.includes(invocation.toolName)) {
              return false;
            }

            // Exclude if it's a result for an excluded tool call
            // This handles both cases: when there's a matching call, and when only results exist
            if (invocation.state === 'result' && excludedToolCallIds.has(invocation.toolCallId)) {
              return false;
            }

            // Also exclude results by tool name if no corresponding call exists (edge case in test data)
            if (invocation.state === 'result' && this.exclude.includes(invocation.toolName)) {
              return false;
            }

            return true; // Keep other tool invocations
          });

          // If no parts remain, remove the message entirely
          if (filteredParts.length === 0) {
            return null;
          }

          const updatedContent = {
            ...message.content,
            parts: filteredParts,
          };

          // Check if message has no parts and no text content
          // Note: For V2 messages, parts is the source of truth, not toolInvocations
          const hasNoToolParts = filteredParts.length === 0;
          const hasNoTextContent = !(getLegacyContent(updatedContent)?.trim() ?? '');

          // Only remove the message if it has no parts at all and no text content
          if (hasNoToolParts && hasNoTextContent) {
            return null;
          }

          return stripLegacyMessageFields({
            ...message,
            content: updatedContent,
          });
        })
        .filter((message): message is MastraDBMessage => message !== null);

      return filteredMessages;
    }

    // Case 3: Empty exclude array, return original messages
    return messages;
  }
}
