import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import { estimateTokenCount, sliceByTokens } from 'tokenx';
import type { MastraDBMessage } from '../../agent/message-list';
import { parseDataUri, resolveFilePartMediaTypeAndData } from '../../agent/message-list/prompt/image-utils';
import { TripWire } from '../../agent/trip-wire';
import type { ChunkType } from '../../stream';
import type { ProcessInputStepArgs, ProcessOutputStreamArgs, Processor } from '../index';

/**
 * Configuration options for TokenLimiter processor
 */
export interface TokenLimiterOptions {
  /** Maximum number of tokens to allow */
  limit: number;
  /**
   * @deprecated Token counts are now estimated using `tokenx` (no BPE encoder required).
   * This option is accepted for backwards compatibility but is ignored.
   */
  encoding?: unknown;
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

/**
 * Flat estimate for an image payload. Providers bill images at a near-flat
 * per-image cost, so the encoded size is a poor predictor of the real cost.
 */
const TOKENS_PER_IMAGE = 765;

/** Estimate used when a media payload's decoded size cannot be determined. */
const TOKENS_PER_MEDIA_FALLBACK = 258;

/** Rough bytes-per-token ratio for non-image media, which is usually text-like once decoded. */
const BYTES_PER_TOKEN = 4;

type MediaPayload = { data: string; mediaType?: string; mimeType?: string };

/**
 * Detects the `{ data, mediaType | mimeType }` shape that tools return for images
 * and file attachments, so the payload is estimated rather than tokenized as text.
 */
function isMediaPayload(value: unknown): value is MediaPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.data !== 'string') return false;
  return typeof candidate.mediaType === 'string' || typeof candidate.mimeType === 'string';
}

/**
 * Estimate the token cost of a media payload without tokenizing its encoded bytes.
 * A base64 image is tens of thousands of characters but costs a small, near-flat
 * number of tokens, so stringifying it would inflate the count by an order of magnitude.
 */
function estimateMediaTokens(data: unknown, mediaType?: string): number {
  if (mediaType?.startsWith('image/')) return TOKENS_PER_IMAGE;

  let byteLength: number | undefined;

  if (typeof data === 'string') {
    const { isDataUri, base64Content } = parseDataUri(data);
    // Remote URLs and provider file ids carry no locally knowable size.
    if (isDataUri || !/^[a-z][a-z0-9+.-]*:/i.test(data)) {
      byteLength = Math.floor((base64Content.length * 3) / 4);
    }
  } else if (data instanceof Uint8Array) {
    byteLength = data.byteLength;
  }

  if (byteLength === undefined) return TOKENS_PER_MEDIA_FALLBACK;

  return Math.max(1, Math.floor(byteLength / BYTES_PER_TOKEN));
}

export class TokenLimiterProcessor implements Processor<'token-limiter', TokenLimiterTripWireMetadata> {
  public readonly id = 'token-limiter';
  public readonly name = 'Token Limiter';
  private maxTokens: number;
  private strategy: 'truncate' | 'abort';
  private countMode: 'cumulative' | 'part';
  private trimMode: 'best-fit' | 'contiguous';

  // Token counting constants for input processing
  private static readonly TOKENS_PER_MESSAGE = 3.8;
  private static readonly TOKENS_PER_CONVERSATION = 24;

