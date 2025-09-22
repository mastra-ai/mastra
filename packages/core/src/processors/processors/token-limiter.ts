import { Tiktoken } from 'js-tiktoken/lite';
import type { TiktokenBPE } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';
import type { MastraMessageV2 } from '../../agent/message-list';
import type { ChunkType } from '../../stream';
import type { Processor } from '../index';

/**
 * Configuration options for TokenLimiter output processor
 */
export interface TokenLimiterOptions {
  /** Maximum number of tokens to allow in the response */
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

  async processOutputStream(args: {
    part: ChunkType;
    streamParts: ChunkType[];
    state: Record<string, any>;
    abort: (reason?: string) => never;
  }): Promise<ChunkType | null> {
    const { part, abort } = args;

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
    if (this.currentTokens > this.maxTokens) {
      if (this.strategy === 'abort') {
        abort(`Token limit of ${this.maxTokens} exceeded (current: ${this.currentTokens})`);
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
    const { messages, abort } = args;
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
          if (this.currentTokens + tokens <= this.maxTokens) {
            this.currentTokens += tokens;
            return part;
          } else {
            if (this.strategy === 'abort') {
              abort(`Token limit of ${this.maxTokens} exceeded (current: ${this.currentTokens + tokens})`);
            } else {
              // Truncate the text to fit within the remaining token limit
              let truncatedText = '';
              let currentTokens = 0;
              const remainingTokens = this.maxTokens - this.currentTokens;

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
