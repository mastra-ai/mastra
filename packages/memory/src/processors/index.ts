import type { CoreMessage } from '@mastra/core';
import { Tiktoken } from 'js-tiktoken/lite';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';
import type { MessageProcessor } from '../index';

interface TextPart {
  type: 'text';
  text: string;
}

// Note: These interfaces are for type checking only, we'll use type assertions with 'unknown'
interface ToolCall {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
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
              const toolCall = part as unknown as ToolCall;
              if (this.exclude!.includes(toolCall.toolName)) {
                excludedToolCallIds.push(toolCall.toolCallId);
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

/**
 * Limits the total number of tokens in the messages.
 * Uses js-tiktoken with cl100k_base encoding for accurate token counting.
 * This encoding is used by all modern OpenAI models (GPT-3.5, GPT-4, etc).
 */
export class TokenLimiter implements MessageProcessor {
  /**
   * Create a token limiter for messages.
   * @param maxTokens Maximum number of tokens to allow
   */
  constructor(private maxTokens: number) {}

  process(messages: CoreMessage[]): CoreMessage[] {
    // Messages are already chronologically ordered - take most recent ones up to the token limit
    let totalTokens = 0;
    const result: CoreMessage[] = [];

    const encoder = new Tiktoken(cl100k_base);

    // Process messages in reverse (newest first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      // Skip undefined messages (shouldn't happen, but TypeScript is concerned)
      if (!message) continue;

      const messageTokens = this.countTokens(message, encoder);

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

  private countTokens(message: CoreMessage, encoder: Tiktoken): number {
    // Base cost for message metadata (role, etc.)
    let tokenCount = 4; // Every message starts with role and potential metadata

    if (typeof message.content === 'string') {
      // Count tokens for string content using the encoder
      tokenCount += encoder.encode(message.content || '').length;
    } else if (Array.isArray(message.content)) {
      // Calculate tokens for each content part
      for (const part of message.content) {
        if (!part) continue; // Skip null/undefined parts

        // Base cost for each part's type and metadata
        tokenCount += 3;

        if (part.type === 'text') {
          // Text content
          const text = (part as TextPart).text;
          tokenCount += encoder.encode(text || '').length;
        } else if (part.type === 'tool-call') {
          // Tool calls have name, args, etc.
          const toolCall = part as unknown as ToolCall & { args?: any };

          // Token cost for tool name
          if (toolCall.toolName) {
            tokenCount += encoder.encode(toolCall.toolName).length;
          }

          // Token cost for args if present
          if (toolCall.args) {
            const argsString = typeof toolCall.args === 'string' ? toolCall.args : JSON.stringify(toolCall.args);
            tokenCount += encoder.encode(argsString || '').length;
          }
        } else if (part.type === 'tool-result') {
          // Tool results can be large
          const toolResult = part as unknown as ToolResult & { result?: any };

          // Token cost for result if present
          if (toolResult.result !== undefined) {
            const resultString =
              typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result);
            tokenCount += encoder.encode(resultString || '').length;
          }
        } else {
          // Other content types (image, etc.) - flat cost
          tokenCount += 10;
        }
      }
    }

    return tokenCount;
  }
}
