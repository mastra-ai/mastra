import type { MastraMessageV2 } from '../../message';
import type { RuntimeContext } from '../../runtime-context';

import type { InputProcessor } from '../types';

/**
 * Filters out tool calls and results from messages.
 * By default (with no arguments), excludes all tool calls and their results.
 * Can be configured to exclude only specific tools by name.
 */
export class ToolCallFilter implements InputProcessor {
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
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
    runtimeContext?: RuntimeContext;
  }): Promise<MastraMessageV2[]> {
    const { messages } = args;

    // Case 1: Exclude all tool calls and tool results
    if (this.exclude === 'all') {
      return messages.filter(message => {
        // For assistant messages with tool_calls
        if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
          return false;
        }
        // For tool result messages
        if (message.role === 'tool') {
          return false;
        }
        return true;
      });
    }

    // Case 2: Exclude specific tools by name
    if (this.exclude.length > 0) {
      // Single pass approach - track excluded tool call IDs while filtering
      const excludedToolCallIds = new Set<string>();

      return messages.filter(message => {
        // For assistant messages, check for excluded tool calls and track their IDs
        if (message.role === 'assistant' && message.tool_calls) {
          let shouldExclude = false;

          for (const toolCall of message.tool_calls) {
            if (this.exclude.includes(toolCall.toolName)) {
              excludedToolCallIds.add(toolCall.toolCallId);
              shouldExclude = true;
            }
          }

          return !shouldExclude;
        }

        // For tool messages, filter out results for excluded tool calls
        if (message.role === 'tool') {
          const shouldExclude = excludedToolCallIds.has(message.toolCallId || '');
          return !shouldExclude;
        }

        return true;
      });
    }

    // Case 3: Empty exclude array, return original messages
    return messages;
  }
}
