import { createHash } from 'node:crypto';
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

type CacheablePart = any;

function buildEstimateKey(kind: string, text: string): string {
  const payloadHash = createHash('sha1').update(text).digest('hex');
  return `${kind}:${payloadHash}`;
}

function resolveEncodingId(encoding?: TiktokenBPE): string {
  if (!encoding) return 'o200k_base';

  try {
    return `custom:${createHash('sha1').update(JSON.stringify(encoding)).digest('hex')}`;
  } catch {
    return 'custom:unknown';
  }
}

function isTokenEstimateEntry(value: unknown): value is TokenEstimateCacheEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<TokenEstimateCacheEntry>;
  return (
    typeof entry.v === 'number' &&
    typeof entry.source === 'string' &&
    typeof entry.key === 'string' &&
    typeof entry.tokens === 'number'
  );
}

function getCacheEntry(cache: unknown, key: string): TokenEstimateCacheEntry | undefined {
  if (!cache || typeof cache !== 'object') return undefined;
  if (isTokenEstimateEntry(cache)) {
    return cache.key === key ? cache : undefined;
  }

  return undefined;
}

function getPartCacheEntry(part: CacheablePart, key: string): TokenEstimateCacheEntry | undefined {
  const cache = (part as any)?.providerMetadata?.mastra?.tokenEstimate;
  return getCacheEntry(cache, key);
}

function setPartCacheEntry(part: CacheablePart, _key: string, entry: TokenEstimateCacheEntry): void {
  const mutablePart = part as any;
  mutablePart.providerMetadata ??= {};
  mutablePart.providerMetadata.mastra ??= {};
  mutablePart.providerMetadata.mastra.tokenEstimate = entry;
}

function getMessageCacheEntry(message: MastraDBMessage, key: string): TokenEstimateCacheEntry | undefined {
  const content = message.content as any;
  if (content && typeof content === 'object') {
    const contentLevelCache = content.metadata?.mastra?.tokenEstimate;
    const contentLevelEntry = getCacheEntry(contentLevelCache, key);
    if (contentLevelEntry) return contentLevelEntry;
  }

  const messageLevelCache = (message as any)?.metadata?.mastra?.tokenEstimate;
  return getCacheEntry(messageLevelCache, key);
}

function setMessageCacheEntry(message: MastraDBMessage, _key: string, entry: TokenEstimateCacheEntry): void {
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

function serializePartForTokenCounting(part: CacheablePart): string {
  const hasTokenEstimate = Boolean((part as any)?.providerMetadata?.mastra?.tokenEstimate);
  if (!hasTokenEstimate) {
    return JSON.stringify(part);
  }

  const clonedPart = {
    ...(part as any),
    providerMetadata: {
      ...((part as any).providerMetadata ?? {}),
      mastra: {
        ...((part as any).providerMetadata?.mastra ?? {}),
      },
    },
  };

  delete clonedPart.providerMetadata.mastra.tokenEstimate;

  if (Object.keys(clonedPart.providerMetadata.mastra).length === 0) {
    delete clonedPart.providerMetadata.mastra;
  }

  if (Object.keys(clonedPart.providerMetadata).length === 0) {
    delete clonedPart.providerMetadata;
  }

  return JSON.stringify(clonedPart);
}

function isValidCacheEntry(
  entry: TokenEstimateCacheEntry | undefined,
  expectedKey: string,
  expectedSource: string,
): entry is TokenEstimateCacheEntry {
  return Boolean(
    entry &&
    entry.v === TOKEN_ESTIMATE_CACHE_VERSION &&
    entry.source === expectedSource &&
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
  private readonly cacheSource: string;

  // Per-message overhead: accounts for role tokens, message framing, and separators.
  // Empirically derived from OpenAI's token counting guide (3 tokens per message base +
  // fractional overhead from name/role encoding). 3.8 is a practical average across models.
  private static readonly TOKENS_PER_MESSAGE = 3.8;
  // Conversation-level overhead: system prompt framing, reply priming tokens, etc.
  private static readonly TOKENS_PER_CONVERSATION = 24;

  constructor(encoding?: TiktokenBPE) {
    this.encoder = encoding ? new Tiktoken(encoding) : getDefaultEncoder();
    this.cacheSource = `v${TOKEN_ESTIMATE_CACHE_VERSION}:${resolveEncodingId(encoding)}`;
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
    const cached = getPartCacheEntry(part, key);
    if (isValidCacheEntry(cached, key, this.cacheSource)) {
      return cached.tokens;
    }

    const tokens = this.countString(payload);
    setPartCacheEntry(part, key, {
      v: TOKEN_ESTIMATE_CACHE_VERSION,
      source: this.cacheSource,
      key,
      tokens,
    });

    return tokens;
  }

  private readOrPersistMessageEstimate(message: MastraDBMessage, kind: string, payload: string): number {
    const key = buildEstimateKey(kind, payload);
    const cached = getMessageCacheEntry(message, key);
    if (isValidCacheEntry(cached, key, this.cacheSource)) {
      return cached.tokens;
    }

    const tokens = this.countString(payload);
    setMessageCacheEntry(message, key, {
      v: TOKEN_ESTIMATE_CACHE_VERSION,
      source: this.cacheSource,
      key,
      tokens,
    });

    return tokens;
  }

  private resolveToolResultForTokenCounting(
    part: CacheablePart,
    invocationResult: unknown,
  ): { value: unknown; usingStoredModelOutput: boolean } {
    const mastraMetadata = (part as any)?.providerMetadata?.mastra;
    if (mastraMetadata && typeof mastraMetadata === 'object' && 'modelOutput' in mastraMetadata) {
      return {
        value: (mastraMetadata as Record<string, unknown>).modelOutput,
        usingStoredModelOutput: true,
      };
    }

    return {
      value: invocationResult,
      usingStoredModelOutput: false,
    };
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

              const { value: resultForCounting, usingStoredModelOutput } = this.resolveToolResultForTokenCounting(
                part,
                invocation.result,
              );

              if (resultForCounting !== undefined) {
                if (typeof resultForCounting === 'string') {
                  payloadTokens += this.readOrPersistPartEstimate(
                    part,
                    usingStoredModelOutput ? 'tool-result-model-output' : 'tool-result',
                    resultForCounting,
                  );
                } else {
                  const resultJson = JSON.stringify(resultForCounting);
                  payloadTokens += this.readOrPersistPartEstimate(
                    part,
                    usingStoredModelOutput ? 'tool-result-model-output-json' : 'tool-result-json',
                    resultJson,
                  );
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
            const serialized = serializePartForTokenCounting(part);
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
