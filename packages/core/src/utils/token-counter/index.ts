/**
 * Shared token counting primitives for Mastra core.
 *
 * Provides text token counting via tokenx, metadata caching
 * helpers in the `message.content.metadata.mastra.tokenEstimate` /
 * `message.metadata.mastra.tokenEstimate` namespace, and a CoreTokenCounter
 * class that handles message-level counting without provider-specific image
 * estimation (image estimation stays in packages/memory).
 *
 * The cache version, key format, and metadata location are shared with the
 * Observational Memory TokenCounter so estimates written by one consumer can
 * be reused by another within the same thread without re-counting.
 *
 * NOTE: This implementation intentionally duplicates parts of the
 * Observational Memory TokenCounter in packages/memory. Keep the cache
 * format (version, key, metadata shape) in sync between here and
 * token-counter.ts in @mastra/memory. This duplication exists because
 * @mastra/memory must remain independently bumpable from @mastra/core
 * until Mastra v2, where token counting can be consolidated behind a
 * shared package or API.
 */

import { createHash } from 'node:crypto';
import { estimateTokenCount } from 'tokenx';

import type { MastraDBMessage } from '../../agent';

// ──────────────────────────── Types ────────────────────────────

/**
 * Cached token estimate stored on message/content/part metadata.
 * `v` = cache version for invalidation, `source` = encoder identity,
 * `key` = content hash for cache lookup, `tokens` = estimated count.
 */
export type TokenEstimateCacheEntry = {
  v: number;
  source: string;
  key: string;
  tokens: number;
};

// ──────────────────────────── Constants ────────────────────────────

/**
 * Version identifier for cached token estimates.
 * Increment when the counting algorithm or format changes.
 */
export const TOKEN_ESTIMATE_CACHE_VERSION = 7;

/**
 * Per-message overhead: accounts for role tokens, message framing, and
 * separators. Empirically derived from OpenAI's token counting guide
 * (3 tokens per message base + fractional overhead from name/role encoding).
 * 3.8 is a practical average across models.
 *
 * NOTE: This value is intentionally duplicated in
 * packages/memory/src/processors/observational-memory/token-counter.ts.
 * Keep in sync until Mastra v2.
 */
export const TOKENS_PER_MESSAGE = 3.8;

/**
 * Conversation-level overhead: system prompt framing, reply priming tokens.
 *
 * NOTE: This value is intentionally duplicated in
 * packages/memory/src/processors/observational-memory/token-counter.ts.
 * Keep in sync until Mastra v2.
 */
export const TOKENS_PER_CONVERSATION = 24;

// ──────────────────────────── Estimator ────────────────────────────

/**
 * Resolve the token estimator identifier for cache source strings.
 */
export function resolveEstimatorId(): string {
  return 'tokenx';
}

// ──────────────────────────── Cache Key ────────────────────────────

/**
 * Build a deterministic SHA-1 based cache key from a kind and payload string.
 */
export function buildEstimateKey(kind: string, text: string): string {
  const payloadHash = createHash('sha1').update(text).digest('hex');
  return `${kind}:${payloadHash}`;
}

// ──────────────────────────── Validation ────────────────────────────

/**
 * Type guard: check if a value is a structured TokenEstimateCacheEntry.
 */
export function isTokenEstimateEntry(value: unknown): value is TokenEstimateCacheEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<TokenEstimateCacheEntry>;
  return (
    typeof entry.v === 'number' &&
    typeof entry.source === 'string' &&
    typeof entry.key === 'string' &&
    typeof entry.tokens === 'number'
  );
}

/**
 * Verify a cache entry is still valid — matches the current version, source,
 * and expected key, and has a finite token count.
 */
