import type { AgentResponseCacheKeyFn, AgentResponseCacheKeyInputs } from '../../agent/response-cache';
import { buildAgentResponseCacheKey } from '../../agent/response-cache';
import type { MastraCache } from '../../cache';
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
 * Options for the {@link ResponseCache} processor.
 *
 * Most callers don't construct this directly — they set `responseCache` on
 * the agent (or per-call on `agent.stream()` / `agent.generate()`) and
 * Mastra registers the processor for them. Construct manually if you want
 * fine-grained control over where the processor sits in the input pipeline
 * relative to other input processors.
 */
export interface ResponseCacheOptions {
  /**
   * The cache backend. Required; the processor is a no-op without one.
   *
   * Designed as a plug point: a Redis-backed `MastraCache` implementation
   * delivers production-grade response caching, and a filesystem-backed
   * one (planned follow-up) lets the same primitive record/replay LLM
   * responses for tests.
   */
  cache: MastraCache;

  /**
   * Override the auto-derived cache key. See
   * {@link AgentResponseCacheKeyFn} for the function form.
   */
  key?: string | AgentResponseCacheKeyFn;

  /**
   * Time-to-live (seconds) for cache entries written by this processor.
   * Defaults to 300 (5 minutes).
   */
  ttl?: number;

  /**
   * Optional scope appended to the auto-derived key for multi-tenant
   * isolation. `null` opts out of scoping. The agent integration defaults
   * this to `memory.resource` when memory is configured.
   */
  scope?: string | null;

  /**
   * Force a cache miss: skip the read but still write on completion.
   */
  bust?: boolean;

  /**
   * Logical agent id for the auto-derived key. Defaults to
   * `'mastra-response-cache'` when constructed directly. The agent
   * integration overrides this with the actual agent id.
   */
  agentId?: string;
}

/**
 * Default TTL (seconds) for response cache entries. Matches the agent-level
 * default in {@link AgentResponseCacheOptions} and OpenRouter's reference
 * implementation.
 *
 * @internal
 */
export const DEFAULT_RESPONSE_CACHE_TTL_SECONDS = 300;

/**
 * Processor that reads/writes per-step LLM responses from a {@link MastraCache}.
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
 */
export class ResponseCache implements Processor<'mastra/response-cache'> {
  readonly id = 'mastra/response-cache' as const;
  readonly name = '@mastra/response-cache';

  constructor(private readonly options: ResponseCacheOptions) {}

  async processLLMRequest(args: ProcessLLMRequestArgs): Promise<ProcessLLMRequestResult> {
    const cache = this.options.cache;
    if (!cache) return undefined;

    let cacheKey: string;
    try {
      cacheKey = await this.deriveKey(args);
    } catch {
      // Key derivation failures are non-fatal — fall through to a real call.
      return undefined;
    }

    if (this.options.bust) {
      // Skip lookup but stash the key so we still update the cache on write.
      args.state[STATE_PENDING_KEY] = cacheKey;
      return undefined;
    }

    let cached: CachedLLMStepResponse | undefined;
    try {
      cached = await cache.get<CachedLLMStepResponse>(cacheKey);
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
    return undefined;
  }

  async processLLMResponse(args: ProcessLLMResponseArgs): Promise<void> {
    if (args.fromCache) return;
    const cache = this.options.cache;
    if (!cache) return;

    const cacheKey = args.state[STATE_PENDING_KEY] as string | undefined;
    delete args.state[STATE_PENDING_KEY];
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
      const ttl = this.options.ttl ?? DEFAULT_RESPONSE_CACHE_TTL_SECONDS;
      await cache.set(cacheKey, cached, ttl);
    } catch {
      // Write failures are non-fatal.
    }
  }

  /**
   * Derive the cache key for a request. Honors `options.key` (string or
   * function) when set, otherwise falls back to the deterministic
   * {@link buildAgentResponseCacheKey} hash of the prompt + model + scope.
   */
  private async deriveKey(args: ProcessLLMRequestArgs): Promise<string> {
    const inputs: AgentResponseCacheKeyInputs = {
      agentId: this.options.agentId ?? 'mastra-response-cache',
      scope: this.options.scope ?? undefined,
      model: extractModelInfo(args.model),
      prompt: args.prompt,
      stepNumber: args.stepNumber,
    };

    if (typeof this.options.key === 'string') {
      return this.options.key;
    }

    if (typeof this.options.key === 'function') {
      try {
        return await this.options.key(inputs);
      } catch {
        // Custom key function threw — fall back to the deterministic
        // hash so the call still benefits from caching.
        return buildAgentResponseCacheKey(inputs);
      }
    }

    return buildAgentResponseCacheKey(inputs);
  }
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
 * Re-export the cached payload shape so consumers can type their own custom
 * cache backends without reaching into `processors/index`.
 */
export type { CachedLLMStepResponse };
