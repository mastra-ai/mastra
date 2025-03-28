import type { CoreMessage } from '@mastra/core';
import { MemoryProcessor } from '@mastra/core';

/**
 * Filters out tool calls and results from messages.
 * By default (with no arguments), excludes all tool calls and their results.
 * Can be configured to exclude only specific tools by name.
 */
export class ToolCallFilter extends MemoryProcessor {
  private exclude: string[] | 'all';

  /**
   * Create a filter for tool calls and results.
   * @param options Configuration options
   * @param options.exclude List of specific tool names to exclude. If not provided, all tool calls are excluded.
   */
  constructor(options: { exclude?: string[] } = {}) {
    super({ name: 'ToolCallFilter' });
    // If no options or exclude is provided, exclude all tools
    if (!options || !options.exclude) {
      this.exclude = 'all'; // Exclude all tools
    } else {
      // Exclude specific tools
      this.exclude = Array.isArray(options.exclude) ? options.exclude : [];
    }
  }

  process(messages: CoreMessage[]): CoreMessage[] {
    // Case 1: Exclude all tool calls and tool results
    if (this.exclude === 'all') {
      return messages.filter(message => {
        if (Array.isArray(message.content)) {
          return !message.content.some(part => part.type === 'tool-call' || part.type === 'tool-result');
        }
        return true;
      });
    }

    // Case 2: Exclude specific tools by name
    if (this.exclude.length > 0) {
      // Single pass approach - track excluded tool call IDs while filtering
      const excludedToolCallIds = new Set<string>();

      return messages.filter(message => {
        if (!Array.isArray(message.content)) return true;

        // For assistant messages, check for excluded tool calls and track their IDs
        if (message.role === 'assistant') {
          let shouldExclude = false;

          for (const part of message.content) {
            if (part.type === 'tool-call' && this.exclude.includes(part.toolName)) {
              excludedToolCallIds.add(part.toolCallId);
              shouldExclude = true;
            }
          }

          return !shouldExclude;
        }

        // For tool messages, filter out results for excluded tool calls
        if (message.role === 'tool') {
          const shouldExclude = message.content.some(
            part => part.type === 'tool-result' && excludedToolCallIds.has(part.toolCallId),
          );

          return !shouldExclude;
        }

        return true;
      });
    }

    // Case 3: Empty exclude array, return original messages
    return messages;
  }
}
