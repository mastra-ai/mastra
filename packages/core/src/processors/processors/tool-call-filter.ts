import type { MastraMessageV2 } from '../../agent/message-list';
import type { RuntimeContext } from '../../runtime-context';

import type { InputProcessor } from '../index';

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

    // Helper to check if a message has tool invocations
    const hasToolInvocations = (message: MastraMessageV2): boolean => {
      if (typeof message.content === 'string') return false;
      if (!message.content?.parts) return false;
      return message.content.parts.some(part => part.type === 'tool-invocation');
    };

    // Helper to get tool invocations from a message
    const getToolInvocations = (message: MastraMessageV2) => {
      if (typeof message.content === 'string') return [];
      if (!message.content?.parts) return [];
      return message.content.parts.filter(part => part.type === 'tool-invocation');
    };

    // Case 1: Exclude all tool calls and tool results
    if (this.exclude === 'all') {
      return messages.filter(message => {
        // Exclude messages with tool invocations
        return !hasToolInvocations(message);
      });
    }

    // Case 2: Exclude specific tools by name
    if (this.exclude.length > 0) {
      // Single pass approach - track excluded tool call IDs while filtering
      const excludedToolCallIds = new Set<string>();

      return messages.filter(message => {
        const toolInvocations = getToolInvocations(message);

        if (toolInvocations.length === 0) {
          return true; // Keep messages without tool invocations
        }

        let shouldExclude = false;

        for (const part of toolInvocations) {
          const invocation = part.toolInvocation;

          // Check if this is a tool call (not a result) and if it's in the exclude list
          if (
            (invocation.state === 'call' || invocation.state === 'partial-call') &&
            this.exclude.includes(invocation.toolName)
          ) {
            excludedToolCallIds.add(invocation.toolCallId);
            shouldExclude = true;
          }

          // Check if this is a result for an excluded tool call
          if (invocation.state === 'result' && excludedToolCallIds.has(invocation.toolCallId)) {
            shouldExclude = true;
          }
        }

        return !shouldExclude;
      });
    }

    // Case 3: Empty exclude array, return original messages
    return messages;
  }
}
