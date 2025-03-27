import type { CoreMessage, MessageProcessor } from '@mastra/core';

/**
 * Filters out tool calls and results from messages.
 * By default (with no arguments), excludes all tool calls and their results.
 * Can be configured to exclude only specific tools by name.
 */
export class ToolCallFilter implements MessageProcessor {
  private exclude: string[] | 'all';

  /**
   * Create a filter for tool calls and their results.
   * @param options Configuration options
   * @param options.exclude List of specific tool names to exclude. If not provided, all tool calls are excluded.
   */
  constructor(options?: { exclude?: string[] }) {
    // If no options or exclude is provided, exclude all tools
    if (!options || !options.exclude) {
      this.exclude = 'all'; // null means exclude all tools
    } else {
      // Exclude specific tools
      this.exclude = Array.isArray(options.exclude) ? options.exclude : [];
    }
  }

  process(messages: CoreMessage[]): CoreMessage[] {
    if (this.exclude === 'all') {
      // Exclude all tool calls and results
      return messages.filter(message => {
        // Skip any message that has tool-call or tool-result content
        if (Array.isArray(message.content)) {
          return !message.content.some(part => part.type === 'tool-call' || part.type === 'tool-result');
        }
        return true;
      });
    }

    if (this.exclude.length > 0) {
      // First identify tool calls to exclude by name
      const excludedToolCallIds: string[] = [];

      messages.forEach(message => {
        if (Array.isArray(message.content)) {
          message.content.forEach(part => {
            if (part.type === 'tool-call') {
              if (this.exclude!.includes(part.toolName)) {
                excludedToolCallIds.push(part.toolCallId);
              }
            }
          });
        }
      });

      // Now filter out messages with excluded tool calls or their results
      return messages.filter(message => {
        // Filter out tool-call messages that contain excluded tools
        if (message.role === 'assistant' && Array.isArray(message.content)) {
          const hasExcludedTool = message.content.some(part => {
            return part.type === 'tool-call' && this.exclude.includes(part.toolName);
          });

          return !hasExcludedTool;
        }

        // Filter out tool-result messages for excluded tool calls
        if (message.role === 'tool' && Array.isArray(message.content)) {
          const isForExcludedTool = message.content.some(part => {
            return part.type === 'tool-result' && excludedToolCallIds.includes(part.toolCallId);
          });

          return !isForExcludedTool;
        }

        // Keep messages without excluded tool content
        return true;
      });
    }

    // Empty exclude array, return original messages
    return messages;
  }
}
