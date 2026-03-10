import type { ProcessInputArgs, Processor } from '..';
import type { MastraDBMessage, MessageList } from '../../agent';

const CHARS_PER_TOKEN_ESTIMATE = 4;

/**
 * Options for the MemoryTokenLimiter processor
 */
export interface MemoryTokenLimiterOptions {
  /** Maximum token count for all messages (memory history + new input) */
  maxTokens: number;
}

/**
 * Estimate token count for a list of messages using character count / 4 approximation.
 */
function estimateTokenCount(messages: readonly MastraDBMessage[]): number {
  return Math.ceil(JSON.stringify(messages).length / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * Input processor that limits memory history messages by token count.
 *
 * When the total token count of all messages (memory history + new input) exceeds
 * the configured limit, the oldest memory history messages are removed to stay
 * within the budget. Input messages are never removed.
 *
 * This processor should run after MessageHistory has loaded messages into the MessageList.
 */
export class MemoryTokenLimiter implements Processor {
  readonly id = 'memory-token-limiter';
  readonly name = 'MemoryTokenLimiter';
  private maxTokens: number;

  constructor(options: MemoryTokenLimiterOptions) {
    this.maxTokens = options.maxTokens;
  }

  async processInput(args: ProcessInputArgs): Promise<MessageList> {
    const { messageList } = args;

    const allMessages = messageList.get.all.db();
    if (estimateTokenCount(allMessages) <= this.maxTokens) {
      return messageList;
    }

    const memoryMessages = messageList.get.remembered.db();
    const idsToRemove: string[] = [];

    // Remove oldest memory messages first until we're within the token budget
    for (const message of memoryMessages) {
      idsToRemove.push(message.id);
      const remaining = allMessages.filter(m => !idsToRemove.includes(m.id));
      if (estimateTokenCount(remaining) <= this.maxTokens) {
        break;
      }
    }

    if (idsToRemove.length > 0) {
      messageList.removeByIds(idsToRemove);
    }

    return messageList;
  }
}
