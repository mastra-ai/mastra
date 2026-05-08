import { createHash } from 'node:crypto';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { MastraServerCache } from '../../cache';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../request-context';
import type {
  CachedLLMStepResponse,
  ProcessLLMRequestArgs,
  ProcessLLMResponseArgs,
  ProcessLLMRequestResult,
  Processor,
} from '../index';

/**
 * Per-instance state stash used to correlate `processLLMRequest` and
 * `processLLMResponse` for the same step. Stored on the shared
 * `args.state` object so it survives between hooks.
 *
 * @internal
 */
const STATE_PENDING_KEY = '__mastra_response_cache_pending_key__';

/**
 * Per-instance state stash for the resolved TTL applied to the pending
 * cache key. Set in `processLLMRequest` after merging per-call overrides
 * so `processLLMResponse` writes use the same value the caller intended,
 * even if the underlying processor options change between hooks.
 *
 * @internal
 */
const STATE_PENDING_TTL_KEY = '__mastra_response_cache_pending_ttl__';

/**
 * Reserved request-context key for per-call response cache overrides.
 *
 * Use {@link ResponseCache.context} or {@link ResponseCache.applyContext}
 * to set this rather than reaching for the raw key — the helpers keep the
 * key name a private implementation detail.
 *
 * @internal
 */
export const RESPONSE_CACHE_CONTEXT_KEY = 'mastra__response_cache_context';

/**
 * Default TTL (seconds) for response cache entries. Matches OpenRouter's
 * reference implementation default of 5 minutes.
 *
 * @internal
 */
export const DEFAULT_RESPONSE_CACHE_TTL_SECONDS = 300;

/**
 * Function form of {@link ResponseCacheOptions.key}. Receives the same
 * inputs the deterministic hash would consume and returns a cache key string.
 */
export type ResponseCacheKeyFn = (inputs: ResponseCacheKeyInputs) => string | Promise<string>;

/**
 * Inputs that contribute to the auto-derived cache key.
 *
 * The key is derived inside the `processLLMRequest` processor hook, so the
 * `prompt` field is the exact `LanguageModelV2Prompt` the provider would
 * receive (post memory + input processors). This eliminates the cross-user
 * leak risk of hashing only the user's raw input — different users with
 * different memory contexts produce different prompts and therefore
 * different cache keys.
 */
export interface ResponseCacheKeyInputs {
  /** Logical agent / processor instance id used to namespace the cache key. */
  agentId: string;
  /** Per-tenant scope, or `null` to opt out entirely. */
  scope?: string | null;
  /** Provider/model identity. Different models produce different responses. */
  model: { provider?: string; modelId?: string; specVersion?: string };
  /**
   * The exact prompt the provider would receive, post memory load and post
   * any prompt-modifying input processors. Source of truth for what the
   * model would generate.
   */
  prompt: LanguageModelV2Prompt;
  /** 0-indexed step number within the agentic loop (>0 for tool steps). */
  stepNumber: number;
}

/**
 * Options for the {@link ResponseCache} processor.
 *
 * Construct an instance and pass it to `inputProcessors` on an `Agent` to
 * enable response caching. Per-call overrides flow through
 * {@link RequestContext} via {@link ResponseCache.context} /
 * {@link ResponseCache.applyContext} — the agent does not know about the
 * cache directly.
 */
export interface ResponseCacheOptions {
  /**
   * The cache backend. Required; the processor is a no-op without one.
   *
   * Pass any {@link MastraServerCache} implementation — `InMemoryServerCache`
   * for local development, `RedisCache` from `@mastra/redis` for production,
   * or your own subclass for a custom backend (e.g. a filesystem-backed
   * fixture recorder).
   */
  cache: MastraServerCache;

  /**
   * Override the auto-derived cache key. See {@link ResponseCacheKeyFn} for
   * the function form.
   */
  key?: string | ResponseCacheKeyFn;

  /**
   * Time-to-live (seconds) for cache entries written by this processor.
   * Defaults to {@link DEFAULT_RESPONSE_CACHE_TTL_SECONDS} (5 minutes).
   */
  ttl?: number;

  /**
   * Optional scope appended to the auto-derived key for multi-tenant
   * isolation. `null` opts out of scoping. When omitted, the processor
   * falls back to the resource id resolved from the request context
   * (`MASTRA_RESOURCE_ID_KEY`) so per-user data is isolated automatically.
   */
  scope?: string | null;

