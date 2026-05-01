import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import type { Tiktoken, TiktokenBPE } from 'js-tiktoken/lite';
import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { ChunkType } from '../../stream';
import { getTiktoken } from '../../utils/tiktoken';
import type { ProcessInputStepArgs, Processor } from '../index';

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
  trimMode?: 'best-fit' | 'contiguous';
}

/**
 * Processor that limits the number of tokens in messages.
 *
 * Can be used as:
 * - Input processor: Filters historical messages to fit within context window, prioritizing recent messages
 * - Output processor: Limits generated response tokens via streaming (processOutputStream) or non-streaming (processOutputResult)
 */
type TokenLimiterTripWireMetadata = {
  systemTokens: number;
  limit: number;
  remainingBudget?: number;
  messageCount?: number;
};

export class TokenLimiterProcessor implements Processor<'token-limiter', TokenLimiterTripWireMetadata> {
  public readonly id = 'token-limiter';
  public readonly name = 'Token Limiter';
  private encoderPromise: Promise<Tiktoken> | undefined;
  private customEncoding: TiktokenBPE | undefined;
  private maxTokens: number;
  private strategy: 'truncate' | 'abort';
  private countMode: 'cumulative' | 'part';
  private trimMode: 'best-fit' | 'contiguous';

  // Token counting constants for input processing
  private static readonly TOKENS_PER_MESSAGE = 3.8;
  private static readonly TOKENS_PER_CONVERSATION = 24;

  constructor(options: number | TokenLimiterOptions) {
    if (typeof options === 'number') {
      // Simple number format - just the token limit with default settings
      this.maxTokens = options;
      this.strategy = 'truncate';
      this.countMode = 'cumulative';
      this.trimMode = 'best-fit';
    } else {
      // Object format with all options
      this.maxTokens = options.limit;
      this.customEncoding = options.encoding;
      this.strategy = options.strategy || 'truncate';
      this.countMode = options.countMode || 'cumulative';
      this.trimMode = options.trimMode || 'best-fit';
    }
  }

  /**
   * Get the Tiktoken encoder, using the shared global singleton when no custom encoding is provided.
   * The encoder is lazily initialized on first use and cached for subsequent calls.
   */
  private getEncoder(): Promise<Tiktoken> {
    if (!this.encoderPromise) {
      if (this.customEncoding) {
        // Custom encoding: create a dedicated instance (can't use the shared singleton)
        this.encoderPromise = import('js-tiktoken/lite').then(({ Tiktoken: TiktokenClass }) => {
          return new TiktokenClass(this.customEncoding!);
        });
      } else {
        // Default encoding: use the shared global singleton (~80-120MB saved per instance)
        this.encoderPromise = getTiktoken();
      }
    }
    return this.encoderPromise;
  }

  /**
   * Process input messages at each step of the agentic loop, before they are sent to the LLM.
   * Runs at every step (including tool call continuations), preventing the conversation history
   * from growing unboundedly during multi-step agent workflows.
   *
   * System messages are always preserved, and the most recent non-system messages are kept
   * within the token budget.
   */
  async processInputStep(args: ProcessInputStepArgs): Promise<void> {
    const { messageList, systemMessages: coreSystemMessages } = args;

    if (!messageList) return;

    const messages = messageList.get.all.db();

    // If no messages or empty array, throw TripWire - can't send LLM a request with no messages
    if (!messages || messages.length === 0) {
      throw new TripWire('TokenLimiterProcessor: No messages to process. Cannot send LLM a request with no messages.', {
        retry: false,
      });
    }

    // Calculate token count for system messages (always included, never filtered)
    let systemTokens = 0;
    if (coreSystemMessages && coreSystemMessages.length > 0) {
      for (const msg of coreSystemMessages) {
        systemTokens += await this.countCoreSystemMessageTokens(msg);
      }
    }

    const limit = this.maxTokens;

    // If system messages alone exceed the token limit (accounting for conversation overhead),
    // throw TripWire - can't send LLM a request with only system messages
    if (systemTokens + TokenLimiterProcessor.TOKENS_PER_CONVERSATION >= limit) {
      throw new TripWire(
        'TokenLimiterProcessor: System messages alone exceed token limit. Requests cannot be completed by removing system messages.',
        { retry: false, metadata: { systemTokens, limit } },
      );
    }

    // Calculate remaining budget for non-system messages (accounting for conversation overhead)
    const remainingBudget = limit - systemTokens - TokenLimiterProcessor.TOKENS_PER_CONVERSATION;

    // Process non-system messages in reverse order (newest first)
    const messagesToKeep: MastraDBMessage[] = [];
    let currentTokens = 0;

    // Iterate through messages in reverse to prioritize recent messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message) continue;

      const messageTokens = await this.countInputMessageTokens(message);

      if (currentTokens + messageTokens <= remainingBudget) {
        messagesToKeep.unshift(message);
        currentTokens += messageTokens;
      } else {
        if (this.trimMode === 'contiguous') {
          break;
        }
        // best-fit → continue (existing behavior)
      }
    }

