import type { MastraDBMessage } from '@mastra/core/agent';
import { Tiktoken } from 'js-tiktoken/lite';
import type { TiktokenBPE } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

/**
 * Shared default encoder singleton.
 * Tiktoken(o200k_base) builds two internal Maps with ~200k entries each,
 * costing ~80-120 MB of heap per instance. Since ObservationalMemory creates
 * a TokenCounter for both input and output processors per request, sharing
 * the default encoder avoids duplicating this cost.
 */
let sharedDefaultEncoder: Tiktoken | undefined;

function getDefaultEncoder(): Tiktoken {
  if (!sharedDefaultEncoder) {
    sharedDefaultEncoder = new Tiktoken(o200k_base);
  }
  return sharedDefaultEncoder;
}

/**
 * Token counting utility using tiktoken.
 * For POC we use o200k_base (GPT-4o encoding) as a reasonable default.
 * Production will add provider-aware counting.
 */
export class TokenCounter {
  private encoder: Tiktoken;

  // Per-message overhead: accounts for role tokens, message framing, and separators.
  // Empirically derived from OpenAI's token counting guide (3 tokens per message base +
  // fractional overhead from name/role encoding). 3.8 is a practical average across models.
  private static readonly TOKENS_PER_MESSAGE = 3.8;
  // Conversation-level overhead: system prompt framing, reply priming tokens, etc.
  private static readonly TOKENS_PER_CONVERSATION = 24;

  constructor(encoding?: TiktokenBPE) {
    this.encoder = encoding ? new Tiktoken(encoding) : getDefaultEncoder();
  }

  /**
   * Count tokens in a plain string
   */
  countString(text: string): number {
    if (!text) return 0;
    // Allow all special tokens to avoid errors with content containing tokens like <|endoftext|>
    return this.encoder.encode(text, 'all').length;
  }

  /**
   * Count tokens in a single message
   */
  countMessage(message: MastraDBMessage): number {
    let tokenString = message.role;
    let overhead = TokenCounter.TOKENS_PER_MESSAGE;
    let toolResultCount = 0;

    if (typeof message.content === 'string') {
      tokenString += message.content;
    } else if (message.content && typeof message.content === 'object') {
      if (message.content.content && !Array.isArray(message.content.parts)) {
        tokenString += message.content.content;
      } else if (Array.isArray(message.content.parts)) {
        for (const part of message.content.parts) {
          if (part.type === 'text') {
            tokenString += part.text;
          } else if (part.type === 'tool-invocation') {
            const invocation = part.toolInvocation;
            if (invocation.state === 'call' || invocation.state === 'partial-call') {
              if (invocation.toolName) {
                tokenString += invocation.toolName;
              }
              if (invocation.args) {
                if (typeof invocation.args === 'string') {
                  tokenString += invocation.args;
                } else {
                  tokenString += JSON.stringify(invocation.args);
                  // JSON.stringify adds ~12 tokens of structural overhead (braces, quotes, colons)
                  // that the model's native tool encoding doesn't use, so subtract to compensate.
                  overhead -= 12;
                }
              }
            } else if (invocation.state === 'result') {
              toolResultCount++;
              if (invocation.result !== undefined) {
                if (typeof invocation.result === 'string') {
                  tokenString += invocation.result;
                } else {
                  tokenString += JSON.stringify(invocation.result);
                  overhead -= 12;
                }
              }
            } else {
              throw new Error(
                `Unhandled tool-invocation state '${(part as any).toolInvocation?.state}' in token counting for part type '${part.type}'`,
              );
            }
          } else if (typeof part.type === 'string' && part.type.startsWith('data-')) {
            // Skip data-* parts (e.g. data-om-activation, data-om-buffering-start, etc.)
            // These are OM metadata parts that are never sent to the LLM.
          } else if (part.type === 'reasoning') {
            // Skip reasoning parts (not sent to the model context).
          } else {
            tokenString += JSON.stringify(part);
          }
        }
      }
    }

    // Add overhead for tool results
    if (toolResultCount > 0) {
      overhead += toolResultCount * TokenCounter.TOKENS_PER_MESSAGE;
    }

    // Allow all special tokens to avoid errors with content containing tokens like <|endoftext|>
    return Math.round(this.encoder.encode(tokenString, 'all').length + overhead);
  }

  /**
   * Count tokens in an array of messages
   */
  countMessages(messages: MastraDBMessage[]): number {
    if (!messages || messages.length === 0) return 0;

    let total = TokenCounter.TOKENS_PER_CONVERSATION;
    for (const message of messages) {
      total += this.countMessage(message);
    }
    return total;
  }

  /**
   * Count tokens in observations string
   */
  countObservations(observations: string): number {
    return this.countString(observations);
  }
}
