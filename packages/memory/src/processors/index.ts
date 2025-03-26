import type { CoreMessage } from '@mastra/core';
import type { MessageProcessor } from '../index';

interface TextPart {
  type: 'text';
  text: string;
}

// Note: These interfaces are for type checking only, we'll use type assertions with 'unknown'
interface ToolCall {
  type: 'tool-call';
  id: string;
  name: string;
}

interface ToolResult {
  type: 'tool-result';
  toolCallId: string;
}

/**
 * Filters out tool calls and results from messages.
 * By default (with no arguments), excludes all tool calls and their results.
 * Can be configured to exclude only specific tools by name.
 */
export class ToolCallFilter implements MessageProcessor {
  private exclude: string[] | null;

  /**
   * Create a filter for tool calls and their results.
   * @param options Configuration options
   * @param options.exclude List of specific tool names to exclude. If not provided, all tool calls are excluded.
   */
  constructor(options?: { exclude?: string[] }) {
    // If no options or exclude is provided, exclude all tools
    if (!options || !options.exclude) {
      this.exclude = null; // null means exclude all tools
    } else {
      // Exclude specific tools
      this.exclude = Array.isArray(options.exclude) ? options.exclude : [];
    }
  }

  process(messages: CoreMessage[]): CoreMessage[] {
    if (this.exclude === null) {
      // Exclude all tool calls and results
      return messages.filter(message => {
        if (Array.isArray(message.content)) {
          return !message.content.some(part => 
            part.type === 'tool-call' || part.type === 'tool-result'
          );
        }
        return true;
      });
    } else if (this.exclude.length > 0) {
      // Filter out specific tool calls and their results
      const processedMessages = messages.map(message => {
        if (!Array.isArray(message.content)) {
          return message;
        }

        // Find IDs of tool calls to exclude
        const excludedToolCallIds: string[] = [];
        message.content.forEach(part => {
          if (part.type === 'tool-call') {
            const toolCall = part as unknown as ToolCall;
            if (this.exclude!.includes(toolCall.name)) {
              excludedToolCallIds.push(toolCall.id);
            }
          }
        });

        // Filter out the excluded tool calls and their results
        const filteredContent = message.content.filter(part => {
          if (part.type === 'tool-call') {
            const toolCall = part as unknown as ToolCall;
            return !this.exclude!.includes(toolCall.name);
          }
          if (part.type === 'tool-result') {
            const toolResult = part as unknown as ToolResult;
            return !excludedToolCallIds.includes(toolResult.toolCallId);
          }
          return true;
        });

        // Create a copy of the message with the filtered content
        return {
          ...message,
          content: filteredContent
        };
      });

      // Filter out any messages that now have empty content
      return processedMessages.filter(message => {
        if (Array.isArray(message.content)) {
          return message.content.length > 0;
        }
        return true;
      }) as CoreMessage[];
    }

    // Empty exclude array, return original messages
    return messages;
  }
}

/**
 * Limits the total number of tokens in the messages.
 * Uses a simple approximation for token counting if tokensPerMessage is not provided.
 */
export class TokenLimiter implements MessageProcessor {
  constructor(private maxTokens: number, private tokensPerMessage?: (message: CoreMessage) => number) {}

  process(messages: CoreMessage[]): CoreMessage[] {
    // Messages are already chronologically ordered - take most recent ones up to the token limit
    let totalTokens = 0;
    const result: CoreMessage[] = [];
    
    // Process messages in reverse (newest first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      
      // Skip undefined messages (shouldn't happen, but TypeScript is concerned)
      if (!message) continue;
      
      const messageTokens = this.tokensPerMessage
        ? this.tokensPerMessage(message)
        : this.estimateTokens(message);
      
      if (totalTokens + messageTokens <= this.maxTokens) {
        // Insert at the beginning to maintain chronological order
        result.unshift(message);
        totalTokens += messageTokens;
      } else {
        // If we can't fit the message, we stop
        break;
      }
    }
    
    return result;
  }
  
  private estimateTokens(message: CoreMessage): number {
    // Simple approximation: ~4 chars per token
    if (typeof message.content === 'string') {
      return Math.ceil(message.content.length / 4);
    } else if (Array.isArray(message.content)) {
      return Math.ceil(
        message.content.reduce((sum, part) => {
          if (part.type === 'text') {
            return sum + (part as TextPart).text.length / 4;
          }
          // Assume non-text content has a fixed token cost
          return sum + 20;
        }, 0)
      );
    }
    return 0;
  }
} 