import type { CoreMessage } from '@mastra/core';
import { MDocument } from '@mastra/rag';
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
          return !message.content.some(part => part.type === 'tool-call' || part.type === 'tool-result');
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
          content: filteredContent,
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
 * Uses MDocument from @mastra/rag with cl100k_base encoding for accurate token counting.
 * This encoding is used by all modern OpenAI models (GPT-3.5, GPT-4, etc).
 */
export class TokenLimiter implements MessageProcessor {
  /**
   * Create a token limiter for messages.
   * @param maxTokens Maximum number of tokens to allow
   */
  constructor(private maxTokens: number) {}

  async process(messages: CoreMessage[]): Promise<CoreMessage[]> {
    // Messages are already chronologically ordered - take most recent ones up to the token limit
    let totalTokens = 0;
    const result: CoreMessage[] = [];

    // Process messages in reverse (newest first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      // Skip undefined messages (shouldn't happen, but TypeScript is concerned)
      if (!message) continue;

      const messageTokens = await this.estimateTokens(message);

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

  private async estimateTokens(message: CoreMessage): Promise<number> {
    // Base cost for message metadata (role, etc.)
    let tokenCount = 4; // Every message starts with role and potential metadata

    if (typeof message.content === 'string') {
      // Count tokens for string content
      tokenCount += await this.countTokens(message.content);
    } else if (Array.isArray(message.content)) {
      // Calculate tokens for each content part
      for (const part of message.content) {
        // Base cost for each part's type and metadata
        tokenCount += 3;

        if (part.type === 'text') {
          tokenCount += await this.countTokens((part as TextPart).text);
        } else if (part.type === 'tool-call') {
          // Token cost for tool name
          const toolCall = part as unknown as ToolCall & { args?: any };
          tokenCount += await this.countTokens(toolCall.name);

          // Token cost for args if present
          if (toolCall.args) {
            tokenCount += await this.countTokens(
              typeof toolCall.args === 'string' ? toolCall.args : JSON.stringify(toolCall.args),
            );
          }
        } else if (part.type === 'tool-result') {
          // Token cost for tool result
          const toolResult = part as unknown as ToolResult & { result?: any };
          if (toolResult.result) {
            tokenCount += await this.countTokens(
              typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result),
            );
          }
        } else {
          // Other content types (image, etc.)
          tokenCount += 10; // Base estimate for unknown types
        }
      }
    }

    return tokenCount;
  }

  /**
   * Counts tokens in text using MDocument's chunking functionality
   */
  private async countTokens(text: string): Promise<number> {
    // For empty strings, return 0 tokens
    if (!text || text.length === 0) {
      return 0;
    }

    // Use MDocument to create a document
    const doc = MDocument.fromText(text);

    // Chunk it with token strategy and size of 1 to get the exact token count
    const chunks = await doc.chunk({
      strategy: 'token',
      encodingName: 'cl100k_base',
      size: 1, // Setting chunk size to 1 token will tell us exactly how many tokens
      overlap: 0,
    });

    // The number of chunks is the token count
    return chunks.length;
  }
}
