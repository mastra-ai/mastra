import { Tiktoken } from 'js-tiktoken/lite';
import type { TiktokenBPE } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';
import type { MastraMessageV2 } from '../../agent/message-list';
import type { TracingContext } from '../../ai-tracing/types';
import type { RuntimeContext } from '../../runtime-context';
import type { ChunkType } from '../../stream';
import type { Processor } from '../index';

/**
 * Configuration options for TokenLimiter processor
 */
export interface TokenLimiterOptions {
  /** Maximum number of tokens to allow */
  limit: number;
  /** Optional encoding to use (defaults to o200k_base which is used by gpt-4o) */
  encoding?: TiktokenBPE;
  /**
   * Strategy when token limit is reached:
   * - 'truncate': Stop emitting chunks (default)
   * - 'abort': Call abort() to stop the stream
   */
  strategy?: 'truncate' | 'abort';
  /**
   * Whether to count tokens from the beginning of the stream or just the current part
   * - 'cumulative': Count all tokens from the start (default)
   * - 'part': Only count tokens in the current part
   */
  countMode?: 'cumulative' | 'part';
}

/**
 * Output processor that limits the number of tokens in generated responses.
 * Implements both processOutputStream for streaming and processOutputResult for non-streaming.
 */
export class TokenLimiterProcessor implements Processor {
  public readonly name = 'token-limiter';
  private encoder: Tiktoken;
  private maxTokens: number;
  private currentTokens: number = 0;
  private strategy: 'truncate' | 'abort';
  private countMode: 'cumulative' | 'part';

  // Token counting constants for input processing
  private static readonly TOKENS_PER_MESSAGE = 3;
  private static readonly TOKENS_PER_CONVERSATION = 3;

  constructor(options: number | TokenLimiterOptions) {
    if (typeof options === 'number') {
      // Simple number format - just the token limit with default settings
      this.maxTokens = options;
      this.encoder = new Tiktoken(o200k_base);
      this.strategy = 'truncate';
      this.countMode = 'cumulative';
    } else {
      // Object format with all options
      this.maxTokens = options.limit;
      this.encoder = new Tiktoken(options.encoding || o200k_base);
      this.strategy = options.strategy || 'truncate';
      this.countMode = options.countMode || 'cumulative';
    }
  }

