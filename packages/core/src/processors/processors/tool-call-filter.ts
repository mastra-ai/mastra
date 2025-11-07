import type { MastraDBMessage } from '../../agent/message-list';
import type { RequestContext } from '../../request-context';

import type { InputProcessor } from '../index';

/**
 * Filters out tool calls and results from messages.
 * By default (with no arguments), excludes all tool calls and their results.
 * Can be configured to exclude only specific tools by name.
 */
export class ToolCallFilter implements InputProcessor {
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
    abort: (reason?: string) => never;
    runtimeContext?: RequestContext;
  }): Promise<MastraDBMessage[]> {
    const { messages } = args;

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

          // Return message with filtered parts
          // Also filter toolInvocations if present
          const { toolInvocations: originalToolInvocations, ...contentWithoutToolInvocations } = message.content as any;
          const updatedContent: any = {
            ...contentWithoutToolInvocations,
            parts: nonToolParts,
          };

          // Don't include toolInvocations since we're excluding all tools
          // (already excluded by destructuring above)

          return {
            ...message,
            content: updatedContent,
          };
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
          const invocationPart = part as unknown as V2ToolInvocationPart;
          const invocation = invocationPart.toolInvocation;

          // Track tool call IDs only from excluded tool calls (not results)
          // This ensures we only exclude results if we've seen the corresponding call
          if (invocation.state === 'call' && this.exclude.includes(invocation.toolName)) {
            excludedToolCallIds.add(invocation.toolCallId);
          }
        }
      }

      // Second pass: filter out excluded tool invocation parts
      return messages
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
            const invocationPart = part as unknown as V2ToolInvocationPart;
            const invocation = invocationPart.toolInvocation;

            // Exclude if it's a call for an excluded tool
            if (invocation.state === 'call' && this.exclude.includes(invocation.toolName)) {
              return false;
            }

            // Exclude if it's a result for an excluded tool call
            if (invocation.state === 'result' && excludedToolCallIds.has(invocation.toolCallId)) {
              return false;
            }

            return true; // Keep other tool invocations
          });

          // If no parts remain, remove the message entirely
          if (filteredParts.length === 0) {
            return null;
          }

          // Return message with filtered parts
          // Also filter toolInvocations if present
          const { toolInvocations: originalToolInvocations, ...contentWithoutToolInvocations } = message.content as any;
          const updatedContent: any = {
            ...contentWithoutToolInvocations,
            parts: filteredParts,
          };

          // Filter toolInvocations array if it exists
          if ('toolInvocations' in message.content && Array.isArray((message.content as any).toolInvocations)) {
            const filteredToolInvocations = (message.content as any).toolInvocations.filter(
              (inv: any) => !this.exclude.includes(inv.toolName),
            );
            if (filteredToolInvocations.length > 0) {
              updatedContent.toolInvocations = filteredToolInvocations;
            }
            // If no tool invocations remain, don't include the field (already excluded by destructuring)
          }

          // Check if message has no parts and no text content
          // Note: For V2 messages, parts is the source of truth, not toolInvocations
          const hasNoToolParts = filteredParts.length === 0;
          const hasNoTextContent = !updatedContent.content || updatedContent.content.trim() === '';

          // Only remove the message if it has no parts at all and no text content
          if (hasNoToolParts && hasNoTextContent) {
            return null;
          }

          return {
            ...message,
            content: updatedContent,
          };
        })
        .filter((message): message is MastraDBMessage => message !== null);
    }

    // Case 3: Empty exclude array, return original messages
    return messages;
  }
}
