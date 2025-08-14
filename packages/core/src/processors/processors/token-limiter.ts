import type { TextStreamPart, ObjectStreamPart } from 'ai';
import { Tiktoken } from 'js-tiktoken/lite';
import type { TiktokenBPE } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';
import type { MastraMessageV2 } from '../../agent/message-list';

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
   * Whether to count tokens from the beginning of the stream or just the current chunk
   * - 'cumulative': Count all tokens from the start (default)
   * - 'chunk': Only count tokens in the current chunk
   */
  countMode?: 'cumulative' | 'chunk';
}

/**
 * Output processor that limits the number of tokens in generated responses.
 * Implements both processOutputStream for streaming and processOutputResult for non-streaming.
 */
export class TokenLimiterProcessor {
  public readonly name = 'token-limiter';
  private encoder: Tiktoken;
  private maxTokens: number;
  private currentTokens: number = 0;
  private strategy: 'truncate' | 'abort';
  private countMode: 'cumulative' | 'chunk';

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

  async processOutputStream(
    chunk: TextStreamPart<any> | ObjectStreamPart<any>,
    abort: (reason?: string) => never,
  ): Promise<TextStreamPart<any> | ObjectStreamPart<any> | null> {
    // Count tokens in the current chunk
    const chunkTokens = this.countTokensInChunk(chunk);

    if (this.countMode === 'cumulative') {
      // Add to cumulative count
      this.currentTokens += chunkTokens;
    } else {
      // Only check the current chunk
      this.currentTokens = chunkTokens;
    }

    // Check if we've exceeded the limit
    if (this.currentTokens > this.maxTokens) {
      if (this.strategy === 'abort') {
        abort(`Token limit of ${this.maxTokens} exceeded (current: ${this.currentTokens})`);
      } else {
        // truncate strategy - don't emit this chunk
        // If we're in chunk mode, reset the count for next chunk
        if (this.countMode === 'chunk') {
          this.currentTokens = 0;
        }
        return null;
      }
    }

    // Emit the chunk
    const result = chunk;

    // If we're in chunk mode, reset the count for next chunk
    if (this.countMode === 'chunk') {
      this.currentTokens = 0;
    }

    return result;
  }

  private countTokensInChunk(chunk: TextStreamPart<any> | ObjectStreamPart<any>): number {
    if (chunk.type === 'text-delta') {
      // For text chunks, count the text content directly
      return this.encoder.encode(chunk.textDelta).length;
    } else if (chunk.type === 'object') {
      // For object chunks, count the JSON representation
      // This is similar to how the memory processor handles object content
      const objectString = JSON.stringify(chunk.object);
      return this.encoder.encode(objectString).length;
    } else if (chunk.type === 'tool-call') {
      // For tool-call chunks, count tool name and args
      let tokenString = chunk.toolName;
      if (chunk.args) {
        if (typeof chunk.args === 'string') {
          tokenString += chunk.args;
        } else {
          tokenString += JSON.stringify(chunk.args);
        }
      }
      return this.encoder.encode(tokenString).length;
    } else if (chunk.type === 'tool-result') {
      // For tool-result chunks, count the result
      let tokenString = '';
      if (chunk.result !== undefined) {
        if (typeof chunk.result === 'string') {
          tokenString += chunk.result;
        } else {
          tokenString += JSON.stringify(chunk.result);
        }
      }
      return this.encoder.encode(tokenString).length;
    } else {
      // For other chunk types, count the JSON representation
      return this.encoder.encode(JSON.stringify(chunk)).length;
    }
  }

  /**
   * Process the final result (non-streaming)
   * Truncates the text content if it exceeds the token limit
   */
  async processOutputResult({
    messages,
    abort,
  }: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
  }): Promise<MastraMessageV2[]> {
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

          if (tokens <= this.maxTokens) {
            this.currentTokens += tokens;
            return part;
          } else {
            if (this.strategy === 'abort') {
              abort(`Token limit of ${this.maxTokens} exceeded (current: ${tokens})`);
            } else {
              // Truncate the text to fit within token limit
              let truncatedText = '';
              let currentTokens = 0;

              // Find the cutoff point that fits within the limit
              for (let i = 0; i < textContent.length; i++) {
                const testText = textContent.slice(0, i + 1);
                const testTokens = this.encoder.encode(testText).length;

                if (testTokens <= this.maxTokens) {
                  truncatedText = testText;
                  currentTokens = testTokens;
                } else {
                  break;
                }
              }

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
