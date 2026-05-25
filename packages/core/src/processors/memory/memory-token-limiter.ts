import type { ProcessInputArgs, Processor } from '..';
import type { MastraDBMessage, MessageList } from '../../agent';
import { setMemoryTokenLimiterBoundary, parseMemoryRequestContext } from '../../memory';
import { CoreTokenCounter } from '../../utils/token-counter';

/**
 * Options for the MemoryTokenLimiter processor
 */
export interface MemoryTokenLimiterOptions {
  /** Maximum token count for all messages (memory history + new input) */
  maxTokens: number;
  /**
   * When the token budget is exceeded, drop this many tokens from the total.
   * Defaults to a reasonable fraction (25%) of maxTokens if not specified.
   * The resulting target window is maxTokens - atMaxRemoveTokens.
   */
  atMaxRemoveTokens?: number;
}

/**
 * Default token counter source identifier (matches CoreTokenCounter's cache source).
 */
const DEFAULT_TOKEN_COUNTER_SOURCE = `v5:o200k_base`;

/**
 * Input processor that limits memory history messages by token count.
 *
 * When the total token count of all messages (memory history + new input) exceeds
 * the configured limit, the oldest memory history messages are removed to stay
 * within the budget. Input messages are never removed.
 *
 * The trim boundary is persisted on thread metadata as a cursor, so subsequent
 * turns start fetching from that boundary instead of recounting all history.
 * This creates a "sawtooth" behavior: context grows to maxTokens, drops to
 * maxTokens - atMaxRemoveTokens, then grows from that persisted point.
 *
 * Uses tiktoken (o200k_base encoding) via CoreTokenCounter from @mastra/core
 * for accurate token counting with metadata caching on
 * message.content.metadata.mastra.tokenEstimate.
 *
 * This processor should run after MessageHistory has loaded messages into the MessageList.
 */
export class MemoryTokenLimiter implements Processor {
  readonly id = 'memory-token-limiter';
  readonly name = 'MemoryTokenLimiter';
  private maxTokens: number;
  private atMaxRemoveTokens: number;
  private counter: CoreTokenCounter | undefined;

  constructor(options: MemoryTokenLimiterOptions) {
    this.maxTokens = options.maxTokens;
    // Default atMaxRemoveTokens to 25% of maxTokens if not specified
    this.atMaxRemoveTokens = options.atMaxRemoveTokens ?? Math.max(1, Math.floor(options.maxTokens * 0.25));
  }

  /**
   * Lazily initialize the CoreTokenCounter.
   * Uses getDefaultEncoder() which is synchronous and reuses the global singleton.
   */
  private getCounter(): CoreTokenCounter {
    if (!this.counter) {
      this.counter = new CoreTokenCounter();
    }
    return this.counter;
  }

  async processInput(args: ProcessInputArgs): Promise<MessageList> {
    const { messageList, systemMessages, requestContext } = args;
    const counter = this.getCounter();

    // Count system message tokens (instructions, etc.) — these are never removed
    let totalTokens = 0;
    if (systemMessages && systemMessages.length > 0) {
      for (const msg of systemMessages) {
        if (typeof msg.content === 'string') {
          totalTokens += counter.countString(msg.content);
        }
      }
    }

    // Build token counts for all messages in the list
    const memoryMessages = messageList.get.remembered.db();
    const memoryMessageIds = new Set(memoryMessages.map(m => m.id));
    const rememberedTokenCounts = new Map<string, number>();

    const allMessages = messageList.get.all.db();
    for (const message of allMessages) {
      const tokens = counter.countMessage(message);
      totalTokens += tokens;

      if (memoryMessageIds.has(message.id)) {
        rememberedTokenCounts.set(message.id, tokens);
      }
    }

    // If total is within budget, no trimming needed
    if (totalTokens <= this.maxTokens) {
      return messageList;
    }

    // Calculate target: drop down to maxTokens - atMaxRemoveTokens
    const target = Math.max(0, this.maxTokens - this.atMaxRemoveTokens);
    const idsToRemove: string[] = [];
    let newestRemovedMessage: MastraDBMessage | undefined;

    // Remove oldest memory messages first until we reach the target
    for (const message of memoryMessages) {
      const messageTokens = rememberedTokenCounts.get(message.id) ?? 0;
      const wouldDropTo = totalTokens - messageTokens;

      idsToRemove.push(message.id);
      newestRemovedMessage = message;
      totalTokens = wouldDropTo;

      if (wouldDropTo <= target) {
        break;
      }
    }

    if (idsToRemove.length > 0) {
      messageList.removeByIds(idsToRemove);
    }

    // Persist the boundary if we have one to persist and a thread to persist it on
    if (newestRemovedMessage && requestContext) {
      this.persistBoundary(requestContext, newestRemovedMessage, totalTokens + this.atMaxRemoveTokens, target);
    }

    return messageList;
  }

  /**
   * Persist the memory token limiter boundary on the thread metadata.
   * This allows subsequent turns to start fetching from the boundary instead
   * of recounting all history.
   */
  private persistBoundary(
    requestContext: ProcessInputArgs['requestContext'],
    newestRemovedMessage: MastraDBMessage,
    droppedFromTokens: number,
    targetTokens: number,
  ): void {
    const memoryContext = parseMemoryRequestContext(requestContext);
    const thread = memoryContext?.thread;

    if (!thread) {
      return;
    }

    const boundary = {
      messageId: newestRemovedMessage.id,
      createdAt:
        newestRemovedMessage.createdAt instanceof Date
          ? newestRemovedMessage.createdAt.toISOString()
          : new Date(newestRemovedMessage.createdAt!).toISOString(),
      droppedFromTokens,
      targetTokens,
      maxTokens: this.maxTokens,
      atMaxRemoveTokens: this.atMaxRemoveTokens,
      tokenCounterSource: DEFAULT_TOKEN_COUNTER_SOURCE,
      updatedAt: new Date().toISOString(),
    };

    thread.metadata = setMemoryTokenLimiterBoundary(thread.metadata as Record<string, unknown> | undefined, boundary);
  }
}
