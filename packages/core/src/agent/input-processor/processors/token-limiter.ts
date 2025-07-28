import { Tiktoken } from 'js-tiktoken/lite';
import type { TiktokenBPE } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';
import type { MastraMessageV2 } from '../../message-list';
import type { InputProcessor } from '../index';

/**
 * Configuration options for TokenLimiterInputProcessor
 */
export interface TokenLimiterOptions {
  /** Maximum number of tokens to allow for input messages */
  limit: number;
  /** Optional encoding to use (defaults to o200k_base which is used by gpt-4o) */
  encoding?: TiktokenBPE;
  /**
   * Strategy when token limit is exceeded:
   * - 'truncate': Remove oldest messages (default)
   * - 'reject': Reject the entire input with an error
   */
  strategy?: 'truncate' | 'reject';
}

/**
 * TokenLimiterInputProcessor limits the total number of tokens in input messages
 * to prevent DoS attacks and unbounded consumption.
 *
 * Uses js-tiktoken with o200k_base encoding by default for accurate token counting
 * with modern models like GPT-4.
 */
export class TokenLimiterInputProcessor implements InputProcessor {
  readonly name = 'token-limiter';

  private encoder: Tiktoken;
  private maxTokens: number;
  private strategy: 'truncate' | 'reject';

  // Token overheads per OpenAI's documentation
  // See: https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken#6-counting-tokens-for-chat-completions-api-calls
  // Every message follows <|start|>{role/name}\n{content}<|end|>
  private static readonly TOKENS_PER_MESSAGE = 3.8; // tokens added for each message (start & end tokens)
  private static readonly TOKENS_PER_CONVERSATION = 24; // fixed overhead for the conversation

  /**
   * Create a token limiter for input messages.
   * @param options Either a number (token limit) or a configuration object
   */
  constructor(options: number | TokenLimiterOptions) {
    if (typeof options === 'number') {
      // Simple number format - just the token limit with default encoding and strategy
      this.maxTokens = options;
      this.encoder = new Tiktoken(o200k_base);
      this.strategy = 'truncate';
    } else {
      // Object format with limit and optional encoding/strategy
      this.maxTokens = options.limit;
      this.encoder = new Tiktoken(options.encoding || o200k_base);
      this.strategy = options.strategy || 'truncate';
    }
  }

  process(args: { messages: MastraMessageV2[]; abort: (reason?: string) => never }): MastraMessageV2[] {
    try {
      const { messages, abort } = args;

      if (messages.length === 0) {
        return messages;
      }

      // Calculate total tokens including conversation overhead
      let totalTokens = TokenLimiterInputProcessor.TOKENS_PER_CONVERSATION;
      const messageTokenCounts: number[] = [];

      // Calculate tokens for each message
      for (const message of messages) {
        const messageTokens = this.countTokens(message);
        messageTokenCounts.push(messageTokens);
        totalTokens += messageTokens;
      }

      // If within limits, return all messages
      if (totalTokens <= this.maxTokens) {
        return messages;
      }

      // Handle exceeding limits based on strategy
      if (this.strategy === 'reject') {
        abort(
          `Input exceeds token limit: ${totalTokens} > ${this.maxTokens} tokens. Consider reducing input length or using 'truncate' strategy.`,
        );
      }

      // Truncate strategy: keep newest messages that fit within limit
      const result: MastraMessageV2[] = [];
      let currentTokens = TokenLimiterInputProcessor.TOKENS_PER_CONVERSATION;

      // Process messages in reverse order (newest first)
      for (let i = messages.length - 1; i >= 0; i--) {
        const messageTokens = messageTokenCounts[i];
        const message = messages[i];

        if (messageTokens !== undefined && message !== undefined && currentTokens + messageTokens <= this.maxTokens) {
          result.unshift(message); // Insert at beginning to maintain chronological order
          currentTokens += messageTokens;
        } else {
          // Can't fit this message, stop processing older ones
          break;
        }
      }

      const filteredCount = messages.length - result.length;
      if (filteredCount > 0) {
        console.warn(
          `[TokenLimiterInputProcessor] Filtered ${filteredCount}/${messages.length} input messages due to token limit (${totalTokens} > ${this.maxTokens} tokens)`,
        );
      }

      return result;
    } catch (error) {
      args.abort(`Token limiting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Count tokens in a MastraMessageV2
   */
  public countTokens(message: MastraMessageV2): number {
    let tokenString = message.role;
    let overhead = TokenLimiterInputProcessor.TOKENS_PER_MESSAGE;

    // Handle content field (legacy support)
    if (typeof message.content.content === 'string' && message.content.content) {
      tokenString += message.content.content;
    }

    // Process parts array
    if (message.content.parts && Array.isArray(message.content.parts)) {
      for (const part of message.content.parts) {
        if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
          tokenString += part.text;
        } else if (part.type === 'tool-invocation' && 'toolName' in part) {
          // Handle tool invocations
          tokenString += (part as any).toolName || '';
          if ('args' in part && part.args) {
            if (typeof part.args === 'string') {
              tokenString += part.args;
            } else {
              tokenString += JSON.stringify(part.args);
              // Subtract some tokens for JSON formatting overhead
              overhead -= 12;
            }
          }
          if ('result' in part && part.result !== undefined) {
            if (typeof part.result === 'string') {
              tokenString += part.result;
            } else {
              tokenString += JSON.stringify(part.result);
              // Subtract some tokens for JSON formatting overhead
              overhead -= 12;
            }
          }
        } else {
          // For other part types, serialize as JSON
          tokenString += JSON.stringify(part);
        }
      }
    }

    return this.encoder.encode(tokenString).length + overhead;
  }
}