  /**
   * Force a cache miss: skip the read but still write on completion.
   */
  bust?: boolean;

  /**
   * Logical id used in the cache key namespace. Defaults to
   * `'mastra-response-cache'`. Override with the owning agent's id when you
   * want cache entries scoped per-agent.
   */
  agentId?: string;
}

/**
 * Per-call response cache overrides set on a {@link RequestContext}.
 *
 * The constructor-level {@link ResponseCacheOptions.cache} is intentionally
 * not overridable here — pluggable backends are an instance-level concern.
 * Per-call code controls only the parts that vary per request: which entry
 * to read/write, whether to scope, and whether to force a miss.
 */
export interface ResponseCacheContextOptions {
  /** Override the auto-derived cache key for this request only. */
  key?: string | ResponseCacheKeyFn;
  /** Override the scope for this request only. `null` opts out of scoping. */
  scope?: string | null;
  /** Skip the cache read but still write on completion. */
  bust?: boolean;
}

/**
 * Processor that reads/writes per-step LLM responses from a {@link MastraServerCache}.
 *
 * Implements both `processLLMRequest` (cache lookup; short-circuit on hit)
 * and `processLLMResponse` (cache write on completion). The two hooks share
 * a `state` object so the cache key derived in the request hook is reused
 * for the write — even though the prompt-shaped state for the request has
 * already been consumed by the model.
 *
 * Designed to support two use cases without breaking changes:
 *
 * 1. **Production caching (Redis backend).** Skip duplicate model calls
 *    across users for prompts that resolve to the same cache key (post
 *    memory + input processors).
 *
 * 2. **Test fixture recording (planned filesystem backend).** Same
 *    primitive: record LLM responses to disk on first run, replay them on
 *    subsequent runs. Replaces the current MSW-based recorder over time as
 *    fixtures are regenerated.
 *
 * @example
 * ```ts
 * import { Agent } from '@mastra/core/agent';
 * import { ResponseCache } from '@mastra/core/processors';
 *
 * const agent = new Agent({
 *   name: 'Support Agent',
 *   model: 'openai/gpt-5',
 *   inputProcessors: [
 *     new ResponseCache({ cache, ttl: 600, scope: 'org-123' }),
 *   ],
 * });
 *
 * // Per-call override: bust the cache or pin a custom key
 * await agent.stream('hello', {
 *   requestContext: ResponseCache.context({ key: 'custom', bust: true }),
 * });
 * ```
 */
export class ResponseCache implements Processor<'mastra/response-cache'> {
  readonly id = 'mastra/response-cache' as const;
  readonly name = '@mastra/response-cache';

  constructor(private readonly options: ResponseCacheOptions) {}

  /**
   * Build a fresh {@link RequestContext} preloaded with per-call response
   * cache overrides. Convenient when the caller doesn't have an existing
   * context.
   *
   * @example
   * ```ts
   * await agent.stream('hello', {
   *   requestContext: ResponseCache.context({ key: 'custom', bust: true }),
   * });
   * ```
   */
  static context(options: ResponseCacheContextOptions): RequestContext {
    const ctx = new RequestContext();
    ctx.set(RESPONSE_CACHE_CONTEXT_KEY, options);
    return ctx;
  }

  /**
   * Apply per-call response cache overrides to an existing
   * {@link RequestContext}. Returns the same context for chaining.
   *
   * @example
   * ```ts
   * const ctx = new RequestContext();
   * ResponseCache.applyContext(ctx, { bust: true });
   * await agent.stream('hello', { requestContext: ctx });
   * ```
   */
  static applyContext(requestContext: RequestContext, options: ResponseCacheContextOptions): RequestContext {
    requestContext.set(RESPONSE_CACHE_CONTEXT_KEY, options);
    return requestContext;
  }