export function isValidCacheEntry(
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

// ──────────────────────────── Metadata access helpers ────────────────────────────

type CacheablePart = any;

type MastraTokenEstimateMetadata = {
  mastra?: {
    tokenEstimate?: unknown;
    imageDimensions?: { width?: number; height?: number };
  };
};

type PartWithMastraMetadata = {
  providerMetadata?: MastraTokenEstimateMetadata & Record<string, unknown>;
};

type ContentWithMastraMetadata = {
  metadata?: MastraTokenEstimateMetadata & Record<string, unknown>;
};

type MessageWithMastraMetadata = {
  metadata?: MastraTokenEstimateMetadata & Record<string, unknown>;
};

/** Get mastra metadata from a message part's providerMetadata. */
export function getPartMastraMetadata(part: CacheablePart): MastraTokenEstimateMetadata['mastra'] | undefined {
  return (part as PartWithMastraMetadata).providerMetadata?.mastra;
}

/** Ensure mastra metadata exists on a message part. */
export function ensurePartMastraMetadata(part: CacheablePart): NonNullable<MastraTokenEstimateMetadata['mastra']> {
  const typedPart = part as PartWithMastraMetadata;
  typedPart.providerMetadata ??= {};
  typedPart.providerMetadata.mastra ??= {};
  return typedPart.providerMetadata.mastra;
}

/** Get mastra metadata from a message's content. */
export function getContentMastraMetadata(content: unknown): MastraTokenEstimateMetadata['mastra'] | undefined {
  if (!content || typeof content !== 'object') {
    return undefined;
  }
  return (content as ContentWithMastraMetadata).metadata?.mastra;
}

/** Ensure mastra metadata exists on a message's content. */
export function ensureContentMastraMetadata(
  content: unknown,
): NonNullable<MastraTokenEstimateMetadata['mastra']> | undefined {
  if (!content || typeof content !== 'object') {
    return undefined;
  }
  const typedContent = content as ContentWithMastraMetadata;
  typedContent.metadata ??= {};
  typedContent.metadata.mastra ??= {};
  return typedContent.metadata.mastra;
}

/** Get mastra metadata from a message. */
export function getMessageMastraMetadata(message: MastraDBMessage): MastraTokenEstimateMetadata['mastra'] | undefined {
  return (message as MessageWithMastraMetadata).metadata?.mastra;
}

/** Ensure mastra metadata exists on a message. */
export function ensureMessageMastraMetadata(
  message: MastraDBMessage,
): NonNullable<MastraTokenEstimateMetadata['mastra']> {
  const typedMessage = message as MessageWithMastraMetadata;
  typedMessage.metadata ??= {};
  typedMessage.metadata.mastra ??= {};
  return typedMessage.metadata.mastra;
}

// ──────────────────────────── Cache entry helpers ────────────────────────────

function getCacheEntry(cache: unknown, key: string): TokenEstimateCacheEntry | undefined {
  if (!cache || typeof cache !== 'object') return undefined;
  if (isTokenEstimateEntry(cache)) {
    return cache.key === key ? cache : undefined;
  }
  const keyedEntry = (cache as Record<string, unknown>)[key];
  return isTokenEstimateEntry(keyedEntry) ? keyedEntry : undefined;
}

function mergeCacheEntry(
  cache: unknown,
  key: string,
  entry: TokenEstimateCacheEntry,
): TokenEstimateCacheEntry | Record<string, TokenEstimateCacheEntry> {
  if (isTokenEstimateEntry(cache)) {
    if (cache.key === key) {
      return entry;
    }
    return {
      [cache.key]: cache,
      [key]: entry,
    };
  }
  if (cache && typeof cache === 'object') {
    return {
      ...(cache as Record<string, TokenEstimateCacheEntry>),
      [key]: entry,
    };
  }
  return entry;
}

/** Read a cached token estimate from a message part. */
export function getPartCacheEntry(part: CacheablePart, key: string): TokenEstimateCacheEntry | undefined {
  return getCacheEntry(getPartMastraMetadata(part)?.tokenEstimate, key);
}

/** Write a cached token estimate on a message part. */
export function setPartCacheEntry(part: CacheablePart, key: string, entry: TokenEstimateCacheEntry): void {
  const mastraMetadata = ensurePartMastraMetadata(part);
  mastraMetadata.tokenEstimate = mergeCacheEntry(mastraMetadata.tokenEstimate, key, entry);
}

/** Read a cached token estimate from a message (checks content.metadata first, then message.metadata). */
export function getMessageCacheEntry(message: MastraDBMessage, key: string): TokenEstimateCacheEntry | undefined {
  const contentLevelEntry = getCacheEntry(getContentMastraMetadata(message.content)?.tokenEstimate, key);
  if (contentLevelEntry) return contentLevelEntry;
  return getCacheEntry(getMessageMastraMetadata(message)?.tokenEstimate, key);
}

/** Write a cached token estimate on a message (prefers content.metadata, falls back to message.metadata). */
export function setMessageCacheEntry(message: MastraDBMessage, key: string, entry: TokenEstimateCacheEntry): void {
  const contentMastraMetadata = ensureContentMastraMetadata(message.content);
  if (contentMastraMetadata) {
    contentMastraMetadata.tokenEstimate = mergeCacheEntry(contentMastraMetadata.tokenEstimate, key, entry);
    return;
  }
  const messageMastraMetadata = ensureMessageMastraMetadata(message);
  messageMastraMetadata.tokenEstimate = mergeCacheEntry(messageMastraMetadata.tokenEstimate, key, entry);
}

// ──────────────────────────── CoreTokenCounter ────────────────────────────

/**
 * Lightweight, cache-aware token counter for text-only messages.
 *
 * Counts tokens using tokenx and caches estimates
 * on message/content/part metadata under the `mastra.tokenEstimate` namespace.
 *
 * Does NOT include provider-specific image token estimation — that lives in
 * the Observational Memory TokenCounter which extends this class.
 */
export class CoreTokenCounter {
  readonly cacheSource: string;

  constructor() {
    this.cacheSource = `v${TOKEN_ESTIMATE_CACHE_VERSION}:${resolveEstimatorId()}`;
  }

  /**
   * Count tokens in a plain string using tokenx.
   */
  countString(text: string): number {
    if (!text) return 0;
    return estimateTokenCount(text);
  }

  /**
   * Read or persist a token estimate for a message part.
   */
  protected readOrPersistPartEstimate(part: CacheablePart, kind: string, payload: string): number {
    const key = buildEstimateKey(kind, payload);
    const cached = getPartCacheEntry(part, key);
    if (isValidCacheEntry(cached, key, this.cacheSource)) {
      return cached.tokens;
    }
    const tokens = this.countString(payload);
    setPartCacheEntry(part, key, { v: TOKEN_ESTIMATE_CACHE_VERSION, source: this.cacheSource, key, tokens });
    return tokens;
  }

  /**
   * Persist a pre-computed (fixed) token estimate for a message part.
   * Used for image tokens whose count is computed via provider-specific logic.
   */
  protected readOrPersistFixedPartEstimate(part: CacheablePart, kind: string, payload: string, tokens: number): number {
    const key = buildEstimateKey(kind, payload);
    const cached = getPartCacheEntry(part, key);
    if (isValidCacheEntry(cached, key, this.cacheSource)) {
      return cached.tokens;
    }
    setPartCacheEntry(part, key, { v: TOKEN_ESTIMATE_CACHE_VERSION, source: this.cacheSource, key, tokens });
    return tokens;
  }

  /**
   * Read or persist a token estimate for an entire message.
   */
  protected readOrPersistMessageEstimate(message: MastraDBMessage, kind: string, payload: string): number {
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

  /**
   * Count text-like parts (non-attachment): text, tool-invocations, etc.
   * Protected so subclasses (e.g. Observational Memory's TokenCounter) can
   * use this as a fallback for parts that don't need attachment-specific handling.
   */
  protected countNonAttachmentPart(part: CacheablePart): {
    tokens: number;
    overheadDelta: number;
    toolResultDelta: number;
  } {
    let overheadDelta = 0;
    let toolResultDelta = 0;

    if (part.type === 'text') {
      return { tokens: this.readOrPersistPartEstimate(part, 'text', part.text), overheadDelta, toolResultDelta };
    }

    if (part.type === 'tool-invocation') {
      const invocation = part.toolInvocation;
      let tokens = 0;

      if (invocation.state === 'call' || invocation.state === 'partial-call') {
        if (invocation.toolName) {
          tokens += this.readOrPersistPartEstimate(part, `tool-${invocation.state}-name`, invocation.toolName);
        }
        if (invocation.args) {
          if (typeof invocation.args === 'string') {
            tokens += this.readOrPersistPartEstimate(part, `tool-${invocation.state}-args`, invocation.args);
          } else {
            tokens += this.readOrPersistPartEstimate(
              part,
              `tool-${invocation.state}-args-json`,
              JSON.stringify(invocation.args),
            );
            overheadDelta -= 12;
          }
        }
        return { tokens, overheadDelta, toolResultDelta };
      }

      if (invocation.state === 'result') {
        toolResultDelta++;
        const resultForCounting = invocation.result;
        if (resultForCounting !== undefined) {
          if (typeof resultForCounting === 'string') {
            tokens += this.readOrPersistPartEstimate(part, 'tool-result', resultForCounting);
          } else {
            tokens += this.readOrPersistPartEstimate(part, 'tool-result-json', JSON.stringify(resultForCounting));
            overheadDelta -= 12;
          }
        }
        return { tokens, overheadDelta, toolResultDelta };
      }

      throw new Error(
        `Unhandled tool-invocation state '${(part as any).toolInvocation?.state}' in token counting for part type '${part.type}'`,
      );
    }

    if (typeof part.type === 'string' && part.type.startsWith('data-')) {
      return { tokens: 0, overheadDelta, toolResultDelta };
    }

    if (part.type === 'reasoning') {
      return { tokens: 0, overheadDelta, toolResultDelta };
    }

    return {
      tokens: this.readOrPersistPartEstimate(part, `part-${part.type}`, JSON.stringify(part)),
      overheadDelta,
      toolResultDelta,
    };
  }

  /**
   * Count tokens in a single message (synchronous).
   * Handles string content, content.content, and parts arrays.
   */
  countMessage(message: MastraDBMessage): number {
    let payloadTokens = this.countString(message.role);
    let overhead = TOKENS_PER_MESSAGE;
    let toolResultCount = 0;

    if (typeof message.content === 'string') {
      payloadTokens += this.readOrPersistMessageEstimate(message, 'message-content', message.content);
    } else if (message.content && typeof message.content === 'object') {
      if (message.content.content && !Array.isArray(message.content.parts)) {
        payloadTokens += this.readOrPersistMessageEstimate(message, 'content-content', message.content.content);
      } else if (Array.isArray(message.content.parts)) {
        for (const part of message.content.parts as CacheablePart[]) {
          const result = this.countNonAttachmentPart(part);
          payloadTokens += result.tokens;
          overhead += result.overheadDelta;
          toolResultCount += result.toolResultDelta;
        }
      }
    }

    if (toolResultCount > 0) {
      overhead += toolResultCount * TOKENS_PER_MESSAGE;
    }

    return Math.round(payloadTokens + overhead);
  }

  /**
   * Count tokens in a single message (async).
   * Same as countMessage by default; subclasses can override for async image counting.
   */
  async countMessageAsync(message: MastraDBMessage): Promise<number> {
    return this.countMessage(message);
  }

  /**
   * Count tokens in an array of messages (synchronous).
   */
  countMessages(messages: MastraDBMessage[]): number {
    if (!messages || messages.length === 0) return 0;
    let total = TOKENS_PER_CONVERSATION;
    for (const message of messages) {
      total += this.countMessage(message);
    }
    return total;
  }

  /**
   * Count tokens in an array of messages (async).
   */
  async countMessagesAsync(messages: MastraDBMessage[]): Promise<number> {
    if (!messages || messages.length === 0) return 0;
    const messageTotals = await Promise.all(messages.map(message => this.countMessageAsync(message)));
    return TOKENS_PER_CONVERSATION + messageTotals.reduce((sum, count) => sum + count, 0);
  }
}