    if (messagesToKeep.length === 0) {
      throw new TripWire(
        'TokenLimiterProcessor: No messages fit within the remaining token budget. Cannot send LLM a request with no messages.',
        {
          retry: false,
          metadata: { systemTokens, limit, remainingBudget, messageCount: messages.length },
        },
      );
    }

    // Remove messages that don't fit within the token budget
    const keepIds = new Set(messagesToKeep.map(m => m.id));
    const idsToRemove = messages.filter(m => !keepIds.has(m.id)).map(m => m.id);
    if (idsToRemove.length > 0) {
      messageList.removeByIds(idsToRemove);
    }
  }

  /**
   * Count tokens for a system message (CoreMessageV4 from args.systemMessages).
   * This method only accepts system messages with string content and will throw otherwise.
   */
  private async countCoreSystemMessageTokens(message: CoreMessageV4): Promise<number> {
    if (message.role !== 'system') {
      throw new Error(
        `countCoreSystemMessageTokens can only be used with system messages, received role: ${message.role}`,
      );
    }

    if (typeof message.content !== 'string') {
      throw new Error('countCoreSystemMessageTokens: System message content must be a string');
    }

    const encoder = await this.getEncoder();
    const tokenString = message.role + message.content;

    return encoder.encode(tokenString).length + TokenLimiterProcessor.TOKENS_PER_MESSAGE;
  }

  /**
   * Count tokens for an input message, including overhead for message structure
   */
  private async countInputMessageTokens(message: MastraDBMessage): Promise<number> {
    const encoder = await this.getEncoder();
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

    const tokenCount = encoder.encode(tokenString).length;
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
    const chunkTokens = await this.countTokensInChunk(part);

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

  private async countTokensInChunk(part: ChunkType): Promise<number> {
    const encoder = await this.getEncoder();
    if (part.type === 'text-delta') {
      // For text chunks, count the text content directly
      return encoder.encode(part.payload.text).length;
    } else if (part.type === 'object') {
      // For object chunks, count the JSON representation
      // This is similar to how the memory processor handles object content
      const objectString = JSON.stringify(part.object);
      return encoder.encode(objectString).length;
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
      return encoder.encode(tokenString).length;
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
      return encoder.encode(tokenString).length;
    } else {
      // For other part types, count the JSON representation
      return encoder.encode(JSON.stringify(part)).length;
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
    const encoder = await this.getEncoder();

    // Use a local variable to track tokens within this single result processing
    let cumulativeTokens = 0;

    const processedMessages = messages.map(message => {
      if (message.role !== 'assistant' || !message.content?.parts) {
        return message;
      }

      const processedParts = message.content.parts.map(part => {
        if (part.type === 'text') {
          const textContent = part.text;
          const tokens = encoder.encode(textContent).length;

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
                const testTokens = encoder.encode(testText).length;

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