  async processLLMRequest(args: ProcessLLMRequestArgs): Promise<ProcessLLMRequestResult> {
    // Always clear stale pending state before deriving a new key. If the
    // previous run failed before the response hook fired, leftover state
    // could otherwise cause us to write to the wrong key.
    delete args.state[STATE_PENDING_KEY];
    delete args.state[STATE_PENDING_TTL_KEY];

    const cache = this.options.cache;
    if (!cache) return undefined;

    const merged = this.mergeOptions(args.requestContext);

    let cacheKey: string;
    try {
      cacheKey = await this.deriveKey(args, merged);
    } catch {
      // Key derivation failures are non-fatal — fall through to a real call.
      return undefined;
    }

    const ttl = merged.ttl ?? DEFAULT_RESPONSE_CACHE_TTL_SECONDS;

    if (merged.bust) {
      // Skip lookup but stash the key so we still update the cache on write.
      args.state[STATE_PENDING_KEY] = cacheKey;
      args.state[STATE_PENDING_TTL_KEY] = ttl;
      return undefined;
    }

    let cached: CachedLLMStepResponse | undefined;
    try {
      const raw = await cache.get(cacheKey);
      cached = raw == null ? undefined : (raw as CachedLLMStepResponse);
    } catch {
      // Read failures are non-fatal — fall through to a real call. Don't
      // stash a key, since we don't trust the backend right now.
      return undefined;
    }

    if (cached?.chunks?.length) {
      // Cache hit. processLLMResponse will be invoked with `fromCache: true`
      // and skip writes — no need to stash a key.
      return { response: cached };
    }

    args.state[STATE_PENDING_KEY] = cacheKey;
    args.state[STATE_PENDING_TTL_KEY] = ttl;
    return undefined;
  }

  async processLLMResponse(args: ProcessLLMResponseArgs): Promise<void> {
    if (args.fromCache) return;
    const cache = this.options.cache;
    if (!cache) return;

    const cacheKey = args.state[STATE_PENDING_KEY] as string | undefined;
    const ttl = args.state[STATE_PENDING_TTL_KEY] as number | undefined;
    delete args.state[STATE_PENDING_KEY];
    delete args.state[STATE_PENDING_TTL_KEY];
    if (!cacheKey) return;

    // Don't cache failed runs — replaying an error is not what users expect
    // from a cache hit. We treat any 'error' or 'tripwire' chunk, or a
    // non-success finishReason, as a failure.
    if (containsFailureChunk(args.chunks)) return;

    const cached: CachedLLMStepResponse = {
      chunks: args.chunks,
      warnings: args.warnings,
      request: args.request,
      rawResponse: args.rawResponse,
    };

    try {
      // MastraServerCache uses milliseconds; ResponseCache.ttl is seconds.
      const ttlMs = (ttl ?? DEFAULT_RESPONSE_CACHE_TTL_SECONDS) * 1000;
      await cache.set(cacheKey, cached, ttlMs);
    } catch {
      // Write failures are non-fatal.
    }
  }

  /**
   * Merge constructor options with per-call overrides set on the
   * {@link RequestContext}. Per-call values override constructor values
   * field-by-field; `cache` is intentionally instance-only.
   *
   * @internal
   */
  private mergeOptions(requestContext: RequestContext | undefined): ResponseCacheOptions {
    const perCall = requestContext?.get(RESPONSE_CACHE_CONTEXT_KEY) as ResponseCacheContextOptions | undefined;
    if (!perCall) return this.options;

    const merged: ResponseCacheOptions = { ...this.options };
    if (perCall.key !== undefined) merged.key = perCall.key;
    if (perCall.scope !== undefined) merged.scope = perCall.scope;
    if (perCall.bust !== undefined) merged.bust = perCall.bust;
    return merged;
  }

  /**
   * Derive the cache key for a request. Honors `merged.key` (string or
   * function) when set, otherwise falls back to the deterministic
   * {@link buildResponseCacheKey} hash of the prompt + model + scope.
   *
   * Default scope precedence (when `merged.scope` is undefined):
   * 1. `MASTRA_RESOURCE_ID_KEY` from the request context
   * 2. `undefined` (no scope)
   *
   * `merged.scope === null` opts out explicitly and produces an unscoped key.
   */
  private async deriveKey(args: ProcessLLMRequestArgs, merged: ResponseCacheOptions): Promise<string> {
    let scope: string | null | undefined = merged.scope;
    if (scope === undefined) {
      const resourceFromContext = args.requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
      scope = typeof resourceFromContext === 'string' ? resourceFromContext : undefined;
    }

    const inputs: ResponseCacheKeyInputs = {
      agentId: merged.agentId ?? this.options.agentId ?? 'mastra-response-cache',
      scope: scope ?? undefined,
      model: extractModelInfo(args.model),
      prompt: args.prompt,
      stepNumber: args.stepNumber,
    };

    if (typeof merged.key === 'string') {
      return merged.key;
    }

    if (typeof merged.key === 'function') {
      try {
        return await merged.key(inputs);
      } catch {
        // Custom key function threw — fall back to the deterministic
        // hash so the call still benefits from caching.
        return buildResponseCacheKey(inputs);
      }
    }

    return buildResponseCacheKey(inputs);
  }
}

