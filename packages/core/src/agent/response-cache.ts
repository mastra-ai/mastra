import { createHash } from 'node:crypto';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { MastraCache } from '../cache';

/**
 * Configuration for the agent response cache.
 *
 * Set on an agent's constructor as a default for every call, or per-call on
 * `agent.stream()` / `agent.generate()`. Per-call options override agent-level
 * defaults.
 *
 * Cache hits replay the per-step LLM response without making a model call.
 * The cache key is derived from the exact prompt the model would receive
 * (post memory load, post input processors), the model identity, and an
 * optional scope (defaulting to `memory.resource` for multi-tenant
 * isolation). See {@link buildAgentResponseCacheKey}.
 *
 * @see https://openrouter.ai/announcements/response-caching for the design
 *   inspiration. Mastra's implementation runs as a processor on the
 *   provider-boundary `processLLMRequest` hook so it works with any model.
 */
export interface AgentResponseCacheOptions {
  /**
   * Override the auto-derived cache key. Accepts either:
   *
   * - A string: used verbatim. None of the request shape is hashed into the
   *   key. Useful when you want to share a cached response across requests
   *   that differ in irrelevant ways, or to manually invalidate a cached
   *   entry by changing the key.
   * - A function: receives the same {@link AgentResponseCacheKeyInputs}
   *   Mastra would have hashed and returns a string (or `Promise<string>`).
   *   Use this when you only care about a subset of the inputs (e.g. cache
   *   only on the latest user message and the model id, ignoring history),
   *   or when you want to reuse Mastra's hashing helpers via
   *   {@link buildAgentResponseCacheKey}.
   */
  key?: string | AgentResponseCacheKeyFn;

  /**
   * Time-to-live in seconds. Defaults to 300 (5 minutes), matching
   * OpenRouter's response cache default. Set to `0` to fall through to the
   * underlying cache implementation's default TTL.
   */
  ttl?: number;

  /**
   * Optional scope appended to the auto-derived cache key for multi-tenant
   * isolation. When omitted, the agent falls back to `memory.resource`
   * (when memory is configured) so per-user data is isolated automatically.
   *
   * Set to `null` to opt out of all scoping (cache shared across all callers
   * of this agent).
   */
  scope?: string | null;

  /**
   * Custom cache implementation. Defaults to the Mastra instance's
   * `MastraServerCache` (adapted to the {@link MastraCache} interface).
   *
   * If no Mastra-level cache is configured and no custom cache is provided,
   * `responseCache` is silently disabled (logged via the agent's logger).
   */
  cache?: MastraCache;

  /**
   * Force a cache miss for this request. The cached value (if any) is
   * ignored, the underlying LLM call runs, and the new result overwrites the
   * cached entry. Mirrors OpenRouter's `X-OpenRouter-Cache-Clear` header.
   */
  bust?: boolean;
}

/**
 * Function form of {@link AgentResponseCacheOptions.key}. Receives the same
 * inputs Mastra would have hashed and returns a cache key string.
 */
export type AgentResponseCacheKeyFn = (inputs: AgentResponseCacheKeyInputs) => string | Promise<string>;

/**
 * Inputs that contribute to the auto-derived cache key.
 *
 * The key is derived inside the `processLLMRequest` processor hook, so the
 * `prompt` field is the exact `LanguageModelV2Prompt` the provider would
 * receive (post memory + input processors). This eliminates the cross-user
 * leak risk of hashing only the user's raw input — different users with
 * different memory contexts produce different prompts and therefore
 * different cache keys.
 *
 * @internal
 */
export interface AgentResponseCacheKeyInputs {
  /** The owning agent's id. */
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
 * Resolved (per-call) response cache config — never `boolean | undefined`.
 *
 * @internal
 */
export type ResolvedResponseCacheConfig = {
  enabled: boolean;
  cache?: MastraCache;
  key?: string | AgentResponseCacheKeyFn;
  ttl?: number;
  scope?: string | null;
  bust: boolean;
};

/**
 * Per-call options accepted on `agent.stream()` / `agent.generate()`. `true`
 * means "use the agent default; if there's none, use defaults across the
 * board". An object lets the caller override any field.
 */
export type AgentResponseCacheOption = boolean | AgentResponseCacheOptions;

/**
 * Resolve the per-call response cache config by merging the per-call option
 * (if any) on top of the agent-level default (if any).
 *
 * @internal
 */
export function resolveResponseCacheConfig(
  agentDefault: AgentResponseCacheOption | undefined,
  perCall: AgentResponseCacheOption | undefined,
): ResolvedResponseCacheConfig {
  // Per-call `false` always wins (explicit opt-out).
  if (perCall === false) {
    return { enabled: false, bust: false };
  }

  const agentEnabled = agentDefault === true || (typeof agentDefault === 'object' && agentDefault !== null);
  const perCallEnabled = perCall === true || (typeof perCall === 'object' && perCall !== null);
  const enabled = perCallEnabled || (perCall === undefined && agentEnabled);

  if (!enabled) {
    return { enabled: false, bust: false };
  }

  const agentObj: AgentResponseCacheOptions =
    typeof agentDefault === 'object' && agentDefault !== null ? agentDefault : {};
  const perCallObj: AgentResponseCacheOptions = typeof perCall === 'object' && perCall !== null ? perCall : {};

  return {
    enabled: true,
    cache: perCallObj.cache ?? agentObj.cache,
    key: perCallObj.key ?? agentObj.key,
    ttl: perCallObj.ttl ?? agentObj.ttl,
    scope: perCallObj.scope !== undefined ? perCallObj.scope : agentObj.scope,
    bust: perCallObj.bust ?? false,
  };
}

/**
 * Build a deterministic cache key from the request shape.
 *
 * The key incorporates the prompt the model will see (post memory + input
 * processors), the model identity, and an optional per-tenant scope.
 * Different prompts/models/scopes produce different keys, so config changes
 * automatically invalidate stale entries.
 *
 * @internal
 */
export function buildAgentResponseCacheKey(inputs: AgentResponseCacheKeyInputs): string {
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