  /**
   * Process input messages to limit them to the configured token limit.
   * This filters historical messages to fit within the token budget,
   * prioritizing the most recent messages.
   */
  async processInput(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RuntimeContext;
  }): Promise<MastraMessageV2[]> {
    const { messages } = args;
    const limit = this.maxTokens;

    // If no messages or empty array, return as-is
    if (!messages || messages.length === 0) {
      return messages;
    }

    // Separate system messages from other messages
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system');

    // Calculate token count for system messages (always included)
    let systemTokens = TokenLimiterProcessor.TOKENS_PER_CONVERSATION;
    for (const msg of systemMessages) {
      systemTokens += this.countInputMessageTokens(msg);
    }

    // If system messages alone exceed the limit, return only system messages
    if (systemTokens >= limit) {
      return systemMessages;
    }

    // Calculate remaining budget for non-system messages
    const remainingBudget = limit - systemTokens;

    // Process non-system messages in reverse order (newest first)
    const result: MastraMessageV2[] = [];
    let currentTokens = 0;

    // Iterate through messages in reverse to prioritize recent messages
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      if (!message) continue;

      const messageTokens = this.countInputMessageTokens(message);

      if (currentTokens + messageTokens <= remainingBudget) {
        result.unshift(message); // Add to beginning to maintain order
        currentTokens += messageTokens;
      }
      // Continue checking all messages, don't break early
    }

    // Return system messages followed by the filtered non-system messages
    return [...systemMessages, ...result];
  }

  /**
   * Count tokens for an input message, including overhead for message structure
   */
  private countInputMessageTokens(message: MastraMessageV2): number {
    let tokenString = message.role;
    let overhead = 0;

    // Handle content based on MastraMessageV2 structure
    if (typeof message.content === 'string') {
      // Simple string content
      tokenString += message.content;
    } else if (message.content && typeof message.content === 'object') {
      // Object content with parts
      // Use content.content as the primary text, or fall back to parts
      if (message.content.content && !Array.isArray(message.content.parts)) {
        tokenString += message.content.content;
      } else if (Array.isArray(message.content.parts)) {
        // Calculate tokens for each content part
        for (const part of message.content.parts) {
          if (part.type === 'text') {
            tokenString += part.text;
          } else if (part.type === 'tool-invocation') {
            // Handle tool invocations (both calls and results)
            const invocation = part.toolInvocation;
            if (invocation.state === 'call' || invocation.state === 'partial-call') {
              // Tool call
              if (invocation.toolName) {
                tokenString += invocation.toolName;
              }
              if (invocation.args) {
                if (typeof invocation.args === 'string') {
                  tokenString += invocation.args;
                } else {
                  tokenString += JSON.stringify(invocation.args);
                  overhead -= 12; // Adjust for JSON overhead
                }
              }
            } else if (invocation.state === 'result') {
              // Tool result
              if (invocation.result !== undefined) {
                if (typeof invocation.result === 'string') {
                  tokenString += invocation.result;
                } else {
                  tokenString += JSON.stringify(invocation.result);
                  overhead -= 12; // Adjust for JSON overhead
                }
              }
            }
          } else {
            tokenString += JSON.stringify(part);
          }
        }
      }
    }

    // Add message formatting overhead for non-tool messages
    const hasNonToolParts = !message.content?.parts || message.content.parts.some(p => p.type !== 'tool-invocation');

    if (typeof message.content === 'string' || hasNonToolParts) {
      overhead += TokenLimiterProcessor.TOKENS_PER_MESSAGE;
    }

    return this.encoder.encode(tokenString).length + overhead;
  }

  async processOutputStream(args: {
    part: ChunkType;
    streamParts: ChunkType[];
    state: Record<string, any>;
    abort: (reason?: string) => never;
  }): Promise<ChunkType | null> {
    // Always process output streams (this is the main/original functionality)
    const { part, abort } = args;
    const limit = this.maxTokens;

    // Count tokens in the current part
    const chunkTokens = this.countTokensInChunk(part);

    if (this.countMode === 'cumulative') {
      // Add to cumulative count
      this.currentTokens += chunkTokens;
    } else {
      // Only check the current part
      this.currentTokens = chunkTokens;
    }

    // Check if we've exceeded the limit
    if (this.currentTokens > limit) {
      if (this.strategy === 'abort') {
        abort(`Token limit of ${limit} exceeded (current: ${this.currentTokens})`);
      } else {
        // truncate strategy - don't emit this part
        // If we're in part mode, reset the count for next part
        if (this.countMode === 'part') {
          this.currentTokens = 0;
        }
        return null;
      }
    }

    // Emit the part
    const result = part;

    // If we're in part mode, reset the count for next part
    if (this.countMode === 'part') {
      this.currentTokens = 0;
    }

    return result;
  }

  private countTokensInChunk(part: ChunkType): number {
    if (part.type === 'text-delta') {
      // For text chunks, count the text content directly
      return this.encoder.encode(part.payload.text).length;
    } else if (part.type === 'object') {
      // For object chunks, count the JSON representation
      // This is similar to how the memory processor handles object content
      const objectString = JSON.stringify(part.object);
      return this.encoder.encode(objectString).length;
    } else if (part.type === 'tool-call') {
      // For tool-call chunks, count tool name and args
      let tokenString = part.payload.toolName;
      if (part.payload.args) {
        if (typeof part.payload.args === 'string') {
          tokenString += part.payload.args;
        } else {
          tokenString += JSON.stringify(part.payload.args);
        }
      }
      return this.encoder.encode(tokenString).length;
    } else if (part.type === 'tool-result') {
      // For tool-result chunks, count the result
      let tokenString = '';
      if (part.payload.result !== undefined) {
        if (typeof part.payload.result === 'string') {
          tokenString += part.payload.result;
        } else {
          tokenString += JSON.stringify(part.payload.result);
        }
      }
      return this.encoder.encode(tokenString).length;
    } else {
      // For other part types, count the JSON representation
      return this.encoder.encode(JSON.stringify(part)).length;
    }
  }

  /**
   * Process the final result (non-streaming)
   * Truncates the text content if it exceeds the token limit
   */
  async processOutputResult(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
  }): Promise<MastraMessageV2[]> {
    // Always process output results (this is the main/original functionality)
    const { messages, abort } = args;
    const limit = this.maxTokens;

    // Reset token count for result processing
    this.currentTokens = 0;

    const processedMessages = messages.map(message => {
      if (message.role !== 'assistant' || !message.content?.parts) {
        return message;
      }

      const processedParts = message.content.parts.map(part => {
        if (part.type === 'text') {
          const textContent = part.text;
          const tokens = this.encoder.encode(textContent).length;

          // Check if adding this part's tokens would exceed the cumulative limit
          if (this.currentTokens + tokens <= limit) {
            this.currentTokens += tokens;
            return part;
          } else {
            if (this.strategy === 'abort') {
              abort(`Token limit of ${limit} exceeded (current: ${this.currentTokens + tokens})`);
            } else {
              // Truncate the text to fit within the remaining token limit
              let truncatedText = '';
              let currentTokens = 0;
              const remainingTokens = limit - this.currentTokens;

              // Find the cutoff point that fits within the remaining limit using binary search
              let left = 0;
              let right = textContent.length;
              let bestLength = 0;
              let bestTokens = 0;

              while (left <= right) {
                const mid = Math.floor((left + right) / 2);
                const testText = textContent.slice(0, mid);
                const testTokens = this.encoder.encode(testText).length;

                if (testTokens <= remainingTokens) {
                  // This length fits, try to find a longer one
                  bestLength = mid;
                  bestTokens = testTokens;
                  left = mid + 1;
                } else {
                  // This length is too long, try a shorter one
                  right = mid - 1;
                }
              }

              truncatedText = textContent.slice(0, bestLength);
              currentTokens = bestTokens;

              this.currentTokens += currentTokens;

              return {
                ...part,
                text: truncatedText,
              };
            }
          }
        }

        // For non-text parts, just return them as-is
        return part;
      });

      return {
        ...message,
        content: {
          ...message.content,
          parts: processedParts,
        },
      };
    });

    return processedMessages;
  }

  /**
   * Reset the token counter (useful for testing or reusing the processor)
   */
  reset(): void {
    this.currentTokens = 0;
  }

  /**
   * Get the current token count
   */
  getCurrentTokens(): number {
    return this.currentTokens;
  }

  /**
   * Get the maximum token limit
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }
}