  /**
   * Chunk types carrying generated output visible to the caller. Only these are
   * counted against the limit, and only these are withheld once it is reached.
   * Lifecycle chunks (`step-start`, response metadata), reasoning deltas and
   * tool traffic are neither counted nor withheld.
   */
  private static readonly OUTPUT_CHUNK_TYPES = new Set<ChunkType['type']>(['text-delta', 'object']);

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
      this.strategy = options.strategy || 'truncate';
      this.countMode = options.countMode || 'cumulative';
      this.trimMode = options.trimMode || 'best-fit';
    }
  }

  private countTokens(text: string): number {
    return estimateTokenCount(text);
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
    const { messageList } = args;

    if (!messageList) return;

    const messages = messageList.get.all.db();

    // If no messages or empty array, throw TripWire - can't send LLM a request with no messages
    if (!messages || messages.length === 0) {
      throw new TripWire('TokenLimiterProcessor: No messages to process. Cannot send LLM a request with no messages.', {
        retry: false,
      });
    }

    // Budget against the full system message set that will reach the model
    // (untagged + tagged buckets), not just the untagged view exposed via args.
    const allSystemMessages = messageList.getAllSystemMessages();
    let systemTokens = 0;
    for (const msg of allSystemMessages) {
      systemTokens += await this.countCoreSystemMessageTokens(msg);
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
   * Count tokens for a system message. Accepts both untagged and tagged system messages
   * read from `messageList.getAllSystemMessages()`. Only string content is supported.
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

    const tokenString = message.role + message.content;

    return this.countTokens(tokenString) + TokenLimiterProcessor.TOKENS_PER_MESSAGE;
  }

  /**
   * Count tokens for an input message, including overhead for message structure
   */
  private async countInputMessageTokens(message: MastraDBMessage): Promise<number> {
    let tokenString = message.role;
    let overhead = 0;
    // Media is estimated rather than tokenized, so it is accumulated separately.
    let mediaTokens = 0;

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
                } else if (isMediaPayload(invocation.result)) {
                  const { data, ...rest } = invocation.result;
                  mediaTokens += estimateMediaTokens(data, invocation.result.mediaType ?? invocation.result.mimeType);
                  tokenString += JSON.stringify(rest);
                  overhead -= 12;
                } else if (
                  Array.isArray(invocation.result) &&
                  invocation.result.length > 0 &&
                  invocation.result.every(isMediaPayload)
                ) {
                  for (const entry of invocation.result as MediaPayload[]) {
                    const { data, ...rest } = entry;
                    mediaTokens += estimateMediaTokens(data, entry.mediaType ?? entry.mimeType);
                    tokenString += JSON.stringify(rest);
                  }
                  overhead -= 12;
                } else {
                  tokenString += JSON.stringify(invocation.result);
                  overhead -= 12;
                }
              }
            }
          } else if (part.type === 'file') {
            const { data, mediaType } = resolveFilePartMediaTypeAndData(part);
            mediaTokens += estimateMediaTokens(data, mediaType);
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

    const tokenCount = this.countTokens(tokenString);
    const total = tokenCount + overhead + mediaTokens;
    return total;
  }

  async processOutputStream(args: ProcessOutputStreamArgs<TokenLimiterTripWireMetadata>): Promise<ChunkType | null> {
    // Always process output streams (this is the main/original functionality)
    const { part, state, abort, writer } = args;
    const limit = this.maxTokens;

    // Chunks that don't carry generated output pass through untouched: counting
    // them would spend the budget on payloads the caller never sees (a single
    // `step-start` embeds the whole request body), and withholding them breaks
    // the run (a withheld `tool-call` is never executed by the agentic loop).
    if (!TokenLimiterProcessor.OUTPUT_CHUNK_TYPES.has(part.type)) {
      return part;
    }

    // Count tokens in the current part
    const chunkTokens = await this.countTokensInChunk(part);
    const previousTokens = typeof state.currentTokens === 'number' ? state.currentTokens : 0;
    const currentTokens = this.countMode === 'cumulative' ? previousTokens + chunkTokens : chunkTokens;
    state.currentTokens = currentTokens;

    // Check if we've exceeded the limit
    if (currentTokens > limit) {
      if (this.strategy === 'abort') {
        abort(`Token limit of ${limit} exceeded (current: ${currentTokens})`);
      } else {
        // truncate strategy - don't emit this part, but tell the caller once that
        // output is being withheld so truncation isn't silent
        if (!state.limitReachedNotified) {
          state.limitReachedNotified = true;
          try {
            await writer?.custom({
              type: 'data-token-limit-reached',
              data: { processorId: this.id, limit, tokens: currentTokens },
              transient: true,
            });
          } catch {
            // never let the notification break the stream
          }
        }
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
    if (part.type === 'text-delta') {
      // For text chunks, count the text content directly
      return this.countTokens(part.payload.text);
    } else if (part.type === 'object') {
      // For object chunks, count the JSON representation
      // This is similar to how the memory processor handles object content
      const objectString = JSON.stringify(part.object);
      return this.countTokens(objectString);
    }

    // Anything else carries no generated output and is not counted
    return 0;
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
          const tokens = this.countTokens(textContent);

          // Check if adding this part's tokens would exceed the cumulative limit
          if (cumulativeTokens + tokens <= limit) {
            cumulativeTokens += tokens;
            return part;
          } else {
            if (this.strategy === 'abort') {
              abort(`Token limit of ${limit} exceeded (current: ${cumulativeTokens + tokens})`);
            } else {
              // Truncate the text to fit within the remaining token limit
              const remainingTokens = Math.max(0, limit - cumulativeTokens);
              const truncatedText = remainingTokens > 0 ? sliceByTokens(textContent, 0, remainingTokens) : '';
              cumulativeTokens += this.countTokens(truncatedText);

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
