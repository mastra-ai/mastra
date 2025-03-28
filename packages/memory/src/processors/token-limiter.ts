import type { CoreMessage, SharedMessageProcessorOpts } from '@mastra/core';
import { MessageProcessor } from '@mastra/core/memory';
import { Tiktoken } from 'js-tiktoken/lite';
import cl100k_base from 'js-tiktoken/ranks/cl100k_base';

/**
 * Limits the total number of tokens in the messages.
 * Uses js-tiktoken with cl100k_base encoding for accurate token counting.
 * This encoding is used by all modern OpenAI models (GPT-3.5, GPT-4, etc).
 */
export class TokenLimiter extends MessageProcessor {
  private encoder: Tiktoken;
  /**
   * Create a token limiter for messages.
   * @param maxTokens Maximum number of tokens to allow
   */
  constructor(private maxTokens: number) {
    super({
      name: 'TokenLimiter',
    });
    this.encoder = new Tiktoken(cl100k_base);
  }

  process(
    messages: CoreMessage[],
    { systemMessage, memorySystemMessage, newMessages }: SharedMessageProcessorOpts = {},
  ): CoreMessage[] {
    // Messages are already chronologically ordered - take most recent ones up to the token limit
    let totalTokens = 0;

    if (systemMessage) {
      totalTokens += this.countTokens(systemMessage);
    }

    if (memorySystemMessage) {
      totalTokens += this.countTokens(memorySystemMessage);
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

    return this.encoder.encode(tokenString).length;
  }
}
