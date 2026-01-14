import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import { Tiktoken } from 'js-tiktoken/lite';
import type { TiktokenBPE } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';
import type { MastraDBMessage } from '../../agent/message-list';
import type { ChunkType } from '../../stream';
import type { ProcessInputArgs, ProcessInputResult, Processor } from '../index';

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
 * Processor that limits the number of tokens in messages.
 *
 * Can be used as:
 * - Input processor: Filters historical messages to fit within context window, prioritizing recent messages
 * - Output processor: Limits generated response tokens via streaming (processOutputStream) or non-streaming (processOutputResult)
 */
export class TokenLimiterProcessor implements Processor<'token-limiter'> {
  public readonly id = 'token-limiter';
  public readonly name = 'Token Limiter';
  private encoder: Tiktoken;
  private maxTokens: number;
  private strategy: 'truncate' | 'abort';
  private countMode: 'cumulative' | 'part';

  // Token counting constants for input processing
  private static readonly TOKENS_PER_MESSAGE = 3.8;
  private static readonly TOKENS_PER_CONVERSATION = 24;

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
   *
   * Uses messageList.get.all.db() to access ALL messages (memory + input),
   * not just the input messages passed in the messages parameter.
   * System messages are accessed via args.systemMessages (they're stored separately).
   * Removes filtered messages directly from messageList and returns it.
   */
  async processInput(args: ProcessInputArgs): Promise<ProcessInputResult> {
    const { messageList, systemMessages: coreSystemMessages } = args;

    // Use messageList to get ALL messages (memory + input)
    // Note: System messages are NOT in messageList.get.all.db() - they're in args.systemMessages
    const messages = messageList?.get.all.db() ?? args.messages;
    const limit = this.maxTokens;

    // If no messages or empty array, return as-is
    if (!messages || messages.length === 0) {
      return messageList ?? messages;
    }

    // Calculate token count for system messages (always included, never filtered)
    // System messages come from args.systemMessages, not from the messages array
    let systemTokens = 0;
    if (coreSystemMessages && coreSystemMessages.length > 0) {
      for (const msg of coreSystemMessages) {
        systemTokens += this.countCoreMessageTokens(msg);
      }
    }

    // All messages from messageList.get.all.db() are non-system messages
    const nonSystemMessages = messages;

    // If system messages alone exceed the limit (accounting for conversation overhead),
    // remove all non-system messages
    if (systemTokens + TokenLimiterProcessor.TOKENS_PER_CONVERSATION >= limit) {
      if (messageList) {
        const idsToRemove = nonSystemMessages.map(m => m.id);
        messageList.removeByIds(idsToRemove);
        return messageList;
      }
      return [];
    }

    // Calculate remaining budget for non-system messages (accounting for conversation overhead)
    const remainingBudget = limit - systemTokens - TokenLimiterProcessor.TOKENS_PER_CONVERSATION;

    // Process non-system messages in reverse order (newest first)
    const messagesToKeep: MastraDBMessage[] = [];
    let currentTokens = 0;

    // Iterate through messages in reverse to prioritize recent messages
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      if (!message) continue;

      const messageTokens = this.countInputMessageTokens(message);

      if (currentTokens + messageTokens <= remainingBudget) {
        messagesToKeep.unshift(message); // Add to beginning to maintain order
        currentTokens += messageTokens;
      }
      // Continue checking all messages, don't break early
    }

    // If we have messageList, remove filtered messages directly and return messageList
    if (messageList) {
      const keepIds = new Set(messagesToKeep.map(m => m.id));
      const idsToRemove = messages.filter(m => !keepIds.has(m.id)).map(m => m.id);
      if (idsToRemove.length > 0) {
        messageList.removeByIds(idsToRemove);
      }
      return messageList;
    }

    // Fallback: return array of filtered non-system messages
    return messagesToKeep;
  }

  /**
   * Count tokens for a CoreMessageV4 (system messages from args.systemMessages)
   */
  private countCoreMessageTokens(message: CoreMessageV4): number {
    let tokenString = message.role;

    if (typeof message.content === 'string') {
      tokenString += message.content;
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if ('text' in part && typeof part.text === 'string') {
          tokenString += part.text;
        }
      }
    }

