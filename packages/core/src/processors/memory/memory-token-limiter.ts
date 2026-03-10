import type { Tiktoken } from 'js-tiktoken/lite';

import type { ProcessInputArgs, Processor } from '..';
import type { MastraDBMessage, MessageList } from '../../agent';
import { getTiktoken } from '../../utils/tiktoken';

/**
 * Options for the MemoryTokenLimiter processor
 */
export interface MemoryTokenLimiterOptions {
  /** Maximum token count for all messages (memory history + new input) */
  maxTokens: number;
}

/**
 * Count tokens for a single message using tiktoken encoder.
 */
function countMessageTokens(encoder: Tiktoken, message: MastraDBMessage): number {
  let text = message.role;

  if (typeof message.content === 'string') {
    text += message.content;
  } else if (message.content && typeof message.content === 'object') {
    if (Array.isArray(message.content.parts)) {
      for (const part of message.content.parts) {
        if (part.type === 'text') {
          text += part.text;
        } else {
          text += JSON.stringify(part);
        }
      }
    } else if (message.content.content) {
      text += message.content.content;
    }
  }

  return encoder.encode(text).length;
}

/**
 * Input processor that limits memory history messages by token count.
 *
 * When the total token count of all messages (memory history + new input) exceeds
 * the configured limit, the oldest memory history messages are removed to stay
 * within the budget. Input messages are never removed.
 *
 * Uses tiktoken (o200k_base encoding) for accurate token counting.
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
    const { messageList, systemMessages } = args;
    const encoder = await getTiktoken();

    // Count system message tokens (instructions, etc.) — these are never removed
    let totalTokens = 0;
    if (systemMessages && systemMessages.length > 0) {
      for (const msg of systemMessages) {
        if (typeof msg.content === 'string') {
          totalTokens += encoder.encode(msg.content).length;
        }
      }
    }

    const allMessages = messageList.get.all.db();
    for (const message of allMessages) {
      totalTokens += countMessageTokens(encoder, message);
    }

    if (totalTokens <= this.maxTokens) {
      return messageList;
    }

    const memoryMessages = messageList.get.remembered.db();
    const idsToRemove: string[] = [];

    // Remove oldest memory messages first until we're within the token budget
    for (const message of memoryMessages) {
      const messageTokens = countMessageTokens(encoder, message);
      idsToRemove.push(message.id);
      totalTokens -= messageTokens;
      if (totalTokens <= this.maxTokens) {
        break;
      }
    }

    if (idsToRemove.length > 0) {
      messageList.removeByIds(idsToRemove);
    }

    return messageList;
  }
}