/**
 * Build a deterministic cache key from the request shape.
 *
 * The key incorporates the prompt the model will see (post memory + input
 * processors), the model identity, and an optional per-tenant scope.
 * Different prompts/models/scopes produce different keys, so config changes
 * automatically invalidate stale entries.
 */
export function buildResponseCacheKey(inputs: ResponseCacheKeyInputs): string {
  const scope = inputs.scope ?? '';
  const modelTag = `${inputs.model.provider ?? 'unknown'}:${inputs.model.modelId ?? 'unknown'}:${inputs.model.specVersion ?? 'unknown'}`;

  const payload = {
    agent: inputs.agentId,
    step: inputs.stepNumber,
    scope,
    model: modelTag,
    prompt: normalizeForHash(stripMastraInternalMetadata(inputs.prompt)),
  };

  const serialized = stableStringify(payload);
  const hash = createHash('sha256').update(serialized).digest('hex').slice(0, 32);
  const scopeTag = scope ? `:${createHash('sha256').update(scope).digest('hex').slice(0, 8)}` : '';
  return `mastra:agent-response:${inputs.agentId}${scopeTag}:${hash}`;
}

/**
 * Returns true if the collected chunks indicate an unsuccessful run that
 * shouldn't be replayed from the cache.
 *
 * @internal
 */
function containsFailureChunk(chunks: ReadonlyArray<{ type: string; payload: unknown }>): boolean {
  for (const chunk of chunks) {
    if (chunk.type === 'error' || chunk.type === 'tripwire') return true;
    if (chunk.type === 'finish') {
      const reason = (chunk.payload as { finishReason?: string } | undefined)?.finishReason;
      if (reason && reason !== 'stop' && reason !== 'length' && reason !== 'tool-calls') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract `{ provider, modelId, specVersion }` from a {@link MastraLanguageModel}
 * value. The processor accepts an unknown model shape (string id, function
 * model, etc.) so we have to be defensive.
 *
 * @internal
 */
function extractModelInfo(model: unknown): {
  provider?: string;
  modelId?: string;
  specVersion?: string;
} {
  if (!model || typeof model !== 'object') {
    return {};
  }
  const m = model as { provider?: unknown; modelId?: unknown; specificationVersion?: unknown };
  return {
    provider: typeof m.provider === 'string' ? m.provider : undefined,
    modelId: typeof m.modelId === 'string' ? m.modelId : undefined,
    specVersion: typeof m.specificationVersion === 'string' ? m.specificationVersion : undefined,
  };
}

/**
 * Strip `providerOptions.mastra.*` from any prompt-shaped value before
 * hashing. Mastra's internal metadata (e.g. `createdAt` timestamps) doesn't
 * change what the model would generate, but it does change between calls,
 * so leaving it in the key would defeat caching.
 *
 * @internal
 */
function stripMastraInternalMetadata(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripMastraInternalMetadata);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'providerOptions' && v && typeof v === 'object' && !Array.isArray(v)) {
      const filtered: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
        if (pk === 'mastra') continue;
        filtered[pk] = stripMastraInternalMetadata(pv);
      }
      // Drop empty providerOptions entirely so its presence/absence doesn't
      // change the hash.
      if (Object.keys(filtered).length > 0) out[k] = filtered;
      continue;
    }
    out[k] = stripMastraInternalMetadata(v);
  }
  return out;
}

/**
 * Normalize a value for hashing: strip undefined, drop function references,
 * preserve plain object/array shape. We intentionally don't try to be smart
 * here — `JSON.stringify` with sorted keys is enough to produce a stable key.
 *
 * @internal
 */
function normalizeForHash(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'function') return '[function]';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) continue;
      out[k] = normalizeForHash(v);
    }
    return out;
  }
  return String(value);
}

/**
 * `JSON.stringify` with deterministic key ordering at every level. Required
 * because object key order is preserved by `JSON.stringify`, and we don't
 * want `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` to hash to different keys.
 *
 * @internal
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

/**
 * Re-export the cached payload shape so consumers can type their own custom
 * cache backends without reaching into `processors/index`.
 */
export type { CachedLLMStepResponse };
