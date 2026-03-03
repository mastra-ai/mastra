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

type TokenEstimateCacheEntry = {
  v: number;
  source: string;
  key: string;
  tokens: number;
};

const TOKEN_ESTIMATE_CACHE_VERSION = 1;
const TOKEN_ESTIMATE_CACHE_SOURCE = 'o200k_base';

type CacheablePart = any;

function buildEstimateKey(kind: string, text: string): string {
  const head = text.slice(0, 24);
  const tail = text.slice(-24);
  return `${kind}:${text.length}:${head}:${tail}`;
}

function getPartCacheEntry(part: CacheablePart): TokenEstimateCacheEntry | undefined {
  const cache = (part as any)?.providerMetadata?.mastra?.tokenEstimate;
  if (!cache || typeof cache !== 'object') return undefined;
  return cache as TokenEstimateCacheEntry;
}

function setPartCacheEntry(part: CacheablePart, entry: TokenEstimateCacheEntry): void {
  const mutablePart = part as any;
  mutablePart.providerMetadata ??= {};
  mutablePart.providerMetadata.mastra ??= {};
  mutablePart.providerMetadata.mastra.tokenEstimate = entry;
}

function getMessageCacheEntry(message: MastraDBMessage): TokenEstimateCacheEntry | undefined {
  const content = message.content as any;
  if (content && typeof content === 'object') {
    const contentLevelCache = content.metadata?.mastra?.tokenEstimate;
    if (contentLevelCache && typeof contentLevelCache === 'object') {
      return contentLevelCache as TokenEstimateCacheEntry;
    }
  }

  const messageLevelCache = (message as any)?.metadata?.mastra?.tokenEstimate;
  if (!messageLevelCache || typeof messageLevelCache !== 'object') return undefined;
  return messageLevelCache as TokenEstimateCacheEntry;
}

function setMessageCacheEntry(message: MastraDBMessage, entry: TokenEstimateCacheEntry): void {
  const content = message.content as any;
  if (content && typeof content === 'object') {
    content.metadata ??= {};
    (content.metadata as any).mastra ??= {};
    (content.metadata as any).mastra.tokenEstimate = entry;
    return;
  }

  (message as any).metadata ??= {};
  (message as any).metadata.mastra ??= {};
  (message as any).metadata.mastra.tokenEstimate = entry;
}

function isValidCacheEntry(
  entry: TokenEstimateCacheEntry | undefined,
  expectedKey: string,
): entry is TokenEstimateCacheEntry {
  return Boolean(
    entry &&
    entry.v === TOKEN_ESTIMATE_CACHE_VERSION &&
    entry.source === TOKEN_ESTIMATE_CACHE_SOURCE &&
    entry.key === expectedKey &&
    Number.isFinite(entry.tokens),
  );
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

  private readOrPersistPartEstimate(part: CacheablePart, kind: string, payload: string): number {
    const key = buildEstimateKey(kind, payload);
    const cached = getPartCacheEntry(part);
    if (isValidCacheEntry(cached, key)) {
      return cached.tokens;
    }

    const tokens = this.countString(payload);
    setPartCacheEntry(part, {
      v: TOKEN_ESTIMATE_CACHE_VERSION,
      source: TOKEN_ESTIMATE_CACHE_SOURCE,
      key,
      tokens,
    });

    return tokens;
  }

  private readOrPersistMessageEstimate(message: MastraDBMessage, kind: string, payload: string): number {
    const key = buildEstimateKey(kind, payload);
    const cached = getMessageCacheEntry(message);
    if (isValidCacheEntry(cached, key)) {
      return cached.tokens;
    }

    const tokens = this.countString(payload);
    setMessageCacheEntry(message, {
      v: TOKEN_ESTIMATE_CACHE_VERSION,
      source: TOKEN_ESTIMATE_CACHE_SOURCE,
      key,
      tokens,
    });

    return tokens;
  }

  /**
   * Count tokens in a single message
   */
  countMessage(message: MastraDBMessage): number {
    let payloadTokens = this.countString(message.role);
    let overhead = TokenCounter.TOKENS_PER_MESSAGE;
    let toolResultCount = 0;

    if (typeof message.content === 'string') {
      payloadTokens += this.readOrPersistMessageEstimate(message, 'message-content', message.content);
    } else if (message.content && typeof message.content === 'object') {
      if (message.content.content && !Array.isArray(message.content.parts)) {
        payloadTokens += this.readOrPersistMessageEstimate(message, 'content-content', message.content.content);
      } else if (Array.isArray(message.content.parts)) {
        for (const part of message.content.parts) {
          if (part.type === 'text') {
            payloadTokens += this.readOrPersistPartEstimate(part, 'text', part.text);
          } else if (part.type === 'tool-invocation') {
            const invocation = part.toolInvocation;
            if (invocation.state === 'call' || invocation.state === 'partial-call') {
              if (invocation.toolName) {
                payloadTokens += this.readOrPersistPartEstimate(
                  part,
                  `tool-${invocation.state}-name`,
                  invocation.toolName,
                );
              }
              if (invocation.args) {
                if (typeof invocation.args === 'string') {
                  payloadTokens += this.readOrPersistPartEstimate(
                    part,
                    `tool-${invocation.state}-args`,
                    invocation.args,
                  );
                } else {
                  const argsJson = JSON.stringify(invocation.args);
                  payloadTokens += this.readOrPersistPartEstimate(part, `tool-${invocation.state}-args-json`, argsJson);
                  // JSON.stringify adds ~12 tokens of structural overhead (braces, quotes, colons)
                  // that the model's native tool encoding doesn't use, so subtract to compensate.
                  overhead -= 12;
                }
              }
            } else if (invocation.state === 'result') {
              toolResultCount++;
              if (invocation.result !== undefined) {
                if (typeof invocation.result === 'string') {
                  payloadTokens += this.readOrPersistPartEstimate(part, 'tool-result', invocation.result);
                } else {
                  const resultJson = JSON.stringify(invocation.result);
                  payloadTokens += this.readOrPersistPartEstimate(part, 'tool-result-json', resultJson);
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
            const serialized = JSON.stringify(part);
            payloadTokens += this.readOrPersistPartEstimate(part, `part-${part.type}`, serialized);
          }
        }
      }
    }

    // Add overhead for tool results
    if (toolResultCount > 0) {
      overhead += toolResultCount * TokenCounter.TOKENS_PER_MESSAGE;
    }

    return Math.round(payloadTokens + overhead);
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
