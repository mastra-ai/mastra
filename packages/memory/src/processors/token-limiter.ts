import type { CoreMessage, MemoryProcessorOpts } from '@mastra/core';
import { MemoryProcessor } from '@mastra/core/memory';
import { Tiktoken } from 'js-tiktoken/lite';
import type { TiktokenBPE } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

/**
 * Configuration options for TokenLimiter
 */
interface TokenLimiterOptions {
  /** Maximum number of tokens to allow */
  limit: number;
  /** Optional encoding to use (defaults to o200k_base which is used by gpt-4o) */
  encoding?: TiktokenBPE;
}

/**
 * Limits the total number of tokens in the messages.
 * Uses js-tiktoken with o200k_base encoding by default for accurate token counting with modern models.
 */
export class TokenLimiter extends MemoryProcessor {
  private encoder: Tiktoken;
  private maxTokens: number;

  // Token overheads per OpenAI's documentation
  // See: https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken#6-counting-tokens-for-chat-completions-api-calls
  // Every message follows <|start|>{role/name}\n{content}<|end|>
  public TOKENS_PER_MESSAGE = 3; // tokens added for each message (start & end tokens)
  public TOKENS_PER_TOOL = 2; // empirical adjustment for tool calls
  public TOKENS_PER_CONVERSATION = 25; // fixed overhead for the conversation

  /**
   * Create a token limiter for messages.
   * @param options Either a number (token limit) or a configuration object
   */
  constructor(options: number | TokenLimiterOptions) {
    super({
      name: 'TokenLimiter',
    });

    if (typeof options === 'number') {
      // Simple number format - just the token limit with default encoding
      this.maxTokens = options;
      this.encoder = new Tiktoken(o200k_base);
    } else {
      // Object format with limit and optional encoding
      this.maxTokens = options.limit;
      this.encoder = new Tiktoken(options.encoding || o200k_base);
    }
  }

  process(
    messages: CoreMessage[],
    { systemMessage, memorySystemMessage, newMessages }: MemoryProcessorOpts = {},
  ): CoreMessage[] {
    // Messages are already chronologically ordered - take most recent ones up to the token limit
    let totalTokens = 0;

    // Start with the conversation overhead
    totalTokens += this.TOKENS_PER_CONVERSATION;

    if (systemMessage) {
      totalTokens += this.countTokens(systemMessage);
      totalTokens += this.TOKENS_PER_MESSAGE; // Add message overhead for system message
    }

    if (memorySystemMessage) {
      totalTokens += this.countTokens(memorySystemMessage);
      totalTokens += this.TOKENS_PER_MESSAGE; // Add message overhead for memory system message
    }

    const allMessages = [...messages, ...(newMessages || [])];

    const result: CoreMessage[] = [];

    // Process messages in reverse (newest first)
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const message = allMessages[i];

      // Skip undefined messages (shouldn't happen, but TypeScript is concerned)
      if (!message) continue;

      const messageTokens = this.countTokens(message);

      if (totalTokens + messageTokens <= this.maxTokens) {
        // Insert at the beginning to maintain chronological order
        result.unshift(message);
        totalTokens += messageTokens;
      } else {
        this.logger.info(
          `filtering ${allMessages.length - result.length}/${allMessages.length} messages, token limit of ${this.maxTokens} exceeded`,
        );
        // If we can't fit the message, we stop
        break;
      }
    }

    return result;
  }

  public countTokens(message: string | CoreMessage): number {
    if (typeof message === `string`) {
      return this.encoder.encode(message).length;
    }

    let tokenString = message.role;

    if (typeof message.content === 'string') {
      tokenString += message.content;
    } else if (Array.isArray(message.content)) {
      // Calculate tokens for each content part
      for (const part of message.content) {
        tokenString += part.type;
        if (part.type === 'text') {
          tokenString += part.text;
        } else if (part.type === 'tool-call') {
          tokenString += part.toolName as any;
          if (part.args) {
            tokenString += typeof part.args === 'string' ? part.args : JSON.stringify(part.args);
          }
        } else if (part.type === 'tool-result') {
          // Token cost for result if present
          if (part.result !== undefined) {
            tokenString += typeof part.result === 'string' ? part.result : JSON.stringify(part.result);
          }
        } else {
          tokenString += JSON.stringify(part);
        }
      }
    }

    // Ensure we account for message formatting tokens
    // See: https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken#6-counting-tokens-for-chat-completions-api-calls
    const messageOverhead = this.TOKENS_PER_MESSAGE;

    // Count tool calls for additional overhead
    let toolOverhead = 0;
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'tool-call' || part.type === 'tool-result') {
          toolOverhead += this.TOKENS_PER_TOOL;
        }
      }
    }

    const totalMessageOverhead = messageOverhead + toolOverhead;

    return this.encoder.encode(tokenString).length + totalMessageOverhead;
  }
}