    return this.encoder.encode(tokenString).length + TokenLimiterProcessor.TOKENS_PER_MESSAGE;
  }

  /**
   * Count tokens for an input message, including overhead for message structure
   */
  private countInputMessageTokens(message: MastraDBMessage): number {
    let tokenString = message.role;
    let overhead = 0;

    // Handle content based on MastraMessageV2 structure
    let toolResultCount = 0; // Track tool results that will become separate messages

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
                  overhead -= 12;
                }
              }
            } else if (invocation.state === 'result') {
              // Tool result - this will become a separate CoreMessage
              toolResultCount++;
              if (invocation.result !== undefined) {
                if (typeof invocation.result === 'string') {
                  tokenString += invocation.result;
                } else {
                  tokenString += JSON.stringify(invocation.result);
                  overhead -= 12;
                }
              }
            }
          } else {
            tokenString += JSON.stringify(part);
          }
        }
      }
    }

    // Add message formatting overhead
    // Each MastraDBMessage becomes at least 1 CoreMessage, plus 1 additional CoreMessage per tool-invocation (state: 'result')
    // Base overhead for the message itself
    overhead += TokenLimiterProcessor.TOKENS_PER_MESSAGE;
    // Additional overhead for each tool result (which adds an extra CoreMessage)
    if (toolResultCount > 0) {
      overhead += toolResultCount * TokenLimiterProcessor.TOKENS_PER_MESSAGE;
    }

    const tokenCount = this.encoder.encode(tokenString).length;
    const total = tokenCount + overhead;
    return total;
  }

  async processOutputStream(args: {
    part: ChunkType;
    streamParts: ChunkType[];
    state: Record<string, any>;
    abort: (reason?: string) => never;
  }): Promise<ChunkType | null> {
    // Always process output streams (this is the main/original functionality)
    const { part, state, abort } = args;
    const limit = this.maxTokens;

    // Initialize currentTokens in state if not present
    if (state.currentTokens === undefined) {
      state.currentTokens = 0;
    }

    // Count tokens in the current part
    const chunkTokens = this.countTokensInChunk(part);

    if (this.countMode === 'cumulative') {
      // Add to cumulative count
      state.currentTokens += chunkTokens;
    } else {
      // Only check the current part
      state.currentTokens = chunkTokens;
    }

    // Check if we've exceeded the limit
    if (state.currentTokens > limit) {
      if (this.strategy === 'abort') {
        abort(`Token limit of ${limit} exceeded (current: ${state.currentTokens})`);
      } else {
        // truncate strategy - don't emit this part
        // If we're in part mode, reset the count for next part
        if (this.countMode === 'part') {
          state.currentTokens = 0;
        }
        return null;
      }
    }

    // Emit the part
    const result = part;

    // If we're in part mode, reset the count for next part
    if (this.countMode === 'part') {
      state.currentTokens = 0;
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
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
  }): Promise<MastraDBMessage[]> {
    // Always process output results (this is the main/original functionality)
    const { messages, abort } = args;
    const limit = this.maxTokens;

    // Use a local variable to track tokens within this single result processing
    let cumulativeTokens = 0;

    const processedMessages = messages.map(message => {
      if (message.role !== 'assistant' || !message.content?.parts) {
        return message;
      }

      const processedParts = message.content.parts.map(part => {
        if (part.type === 'text') {
          const textContent = part.text;
          const tokens = this.encoder.encode(textContent).length;

          // Check if adding this part's tokens would exceed the cumulative limit
          if (cumulativeTokens + tokens <= limit) {
            cumulativeTokens += tokens;
            return part;
          } else {
            if (this.strategy === 'abort') {
              abort(`Token limit of ${limit} exceeded (current: ${cumulativeTokens + tokens})`);
            } else {
              // Truncate the text to fit within the remaining token limit
              let truncatedText = '';
              let currentTokens = 0;
              const remainingTokens = limit - cumulativeTokens;

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

              cumulativeTokens += currentTokens;

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
   * Get the maximum token limit
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }
}
